import ActivityKit
import UIKit

/// All reconciliations are serialized, including disconnects during an update.
@MainActor
final class ClassActivityController {
    private var operation: Task<Void, Never>?
    private var retryAfter = Date.distantPast
    private var dismissed = Set(UserDefaults.standard.stringArray(forKey: "classActivity.dismissed") ?? [])
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
        // Offline cold launch: don't cancel a previously scheduled class just
        // because today's feed hasn't loaded yet. Still clear expired cards.
        guard let feeds else {
            for activity in Activity<ClassActivityAttributes>.activities
                where activity.content.state.lesson.end <= now || !ActivityAuthorizationInfo().areActivitiesEnabled {
                await finish(activity)
            }
            return
        }
        let lessons = ClassActivityPlan.lessons(from: feeds, now: now)
        let validIDs = Set(lessons.map(\.id))
        dismissed.formIntersection(validIDs)
        for activity in Activity<ClassActivityAttributes>.activities where activity.activityState == .dismissed {
            dismissed.insert(activity.attributes.lessonID)
        }
        UserDefaults.standard.set(Array(dismissed), forKey: "classActivity.dismissed")

        var desired: [ClassActivityLesson] = []
        if ActivityAuthorizationInfo().areActivitiesEnabled {
            if let current = lessons.first(where: { $0.isCurrent(at: now) && !dismissed.contains($0.id) }) {
                desired.append(current)
            }
            if #available(iOS 26.0, *) {
                // Leave room for the current class; the OS remains the final capacity authority.
                desired += lessons.filter { $0.start > now && !dismissed.contains($0.id) }.prefix(3)
            }
        }

        var retained = Set<String>()
        for activity in Activity<ClassActivityAttributes>.activities {
            let id = activity.attributes.lessonID
            guard let lesson = desired.first(where: { $0.id == id }),
                  !retained.contains(id),
                  activity.activityState != .ended,
                  activity.activityState != .dismissed else {
                await finish(activity)
                continue
            }
            // A pending request's start date is immutable. Reschedule when moved.
            if #available(iOS 26.0, *), activity.activityState == .pending,
               activity.content.state.lesson.start != lesson.start {
                await finish(activity)
                continue
            }
            retained.insert(id)
            let state = ClassActivityAttributes.ContentState(lesson: lesson)
            if activity.content.state != state {
                await activity.update(ActivityContent(state: state, staleDate: lesson.end, relevanceScore: lesson.start.timeIntervalSince1970))
            }
        }

        // Requests are foreground-only. A background network completion may still
        // update/end existing activities, but must not attempt to start new ones.
        guard UIApplication.shared.applicationState == .active, Date() >= retryAfter else { return }
        for lesson in desired where !retained.contains(lesson.id) {
            let content = ActivityContent(
                state: ClassActivityAttributes.ContentState(lesson: lesson),
                staleDate: lesson.end,
                relevanceScore: lesson.start.timeIntervalSince1970
            )
            do {
                if lesson.start <= Date() {
                    guard lesson.end > Date() else { continue }
                    _ = try Activity<ClassActivityAttributes>.request(
                        attributes: ClassActivityAttributes(lessonID: lesson.id), content: content, pushType: nil
                    )
                } else if #available(iOS 26.0, *) {
                    _ = try Activity<ClassActivityAttributes>.request(
                        attributes: ClassActivityAttributes(lessonID: lesson.id),
                        content: content, pushType: nil, style: .standard,
                        alertConfiguration: AlertConfiguration(
                            title: "Начинается пара", body: "Расписание — на экране блокировки.", sound: .default
                        ),
                        start: lesson.start
                    )
                }
            } catch {
                retryAfter = Date().addingTimeInterval(60)
                onError?(error.localizedDescription)
                // Don't flood the system with requests after a capacity/authorization error.
                break
            }
        }
    }

    private func finish(_ activity: Activity<ClassActivityAttributes>) async {
        var state = activity.content.state
        state.ended = true
        await activity.end(ActivityContent(state: state, staleDate: nil), dismissalPolicy: .immediate)
    }
}
