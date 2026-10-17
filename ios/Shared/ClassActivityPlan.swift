import Foundation

/// Dates in the university feed are wall-clock times in Minsk, not the phone's zone.
struct ClassActivityLesson: Codable, Hashable, Identifiable {
    let id: String
    let profileID: String
    let title: String
    let subtitle: String
    let start: Date
    let end: Date
    var kind: String? = nil
    var kindTitle: String {
        switch kind {
        case "rehearsal": return "Репетиция"
        case "individual": return "Индивидуальное"
        default: return "Пара"
        }
    }
    var eventSymbol: String {
        switch kind {
        case "rehearsal": return "theatermasks.fill"
        case "individual": return "person.fill"
        default: return "graduationcap.fill"
        }
    }
    var appearance: WidgetAppearance? = nil
    var nextClass: ClassActivityNext? = nil
    var lastClassEnd: Date? = nil

    enum Phase { case beforeClasses, lesson, betweenClasses, dayFinished, nextStarted }
    var dayEnd: Date {
        ClassActivityPlan.calendar.date(byAdding: .day, value: 1, to: ClassActivityPlan.calendar.startOfDay(for: start))!
    }
    var intermissionInterval: ClosedRange<Date>? {
        guard let nextClass, nextClass.start > end else { return nil }
        return end...nextClass.start
    }
    func phase(at date: Date) -> Phase {
        if date < start { return .beforeClasses }
        if date < end { return .lesson }
        if let nextClass, date < nextClass.start { return .betweenClasses }
        return date >= (lastClassEnd ?? end) ? .dayFinished : .nextStarted
    }
    func countdownInterval(for phase: Phase) -> ClosedRange<Date> {
        if phase == .beforeClasses { return ClassActivityPlan.calendar.startOfDay(for: start)...start }
        return phase == .betweenClasses ? intermissionInterval ?? interval : interval
    }

    var interval: ClosedRange<Date> { start...end }
    /// Same five-minute pause as DashboardV2: minutes 40–45 of a full class.
    var breakInterval: ClosedRange<Date>? {
        guard kind == nil || kind == "lesson" else { return nil }
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
    var kind: String? = nil
    var label: String {
        let category = kind == "rehearsal" ? "Репетиция" : kind == "individual" ? "Индивидуальное" : "Пара"
        return "\(category) · \(title)"
    }
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
            for event in feed.events where ["lesson", "rehearsal", "individual"].contains(event.kind) && event.status != "cancelled" {
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
                    subtitle: event.subtitle, start: start, end: end, kind: event.kind, appearance: feed.appearance
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
                lesson.nextClass = ClassActivityNext(title: next.title, start: next.start, kind: next.kind)
            }
            // Preserve today's completed classes so the last card can bridge a
            // gap or show the end-of-day message. Yesterday never resurfaces.
            return lesson.end.addingTimeInterval(3600) > now || calendar.isDate(lesson.start, inSameDayAs: now) ? lesson : nil
        }
    }
}

/// A compact full-day snapshot shared by the app and its single Live Activity.
/// Appearance/profile are stored once, rather than repeated for every class.
struct ClassActivityDay: Codable, Hashable, Identifiable {
    struct Entry: Codable, Hashable {
        let id: String
        let title: String
        let subtitle: String
        let start: Date
        let end: Date
        var kind: String? = nil
    }

    let profileID: String
    let date: String
    let appearance: WidgetAppearance?
    let entries: [Entry]

    var id: String { "day:\(profileID):\(date)" }
    var start: Date { entries[0].start }
    var lastEventEnd: Date { entries.map(\.end).max()! }
    var dismissalDate: Date { lastEventEnd.addingTimeInterval(3600) }
    var dayEnd: Date {
        ClassActivityPlan.calendar.date(byAdding: .day, value: 1,
            to: ClassActivityPlan.calendar.startOfDay(for: start))!
    }

    func presentation(at now: Date) -> ClassActivityLesson {
        let entry = entries.last(where: { $0.start <= now && now < $0.end })
            ?? entries.last(where: { $0.start <= now }) ?? entries[0]
        let next = entries.first(where: { $0.start >= entry.end && $0.id != entry.id })
        return ClassActivityLesson(
            id: entry.id, profileID: profileID, title: entry.title, subtitle: entry.subtitle,
            start: entry.start, end: entry.end, kind: entry.kind, appearance: appearance,
            nextClass: next.map { ClassActivityNext(title: $0.title, start: $0.start, kind: $0.kind) },
            lastClassEnd: lastEventEnd
        )
    }

    func nextBoundary(after now: Date) -> Date? {
        entries.flatMap { [$0.start, $0.end] }.filter { $0 > now }.min()
    }
}

extension ClassActivityPlan {
    static func days(from feeds: [WidgetFeed], now: Date) -> [ClassActivityDay] {
        let lessons = lessons(from: feeds, now: now)
        let groups = Dictionary(grouping: lessons) { lesson in
            let formatter = DateFormatter()
            formatter.calendar = calendar
            formatter.timeZone = calendar.timeZone
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "yyyy-MM-dd"
            return "\(lesson.profileID)|\(formatter.string(from: lesson.start))"
        }
        return groups.values.compactMap { group -> ClassActivityDay? in
            let sorted = group.sorted { $0.start == $1.start ? $0.id < $1.id : $0.start < $1.start }
            guard let first = sorted.first else { return nil }
            let formatter = DateFormatter()
            formatter.calendar = calendar
            formatter.timeZone = calendar.timeZone
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "yyyy-MM-dd"
            let day = ClassActivityDay(profileID: first.profileID, date: formatter.string(from: first.start),
                appearance: first.appearance,
                entries: sorted.map { .init(id: $0.id, title: $0.title, subtitle: $0.subtitle, start: $0.start, end: $0.end, kind: $0.kind) })
            return day.dismissalDate > now ? day : nil
        }.sorted { $0.start == $1.start ? $0.id < $1.id : $0.start < $1.start }
    }
}
