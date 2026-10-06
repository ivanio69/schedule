import ActivityKit
import Foundation

struct ClassActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        let lesson: ClassActivityLesson
        var ended = false
    }

    /// Identity is immutable; title, room and timing can be updated in-place.
    let lessonID: String
}
