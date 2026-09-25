import SwiftUI
import UIKit
import WidgetKit

@MainActor
final class WidgetConnectionModel: ObservableObject {
    @Published private(set) var connected = WidgetStore.token != nil
    @Published private(set) var profileName = WidgetStore.profileName
    @Published var statusMessage: String?
    @Published var busy = false
    @Published private(set) var webReloadRevision = 0

    func handle(url: URL) {
        guard url.scheme == "schedule214",
              url.host == "widget",
              url.path == "/pair",
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let code = components.queryItems?.first(where: { $0.name == "code" })?.value,
              !code.isEmpty else { return }

        Task { await pair(code: code) }
    }

    func accept(token: String, profileName: String) {
        WidgetStore.save(token: token, profileName: profileName)
        connected = true
        self.profileName = profileName
        statusMessage = "Готово. Теперь добавь виджет 214Р на экран."
        webReloadRevision += 1
        WidgetCenter.shared.reloadAllTimelines()
    }

    func pair(code: String) async {
        guard !busy else { return }
        busy = true
        statusMessage = "Подключаем виджет…"
        defer { busy = false }

        do {
            let deviceId = UIDevice.current.identifierForVendor?.uuidString
            let response = try await WidgetAPI.exchange(code: code, deviceId: deviceId)
            accept(token: response.token, profileName: response.profile.name)
        } catch {
            statusMessage = "Не удалось подключить. Открой настройки внутри приложения и попробуй ещё раз."
        }
    }

    func disconnect() async {
        guard !busy else { return }
        busy = true
        statusMessage = "Отключаем…"
        await WidgetAPI.disconnect()
        connected = false
        profileName = nil
        busy = false
        statusMessage = "Виджет отключён."
        webReloadRevision += 1
        WidgetCenter.shared.reloadAllTimelines()
    }
}
