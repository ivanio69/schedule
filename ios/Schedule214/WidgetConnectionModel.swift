import SwiftUI
import ActivityKit
import UIKit
import WidgetKit

@MainActor
final class WidgetConnectionModel: ObservableObject {
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

    func initializeNativeIntegration() async {
        setNativeState(
            ready: false,
            label: "Загружаем приложение",
            detail: connected ? "Обновляем виджет, расписание и Live Activity." : "Подготавливаем веб-интерфейс."
        )
        guard connected else {
            setNativeState(ready: true, label: "Готово", detail: "Можно подключить iOS-виджет в настройках.")
            return
        }
        await refreshWidgetData(startup: true)
    }

    func bridgePayload() -> [String: Any] {
        [
            "ready": nativeReady,
            "busy": busy,
            "label": nativeLabel,
            "detail": nativeDetail,
            "error": nativeError as Any,
        ]
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
        statusMessage = "Подключено. Загружаем данные виджета…"
        webReloadRevision += 1
        Task { await refreshWidgetData() }
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

        if #available(iOS 17.0, *) {
            await ScheduleLiveActivityManager.dismissExpiredStatesOnAppOpen()
        }

        do {
            let now = Date()
            let today = try await WidgetAPI.feed(for: now)
            let tomorrowDate = Calendar.current.startOfDay(
                for: Calendar.current.date(byAdding: .day, value: 1, to: now) ?? now.addingTimeInterval(86_400)
            )
            let tomorrow = try? await WidgetAPI.feed(for: tomorrowDate)

            if #available(iOS 17.0, *) {
                if startup {
                    setNativeState(ready: false, label: "Загружаем приложение", detail: "Планируем Live Activity.")
                }
                await ScheduleLiveActivityManager.sync(
                    with: [today] + (tomorrow.map { [$0] } ?? []),
                    now: now
                )
            }
            statusMessage = tomorrow == nil
                ? "Сегодня обновлено. Завтра загрузится при следующей синхронизации."
                : "Виджет и Live Activity обновлены на сегодня и завтра."
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
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
        await WidgetAPI.disconnect()
        connected = false
        profileName = nil
        busy = false
        statusMessage = "Виджет отключён."
        webReloadRevision += 1
        WidgetCenter.shared.reloadAllTimelines()
    }
}


@available(iOS 17.0, *)
enum ScheduleLiveActivityManager {
    private struct PlannedEvent {
        let event: WidgetEvent
        let interval: ClosedRange<Date>
        let nextTitle: String?
        let nextStart: Date?

        var keepUntil: Date {
            max(interval.upperBound, nextStart ?? interval.upperBound)
        }
    }

    static func sync(with feeds: [WidgetFeed], now: Date = Date()) async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let planned = makePlan(from: feeds, now: now)

        if #available(iOS 26.0, *) {
            await syncScheduled(planned, now: now)
        } else {
            await syncCurrentOnly(planned, now: now)
        }
    }

    static func dismissExpiredStatesOnAppOpen(now: Date = Date()) async {
        for activity in Activity<ScheduleActivityAttributes>.activities {
            guard activity.attributes.endDate <= now else { continue }

            // During an active break, keep the stale activity visible.
            if let nextStart = activity.attributes.nextStartDate, nextStart > now {
                continue
            }

            await end(activity)
        }
    }

    private static func makePlan(from feeds: [WidgetFeed], now: Date) -> [PlannedEvent] {
        feeds
            .sorted { $0.date < $1.date }
            .flatMap { feed -> [PlannedEvent] in
                let tracked = feed.events
                    .filter {
                        $0.status != "cancelled"
                            && ($0.kind == "lesson" || $0.kind == "rehearsal")
                    }
                    .compactMap { event -> (WidgetEvent, ClosedRange<Date>)? in
                        guard let eventInterval = interval(for: event, date: feed.date) else { return nil }
                        return (event, eventInterval)
                    }
                    .sorted { $0.1.lowerBound < $1.1.lowerBound }

                return tracked.indices.compactMap { index in
                    let item = tracked[index]
                    let nextIndex = tracked.index(after: index)
                    let next = nextIndex < tracked.endIndex ? tracked[nextIndex] : nil

                    let hasRealBreak = next.map { $0.1.lowerBound > item.1.upperBound } ?? false
                    let nextStart = hasRealBreak ? next?.1.lowerBound : nil
                    let nextTitle = hasRealBreak ? next?.0.title : nil
                    let keepUntil = max(item.1.upperBound, nextStart ?? item.1.upperBound)

                    guard keepUntil > now else { return nil }

                    return PlannedEvent(
                        event: item.0,
                        interval: item.1,
                        nextTitle: nextTitle,
                        nextStart: nextStart
                    )
                }
            }
            .sorted { $0.interval.lowerBound < $1.interval.lowerBound }
    }

    private static func syncCurrentOnly(_ planned: [PlannedEvent], now: Date) async {
        let activities = Activity<ScheduleActivityAttributes>.activities

        // Keep a stale activity during the break until the next event starts.
        if let breakActivity = activities.first(where: {
            guard let nextStart = $0.attributes.nextStartDate else { return false }
            return $0.attributes.endDate <= now && nextStart > now
        }) {
            for activity in activities where activity.id != breakActivity.id {
                await end(activity)
            }
            return
        }

        let current = planned.first { $0.interval.contains(now) }

        guard let current else {
            for activity in activities {
                await end(activity)
            }
            return
        }

        if let existing = activities.first(where: { matches($0, current) }) {
            for activity in activities where activity.id != existing.id {
                await end(activity)
            }
            return
        }

        for activity in activities {
            await end(activity)
        }

        requestImmediate(current)
    }

    @available(iOS 26.0, *)
    private static func syncScheduled(_ planned: [PlannedEvent], now: Date) async {
        var activities = Activity<ScheduleActivityAttributes>.activities

        for activity in activities {
            guard let desired = planned.first(where: { $0.event.id == activity.attributes.eventId }),
                  matches(activity, desired) else {
                await end(activity)
                continue
            }
        }

        activities = Activity<ScheduleActivityAttributes>.activities
        var existingIds = Set(activities.map { $0.attributes.eventId })

        if let current = planned.first(where: { $0.interval.contains(now) }),
           !existingIds.contains(current.event.id) {
            if let activity = requestImmediate(current) {
                existingIds.insert(activity.attributes.eventId)
            }
        }

        let upcoming = planned
            .filter { $0.interval.lowerBound > now }
            .sorted { $0.interval.lowerBound < $1.interval.lowerBound }
            .prefix(6)

        for item in upcoming where !existingIds.contains(item.event.id) {
            if let activity = requestScheduled(item) {
                existingIds.insert(activity.attributes.eventId)
            }
        }
    }

    @discardableResult
    private static func requestImmediate(_ item: PlannedEvent) -> Activity<ScheduleActivityAttributes>? {
        let attributes = attributes(for: item)
        let content = ActivityContent(
            state: ScheduleActivityAttributes.ContentState(revision: 1),
            staleDate: item.interval.upperBound,
            relevanceScore: relevanceScore(for: item)
        )

        do {
            return try Activity.request(attributes: attributes, content: content, pushType: nil)
        } catch {
            print("Failed to start Live Activity:", error.localizedDescription)
            Task {
                await WidgetAPI.reportError(
                    source: "activitykit",
                    code: "activity.start",
                    message: error.localizedDescription,
                    detail: item.event.title
                )
            }
            return nil
        }
    }

    @available(iOS 26.0, *)
    @discardableResult
    private static func requestScheduled(_ item: PlannedEvent) -> Activity<ScheduleActivityAttributes>? {
        let attributes = attributes(for: item)
        let content = ActivityContent(
            state: ScheduleActivityAttributes.ContentState(revision: 1),
            staleDate: item.interval.upperBound,
            relevanceScore: relevanceScore(for: item)
        )

        let title: LocalizedStringResource = item.event.kind == "rehearsal"
            ? "Репетиция начинается"
            : "Пара начинается"
        let alert = AlertConfiguration(
            title: title,
            body: "Live Activity уже на экране.",
            sound: .default
        )

        do {
            return try Activity.request(
                attributes: attributes,
                content: content,
                pushType: nil,
                style: .standard,
                alertConfiguration: alert,
                start: item.interval.lowerBound
            )
        } catch {
            print("Failed to schedule Live Activity:", error.localizedDescription)
            Task {
                await WidgetAPI.reportError(
                    source: "activitykit",
                    code: "activity.schedule",
                    message: error.localizedDescription,
                    detail: item.event.title
                )
            }
            return nil
        }
    }

    private static func attributes(for item: PlannedEvent) -> ScheduleActivityAttributes {
        ScheduleActivityAttributes(
            eventId: item.event.id,
            title: item.event.title,
            subtitle: item.event.subtitle,
            kind: item.event.kind,
            startTimestamp: item.interval.lowerBound.timeIntervalSince1970,
            endTimestamp: item.interval.upperBound.timeIntervalSince1970,
            nextTitle: item.nextTitle,
            nextStartTimestamp: item.nextStart?.timeIntervalSince1970
        )
    }

    private static func relevanceScore(for item: PlannedEvent) -> Double {
        // Later events get a slightly higher score so a newly-started activity
        // takes priority over the stale activity from the previous class.
        item.interval.lowerBound.timeIntervalSince1970 / 10_000_000
    }

    private static func matches(
        _ activity: Activity<ScheduleActivityAttributes>,
        _ item: PlannedEvent
    ) -> Bool {
        let attributes = activity.attributes
        let expectedNext = item.nextStart?.timeIntervalSince1970

        return attributes.eventId == item.event.id
            && abs(attributes.startTimestamp - item.interval.lowerBound.timeIntervalSince1970) < 1
            && abs(attributes.endTimestamp - item.interval.upperBound.timeIntervalSince1970) < 1
            && attributes.title == item.event.title
            && attributes.subtitle == item.event.subtitle
            && attributes.kind == item.event.kind
            && attributes.nextTitle == item.nextTitle
            && sameOptionalTimestamp(attributes.nextStartTimestamp, expectedNext)
    }

    private static func sameOptionalTimestamp(_ lhs: Double?, _ rhs: Double?) -> Bool {
        switch (lhs, rhs) {
        case (.none, .none):
            return true
        case let (.some(left), .some(right)):
            return abs(left - right) < 1
        default:
            return false
        }
    }

    private static func end(_ activity: Activity<ScheduleActivityAttributes>) async {
        await activity.end(
            ActivityContent(
                state: ScheduleActivityAttributes.ContentState(revision: 2),
                staleDate: nil
            ),
            dismissalPolicy: .immediate
        )
    }

    private static func interval(for event: WidgetEvent, date: String) -> ClosedRange<Date>? {
        guard let start = dateTime(date: date, time: event.start),
              let end = dateTime(date: date, time: event.end),
              end > start else { return nil }
        return start...end
    }

    private static func dateTime(date: String, time: String) -> Date? {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        return formatter.date(from: "\(date) \(time)")
    }
}
