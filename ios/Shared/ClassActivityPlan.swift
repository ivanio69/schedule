import Foundation

/// Dates in the university feed are wall-clock times in Minsk, not the phone's zone.
struct ClassActivityLesson: Codable, Hashable, Identifiable {
    let id: String
    let profileID: String
    let title: String
    let subtitle: String
    let start: Date
    let end: Date

    var interval: ClosedRange<Date> { start...end }
    func isCurrent(at date: Date) -> Bool { start <= date && date < end }
}

enum ClassActivityPlan {
    static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Minsk")!
        return calendar
    }

    static func lessons(from feeds: [WidgetFeed], now: Date) -> [ClassActivityLesson] {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        formatter.isLenient = false
        var unique: [String: ClassActivityLesson] = [:]
        for feed in feeds {
            for event in feed.events where event.kind == "lesson" && event.status != "cancelled" {
                let startText = "\(feed.date) \(event.start)"
                let endText = "\(feed.date) \(event.end)"
                guard let start = formatter.date(from: startText),
                      let end = formatter.date(from: endText),
                      formatter.string(from: start) == startText,
                      formatter.string(from: end) == endText,
                      start < end, end > now,
                      end.timeIntervalSince(start) <= 8 * 3600 else { continue }
                let id = "\(feed.profile.id)|\(feed.date)|\(event.id)"
                unique[id] = ClassActivityLesson(
                    id: id, profileID: feed.profile.id, title: event.title,
                    subtitle: event.subtitle, start: start, end: end
                )
            }
        }
        return unique.values.sorted {
            $0.start == $1.start ? $0.id < $1.id : $0.start < $1.start
        }
    }
}
