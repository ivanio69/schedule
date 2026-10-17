import SwiftUI
import UIKit
import WidgetKit

@MainActor
final class WidgetConnectionModel: ObservableObject {
    @Published private(set) var webDestination = WidgetEnvironment.widgetSetupURL
    @Published private(set) var connected = WidgetStore.token != nil
    @Published private(set) var profileName = WidgetStore.profileName
    @Published var statusMessage: String?
    @Published var busy = false
    @Published private(set) var webReloadRevision = 0
    @Published private(set) var nativeBridgeRevision = 0
    @Published private(set) var nativeReady = false
    @Published private(set) var nativeLabel = "Загружаем приложение"
    @Published private(set) var nativeDetail = "Подготавливаем интерфейс и виджет."
    @Published private(set) var nativeError: [String: String]? = nil

    private let classActivities = ClassActivityController()
    private var activityFeeds: [WidgetFeed]?

    func runForegroundUpdates() async {
        classActivities.onError = { [weak self] message in
            self?.reportNativeError(source: "activitykit", code: "classActivity.sync", message: message)
        }
        await initializeNativeIntegration()
        var ticks = 0
        while !Task.isCancelled {
            do { try await Task.sleep(for: .seconds(5)) } catch { return }
            guard !Task.isCancelled else { return }
            ticks += 1
            if connected && ticks % 12 == 0 { await refreshWidgetData() }
            if !busy { await classActivities.synchronize(feeds: connected ? activityFeeds : []) }
        }
    }

    func initializeNativeIntegration() async {
        setNativeState(
            ready: false,
            label: "Загружаем приложение",
            detail: connected ? "Обновляем виджет, расписание и Live Activity." : "Подготавливаем веб-интерфейс."
        )
        guard connected else {
            await classActivities.synchronize(feeds: [])
            setNativeState(ready: true, label: "Готово", detail: "Можно подключить iOS-виджет в настройках.")
            return
        }
        await refreshWidgetData(startup: true)
    }

    func bridgePayload() -> [String: Any] {
        var payload: [String: Any] = [
            "ready": nativeReady,
            "busy": busy,
            "label": nativeLabel,
            "detail": nativeDetail,
        ]
        payload["error"] = nativeError ?? NSNull()
        return payload
    }

    func reportNativeError(
        source: String,
        code: String,
        message: String,
        detail: String? = nil
    ) {
        nativeError = [
            "source": source,
            "code": code,
            "message": message,
            "detail": detail ?? "",
        ]
        nativeBridgeRevision += 1
        Task {
            await WidgetAPI.reportError(source: source, code: code, message: message, detail: detail)
        }
    }

    private func setNativeState(ready: Bool, label: String, detail: String) {
        nativeReady = ready
        nativeLabel = label
        nativeDetail = detail
        nativeBridgeRevision += 1
    }

    func handle(url: URL) {
        if url.scheme == "schedule214", url.host == "schedule" {
            webDestination = WidgetEnvironment.scheduleURL.appending(path: "schedule")
            webReloadRevision += 1
            return
        }
        guard url.scheme == "schedule214",
              url.host == "widget",
              url.path == "/pair",
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let code = components.queryItems?.first(where: { $0.name == "code" })?.value,
              !code.isEmpty else { return }

        Task { await pair(code: code) }
    }

    func accept(token: String, profileName: String) {
        let profileChanged = WidgetStore.token != token
        if profileChanged { activityFeeds = nil }
        WidgetStore.save(token: token, profileName: profileName)
        connected = true
        self.profileName = profileName
        statusMessage = "Подключено. Загружаем данные виджета…"
        webReloadRevision += 1
        Task {
            if profileChanged { await classActivities.synchronize(feeds: []) }
            await refreshWidgetData()
        }
    }

    func refreshWidgetData(startup: Bool = false) async {
        guard connected, !busy else {
            if startup { setNativeState(ready: true, label: "Готово", detail: "Виджет уже обновляется.") }
            return
        }
        busy = true
        if startup {
            setNativeState(ready: false, label: "Загружаем приложение", detail: "Получаем расписание на сегодня и завтра.")
        }
        defer {
            busy = false
            if startup && !nativeReady {
                setNativeState(ready: true, label: "Готово", detail: statusMessage ?? "Интеграция подготовлена.")
            }
        }

        let refreshToken = WidgetStore.token
        await classActivities.synchronize(feeds: activityFeeds)

        do {
            let now = Date()
            let today = try await WidgetAPI.feed(for: now)
            let tomorrowDate = ClassActivityPlan.calendar.date(byAdding: .day, value: 1, to: now) ?? now.addingTimeInterval(86_400)
            let tomorrow = try? await WidgetAPI.feed(for: tomorrowDate)
            guard refreshToken == WidgetStore.token, !Task.isCancelled else { return }
            activityFeeds = [today] + (tomorrow.map { [$0] } ?? [])
            nativeError = nil
            await classActivities.synchronize(feeds: activityFeeds)
            nativeBridgeRevision += 1
            statusMessage = tomorrow == nil
                ? "Сегодня обновлено. Завтра загрузится при следующей синхронизации."
                : "Виджет и Live Activity обновлены на сегодня и завтра."
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            guard !Task.isCancelled, refreshToken == WidgetStore.token else { return }
            statusMessage = "Виджет подключён, но данные не загрузились: \(error.localizedDescription)"
            reportNativeError(
                source: "ios",
                code: "widget.refresh",
                message: error.localizedDescription,
                detail: "Не удалось обновить feed/Live Activity"
            )
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    func pair(code: String) async {
        guard !busy else { return }
        busy = true
        statusMessage = "Подключаем виджет…"
        defer { busy = false }

        do {
            let deviceId = UIDevice.current.identifierForVendor?.uuidString
            let response = try await WidgetAPI.exchange(code: code, deviceId: deviceId)
            busy = false
            accept(token: response.token, profileName: response.profile.name)
        } catch {
            statusMessage = "Не удалось подключить. Открой настройки внутри приложения и попробуй ещё раз."
            reportNativeError(source: "ios", code: "widget.pair", message: error.localizedDescription)
        }
    }

    func disconnect() async {
        guard !busy else { return }
        busy = true
        statusMessage = "Отключаем…"
        activityFeeds = []
        await classActivities.synchronize(feeds: [])
        await WidgetAPI.disconnect()
        connected = false
        profileName = nil
        busy = false
        statusMessage = "Виджет отключён."
        webReloadRevision += 1
        WidgetCenter.shared.reloadAllTimelines()
    }
}
