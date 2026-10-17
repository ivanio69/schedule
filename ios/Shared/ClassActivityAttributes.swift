import ActivityKit
import Foundation

struct ClassActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        let lesson: ClassActivityLesson
        var ended = false
        var day: ClassActivityDay? = nil

        func presentation(at now: Date) -> ClassActivityLesson {
            day?.presentation(at: now) ?? lesson
        }
    }

    /// Stable profile/day identity. The historical property name lets us clean up
    /// activities from earlier per-class builds during migration.
    let lessonID: String
}
