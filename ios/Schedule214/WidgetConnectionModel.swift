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
    static func sync(with feed: WidgetFeed, now: Date = Date()) async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let current = feed.events.first { event in
            guard event.status != "cancelled",
                  event.kind == "lesson" || event.kind == "rehearsal",
                  let interval = interval(for: event, date: feed.date) else { return false }
            return interval.contains(now)
        }

        let activities = Activity<ScheduleActivityAttributes>.activities

        guard let current,
              let currentInterval = interval(for: current, date: feed.date) else {
            for activity in activities {
                await activity.end(
                    ActivityContent(
                        state: ScheduleActivityAttributes.ContentState(revision: 1),
                        staleDate: nil
                    ),
                    dismissalPolicy: .immediate
                )
            }
            return
        }

        if let existing = activities.first(where: { $0.attributes.eventId == current.id }) {
            for activity in activities where activity.id != existing.id {
                await activity.end(
                    ActivityContent(
                        state: ScheduleActivityAttributes.ContentState(revision: 1),
                        staleDate: nil
                    ),
                    dismissalPolicy: .immediate
                )
            }
            return
        }

        for activity in activities {
            await activity.end(
                ActivityContent(
                    state: ScheduleActivityAttributes.ContentState(revision: 1),
                    staleDate: nil
                ),
                dismissalPolicy: .immediate
            )
        }

        let attributes = ScheduleActivityAttributes(
            eventId: current.id,
            title: current.title,
            subtitle: current.subtitle,
            kind: current.kind,
            startDate: currentInterval.lowerBound,
            endDate: currentInterval.upperBound
        )
        let content = ActivityContent(
            state: ScheduleActivityAttributes.ContentState(revision: 1),
            staleDate: currentInterval.upperBound
        )

        do {
            _ = try Activity.request(attributes: attributes, content: content, pushType: nil)
        } catch {
            print("Failed to start Live Activity:", error.localizedDescription)
        }
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
