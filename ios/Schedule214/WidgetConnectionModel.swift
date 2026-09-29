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

    func refreshWidgetData() async {
        guard connected, !busy else { return }
        busy = true
        defer { busy = false }

        do {
            let feed = try await WidgetAPI.feed(for: Date())
            if #available(iOS 17.0, *) {
                await ScheduleLiveActivityManager.sync(with: feed)
            }
            statusMessage = "Виджет обновлён."
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            statusMessage = "Виджет подключён, но данные не загрузились: \(error.localizedDescription)"
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
    private typealias PlannedEvent = (event: WidgetEvent, interval: ClosedRange<Date>)

    static func sync(with feed: WidgetFeed, now: Date = Date()) async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let planned: [PlannedEvent] = feed.events.compactMap { event in
            guard event.status != "cancelled",
                  event.kind == "lesson" || event.kind == "rehearsal",
                  let interval = interval(for: event, date: feed.date),
                  interval.upperBound > now else { return nil }
            return (event, interval)
        }

        if #available(iOS 26.0, *) {
            await syncScheduled(planned, now: now)
        } else {
            await syncCurrentOnly(planned, now: now)
        }
    }

    private static func syncCurrentOnly(_ planned: [PlannedEvent], now: Date) async {
        let activities = Activity<ScheduleActivityAttributes>.activities
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

        // Remove stale, deleted or changed activities before rebuilding today's queue.
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

        // Keep the queue small because pending Live Activities count toward the system limit.
        let upcoming = planned
            .filter { $0.interval.lowerBound > now }
            .sorted { $0.interval.lowerBound < $1.interval.lowerBound }
            .prefix(4)

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
            staleDate: item.interval.upperBound
        )

        do {
            return try Activity.request(attributes: attributes, content: content, pushType: nil)
        } catch {
            print("Failed to start Live Activity:", error.localizedDescription)
            return nil
        }
    }

    @available(iOS 26.0, *)
    @discardableResult
    private static func requestScheduled(_ item: PlannedEvent) -> Activity<ScheduleActivityAttributes>? {
        let attributes = attributes(for: item)
        let content = ActivityContent(
            state: ScheduleActivityAttributes.ContentState(revision: 1),
            staleDate: item.interval.upperBound
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
            endTimestamp: item.interval.upperBound.timeIntervalSince1970
        )
    }

    private static func matches(
        _ activity: Activity<ScheduleActivityAttributes>,
        _ item: PlannedEvent
    ) -> Bool {
        let attributes = activity.attributes
        return attributes.eventId == item.event.id
            && abs(attributes.startTimestamp - item.interval.lowerBound.timeIntervalSince1970) < 1
            && abs(attributes.endTimestamp - item.interval.upperBound.timeIntervalSince1970) < 1
            && attributes.title == item.event.title
            && attributes.subtitle == item.event.subtitle
            && attributes.kind == item.event.kind
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
