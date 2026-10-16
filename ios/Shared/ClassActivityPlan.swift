import Foundation

/// Dates in the university feed are wall-clock times in Minsk, not the phone's zone.
struct ClassActivityLesson: Codable, Hashable, Identifiable {
    let id: String
    let profileID: String
    let title: String
    let subtitle: String
    let start: Date
    let end: Date
    var appearance: WidgetAppearance? = nil
    var nextStart: Date? = nil
    var nextTitle: String? = nil

    enum Phase { case lesson, breakTime, finished }
    var visibleUntil: Date { nextStart ?? end }
    var breakInterval: ClosedRange<Date>? {
        guard let nextStart, nextStart > end else { return nil }
        return end...nextStart
    }
    func phase(at date: Date) -> Phase {
        if date < end { return .lesson }
        if let nextStart, end <= date && date < nextStart { return .breakTime }
        return .finished
    }

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
                      start < end,
                      end.timeIntervalSince(start) <= 8 * 3600 else { continue }
                let id = "\(feed.profile.id)|\(feed.date)|\(event.id)"
                unique[id] = ClassActivityLesson(
                    id: id, profileID: feed.profile.id, title: event.title,
                    subtitle: event.subtitle, start: start, end: end, appearance: feed.appearance
                )
            }
        }
        let sorted = unique.values.sorted {
            $0.start == $1.start ? $0.id < $1.id : $0.start < $1.start
        }
        return sorted.enumerated().compactMap { index, item in
            var lesson = item
            // Only the immediately following class of this profile/day creates a break.
            // Overlapping classes and the overnight gap are not a break.
            if let next = sorted.dropFirst(index + 1).first(where: {
                $0.profileID == item.profileID && calendar.isDate($0.start, inSameDayAs: item.start)
            }), next.start > item.end, next.start.timeIntervalSince(item.start) < 8 * 3600 {
                lesson.nextStart = next.start
                lesson.nextTitle = next.title
            }
            return lesson.visibleUntil > now ? lesson : nil
        }
    }
}
