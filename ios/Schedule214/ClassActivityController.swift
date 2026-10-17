import ActivityKit
import UIKit

@MainActor
final class ClassActivityController {
    private var operation: Task<Void, Never>?
    private var retryAfter = Date.distantPast
    private var dismissed = Set(UserDefaults.standard.stringArray(forKey: "classActivity.dismissedDays") ?? [])
    var onError: ((String) -> Void)?

    func synchronize(feeds: [WidgetFeed]?) async {
        let previous = operation
        let task = Task { [weak self] in
            await previous?.value
            guard let self else { return }
            await self.reconcile(feeds: feeds)
        }
        operation = task
        await task.value
    }

    private func reconcile(feeds: [WidgetFeed]?) async {
        let now = Date()
        guard let feeds else {
            for activity in Activity<ClassActivityAttributes>.activities {
                let dayEnd = activity.content.state.day?.dayEnd ?? activity.content.state.lesson.dayEnd
                if dayEnd <= now || !ActivityAuthorizationInfo().areActivitiesEnabled { await finish(activity) }
            }
            return
        }
        let days = ClassActivityPlan.days(from: feeds, now: now)
        dismissed.formIntersection(Set(days.map(\.id)))
        for activity in Activity<ClassActivityAttributes>.activities where activity.activityState == .dismissed {
            dismissed.insert(activity.attributes.lessonID)
        }
        UserDefaults.standard.set(Array(dismissed), forKey: "classActivity.dismissedDays")

        var desired: [ClassActivityDay] = []
        if ActivityAuthorizationInfo().areActivitiesEnabled {
            // One stable ID for today; changing class/phase never requests another card.
            if let today = days.first(where: { ClassActivityPlan.calendar.isDate($0.start, inSameDayAs: now) }),
               !dismissed.contains(today.id) {
                desired.append(today)
            }
            if #available(iOS 26.0, *) {
                // At most one pending card for tomorrow, never a queue of classes.
                if let tomorrow = days.first(where: {
                    !ClassActivityPlan.calendar.isDate($0.start, inSameDayAs: now) && $0.start > now
                }), !dismissed.contains(tomorrow.id) {
                    desired.append(tomorrow)
                }
            }
        }

        var retained = Set<String>()
        for activity in Activity<ClassActivityAttributes>.activities {
            let id = activity.attributes.lessonID
            guard let day = desired.first(where: { $0.id == id }), !retained.contains(id),
                  activity.activityState != .ended, activity.activityState != .dismissed else {
                // Also removes cards created by older per-class versions.
                await finish(activity)
                continue
            }
            if #available(iOS 26.0, *), activity.activityState == .pending,
               activity.content.state.day?.start != day.start {
                await finish(activity)
                continue
            }
            retained.insert(id)
            let state = makeState(day: day, now: now)
            guard validate(state) else { continue }
            let boundary = day.nextBoundary(after: now)
            if activity.content.state != state || activity.content.staleDate != boundary {
                await activity.update(ActivityContent(state: state, staleDate: boundary))
            }
        }

        guard UIApplication.shared.applicationState == .active, Date() >= retryAfter else { return }
        for day in desired where !retained.contains(day.id) {
            let scheduled = !ClassActivityPlan.calendar.isDate(day.start, inSameDayAs: now)
            let effectiveNow = scheduled ? day.start : now
            let state = makeState(day: day, now: effectiveNow)
            guard validate(state) else { continue }
            let content = ActivityContent(state: state, staleDate: day.nextBoundary(after: effectiveNow))
            do {
                if !scheduled {
                    _ = try Activity<ClassActivityAttributes>.request(
                        attributes: ClassActivityAttributes(lessonID: day.id), content: content, pushType: nil
                    )
                } else if #available(iOS 26.0, *) {
                    _ = try Activity<ClassActivityAttributes>.request(
                        attributes: ClassActivityAttributes(lessonID: day.id),
                        content: content, pushType: nil, style: .standard,
                        alertConfiguration: AlertConfiguration(
                            title: "Учебный день начинается", body: "Расписание дня — на экране блокировки.", sound: .default
                        ), start: day.start
                    )
                }
            } catch {
                retryAfter = Date().addingTimeInterval(60)
                onError?(error.localizedDescription)
                break
            }
        }
    }

    private func makeState(day: ClassActivityDay, now: Date) -> ClassActivityAttributes.ContentState {
        ClassActivityAttributes.ContentState(lesson: day.presentation(at: now), day: day)
    }

    private func validate(_ state: ClassActivityAttributes.ContentState) -> Bool {
        // ActivityKit caps attributes + state at 4 KB. Never silently drop classes.
        guard let data = try? JSONEncoder().encode(state), data.count <= 3600 else {
            if Date() >= retryAfter {
                retryAfter = Date().addingTimeInterval(60)
                onError?("Расписание дня слишком большое для Live Activity.")
            }
            return false
        }
        return true
    }

    private func finish(_ activity: Activity<ClassActivityAttributes>) async {
        var state = activity.content.state
        state.ended = true
        await activity.end(ActivityContent(state: state, staleDate: nil), dismissalPolicy: .immediate)
    }
}
