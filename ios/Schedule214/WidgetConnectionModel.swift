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
            let now = Date()
            let today = try await WidgetAPI.feed(for: now)
            let tomorrowDate = Calendar.current.startOfDay(
                for: Calendar.current.date(byAdding: .day, value: 1, to: now) ?? now.addingTimeInterval(86_400)
            )
            let tomorrow = try? await WidgetAPI.feed(for: tomorrowDate)

            if #available(iOS 17.0, *) {
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

    static func sync(with feeds: [WidgetFeed], now: Date = Date()) async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let planned = makePlan(from: feeds, now: now)

        if #available(iOS 26.0, *) {
            await syncScheduled(planned, now: now)
        } else {
            await syncCurrentOnly(planned, now: now)
        }
    }

    private static func makePlan(from feeds: [WidgetFeed], now: Date) -> [PlannedEvent] {
        let orderedFeeds = feeds.sorted { $0.date < $1.date }
        var result: [PlannedEvent] = []

        for (feedIndex, feed) in orderedFeeds.enumerated() {
            let tracked: [PlannedEvent] = feed.events
                .filter {
                    $0.status != "cancelled"
                        && ($0.kind == "lesson" || $0.kind == "rehearsal")
                }
                .compactMap { event in
                    guard let eventInterval = interval(for: event, date: feed.date) else { return nil }
                    return (event, eventInterval)
                }
                .sorted { $0.interval.lowerBound < $1.interval.lowerBound }

            guard !tracked.isEmpty else { continue }

            for index in tracked.indices {
                let item = tracked[index]

                if item.interval.upperBound > now {
                    result.append(item)
                }

                guard index < tracked.index(before: tracked.endIndex) else { continue }
                let next = tracked[tracked.index(after: index)]

                if next.interval.lowerBound > item.interval.upperBound {
                    let breakEvent = WidgetEvent(
                        id: "break:\(item.event.id):\(next.event.id)",
                        kind: "break",
                        status: "normal",
                        title: "Перерыв",
                        subtitle: "Дальше \(next.event.start) · \(next.event.title)",
                        start: item.event.end,
                        end: next.event.start
                    )
                    let breakInterval = item.interval.upperBound...next.interval.lowerBound

                    if breakInterval.upperBound > now {
                        result.append((breakEvent, breakInterval))
                    }
                }
            }

            guard let last = tracked.last else { continue }
            let doneStart = last.interval.upperBound

            // The finished state is scheduled before the day ends, but opening the app
            // after it has already started removes it instead of recreating it.
            guard doneStart > now else { continue }

            var doneEnd = doneStart.addingTimeInterval(7 * 60 * 60 + 55 * 60)

            if feedIndex + 1 < orderedFeeds.count {
                let nextFeed = orderedFeeds[feedIndex + 1]
                let nextStart = nextFeed.events
                    .filter {
                        $0.status != "cancelled"
                            && ($0.kind == "lesson" || $0.kind == "rehearsal")
                    }
                    .compactMap { interval(for: $0, date: nextFeed.date)?.lowerBound }
                    .min()

                if let nextStart, nextStart > doneStart {
                    doneEnd = min(doneEnd, nextStart.addingTimeInterval(-1))
                }
            }

            guard doneEnd > doneStart else { continue }

            let doneEvent = WidgetEvent(
                id: "done:\(feed.date)",
                kind: "done",
                status: "normal",
                title: "На сегодня всё",
                subtitle: "Можно отдыхать",
                start: last.event.end,
                end: last.event.end
            )
            result.append((doneEvent, doneStart...doneEnd))
        }

        return result.sorted { $0.interval.lowerBound < $1.interval.lowerBound }
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

        // A typical day of 3–4 classes plus breaks fits in this queue.
        // ActivityKit can reject extra scheduled activities if the device reaches its limit,
        // so every request remains best-effort.
        let upcoming = planned
            .filter { $0.interval.lowerBound > now }
            .sorted { $0.interval.lowerBound < $1.interval.lowerBound }
            .prefix(8)

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

        let alertTitle: LocalizedStringResource
        let alertBody: LocalizedStringResource

        switch item.event.kind {
        case "break":
            alertTitle = "Перерыв"
            alertBody = "Следующая пара уже в расписании."
        case "done":
            alertTitle = "На сегодня всё"
            alertBody = "Можно отдыхать."
        case "rehearsal":
            alertTitle = "Репетиция начинается"
            alertBody = "Live Activity уже на экране."
        default:
            alertTitle = "Пара начинается"
            alertBody = "Live Activity уже на экране."
        }

        let alert = AlertConfiguration(
            title: alertTitle,
            body: alertBody,
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
