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
    var nextClass: ClassActivityNext? = nil
    var lastClassEnd: Date? = nil

    enum Phase { case lesson, betweenClasses, dayFinished, nextStarted }
    var dayEnd: Date {
        ClassActivityPlan.calendar.date(byAdding: .day, value: 1, to: ClassActivityPlan.calendar.startOfDay(for: start))!
    }
    var intermissionInterval: ClosedRange<Date>? {
        guard let nextClass, nextClass.start > end else { return nil }
        return end...nextClass.start
    }
    func phase(at date: Date) -> Phase {
        if date < end { return .lesson }
        if let nextClass, date < nextClass.start { return .betweenClasses }
        return date >= (lastClassEnd ?? end) ? .dayFinished : .nextStarted
    }
    func countdownInterval(for phase: Phase) -> ClosedRange<Date> {
        phase == .betweenClasses ? intermissionInterval ?? interval : interval
    }

    var interval: ClosedRange<Date> { start...end }
    /// Same five-minute pause as DashboardV2: minutes 40–45 of a full class.
    var breakInterval: ClosedRange<Date>? {
        let breakStart = start.addingTimeInterval(40 * 60)
        let breakEnd = start.addingTimeInterval(45 * 60)
        guard breakEnd < end else { return nil }
        return breakStart...breakEnd
    }
    func isCurrent(at date: Date) -> Bool { start <= date && date < end }
}

struct ClassActivityNext: Codable, Hashable {
    let title: String
    let start: Date
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
            let sameDay = sorted.filter {
                $0.profileID == item.profileID && calendar.isDate($0.start, inSameDayAs: item.start)
            }
            lesson.lastClassEnd = sameDay.map(\.end).max()
            if let next = sorted.dropFirst(index + 1).first(where: {
                $0.profileID == item.profileID && calendar.isDate($0.start, inSameDayAs: item.start)
            }), next.start >= item.end {
                lesson.nextClass = ClassActivityNext(title: next.title, start: next.start)
            }
            // Preserve today's completed classes so the last card can bridge a
            // gap or show the end-of-day message. Yesterday never resurfaces.
            return lesson.end > now || calendar.isDate(lesson.start, inSameDayAs: now) ? lesson : nil
        }
    }
}
