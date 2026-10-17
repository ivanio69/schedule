import Foundation

@main
struct ClassActivityPlanTests {
    static func main() throws {
        let decoder = JSONDecoder()
        func feed(_ events: String, date: String = "2026-10-06", profile: String = "p1") throws -> WidgetFeed {
            let json = """
            {"profile":{"id":"\(profile)","name":"Test"},"date":"\(date)","events":[\(events)],"freeAt":null,"appearance":{"theme":"dark","appAccentMode":"manual","appAccent":"mint","rehearsalAccent":"amber","individualAccent":"rose","seminarAccent":"violet"},"generatedAt":"2026-10-06T05:00:00Z"}
            """
            return try decoder.decode(WidgetFeed.self, from: Data(json.utf8))
        }
        func event(id: String = "1", kind: String = "lesson", status: String = "normal", start: String = "09:00", end: String = "10:30") -> String {
            """
            {"id":"\(id)","kind":"\(kind)","status":"\(status)","title":"Режиссура","subtitle":"Ауд. 214","start":"\(start)","end":"\(end)"}
            """
        }
        let now = ISO8601DateFormatter().date(from: "2026-10-06T06:00:00Z")!
        let standard = try feed(event())
        let lesson = ClassActivityPlan.lessons(from: [standard], now: now)[0]
        precondition(lesson.appearance?.appAccent == "mint", "Profile accent reaches Live Activity")
        precondition(lesson.appearance?.theme == "dark", "Profile theme reaches Live Activity")
        let encoded = try JSONEncoder().encode(lesson)
        var legacy = try JSONSerialization.jsonObject(with: encoded) as! [String: Any]
        legacy.removeValue(forKey: "appearance")
        legacy.removeValue(forKey: "nextClass")
        legacy.removeValue(forKey: "lastClassEnd")
        let legacyLesson = try decoder.decode(ClassActivityLesson.self, from: JSONSerialization.data(withJSONObject: legacy))
        precondition(legacyLesson.appearance == nil, "Existing Activity payloads remain decodable")
        precondition(lesson.start == now, "Feed uses Minsk time regardless of device timezone")
        precondition(lesson.isCurrent(at: now), "Start is inclusive")
        precondition(!lesson.isCurrent(at: lesson.end), "End is exclusive")
        precondition(ClassActivityPlan.lessons(from: [standard], now: lesson.end).count == 1, "Final card survives the class")
        precondition(lesson.phase(at: lesson.end) == .dayFinished)
        precondition(ClassActivityPlan.lessons(from: [standard], now: lesson.dayEnd).isEmpty, "Yesterday is cleared")
        precondition(ClassActivityPlan.lessons(from: [standard, standard], now: now).count == 1)
        let filtered = try feed([event(status: "cancelled"), event(id: "2", kind: "rehearsal"), event(id: "3", kind: "individual"), event(id: "4", start: "25:00"), event(id: "5", end: "08:00")].joined(separator: ","))
        precondition(ClassActivityPlan.lessons(from: [filtered], now: now).isEmpty)
        let moved = try feed(event(status: "moved", start: "11:00", end: "12:30"))
        precondition(ClassActivityPlan.lessons(from: [moved], now: now).count == 1, "Moved feed event has destination time")
        let tomorrow = try feed(event(), date: "2026-10-07")
        precondition(ClassActivityPlan.lessons(from: [standard, tomorrow], now: now).count == 2)
        let otherProfile = try feed(event(), profile: "p2")
        precondition(ClassActivityPlan.lessons(from: [standard, otherProfile], now: now).count == 2)
        let invalid = try feed(event(), date: "2026-02-30")
        precondition(ClassActivityPlan.lessons(from: [invalid], now: now).isEmpty)
        precondition(lesson.breakInterval?.lowerBound == lesson.start.addingTimeInterval(40 * 60))
        precondition(lesson.breakInterval?.upperBound == lesson.start.addingTimeInterval(45 * 60))
        precondition(lesson.breakInterval!.upperBound.timeIntervalSince(lesson.breakInterval!.lowerBound) == 300)
        let shortClass = try feed(event(end: "09:40"))
        precondition(ClassActivityPlan.lessons(from: [shortClass], now: now)[0].breakInterval == nil)
        let singlePeriod = try feed(event(end: "09:45"))
        precondition(ClassActivityPlan.lessons(from: [singlePeriod], now: now)[0].breakInterval == nil)
        let movedClass = ClassActivityPlan.lessons(from: [moved], now: now)[0]
        precondition(movedClass.breakInterval?.lowerBound == movedClass.start.addingTimeInterval(40 * 60))
        let twoClasses = try feed([event(), event(id: "next", start: "11:00", end: "12:30")].joined(separator: ","))
        let pair = ClassActivityPlan.lessons(from: [twoClasses], now: now)
        precondition(pair[0].phase(at: pair[0].end.addingTimeInterval(-1)) == .lesson)
        precondition(pair[0].phase(at: pair[0].end) == .betweenClasses)
        precondition(pair[0].nextClass?.start == pair[1].start)
        precondition(pair[0].countdownInterval(for: .betweenClasses) == pair[0].end...pair[1].start)
        precondition(pair[0].phase(at: pair[1].start) == .nextStarted)
        precondition(pair[0].phase(at: pair[1].end) == .dayFinished)
        precondition(pair[1].phase(at: pair[1].end) == .dayFinished)
        precondition(ClassActivityPlan.lessons(from: [twoClasses], now: pair[0].end).count == 2)
        precondition(ClassActivityPlan.lessons(from: [standard, tomorrow], now: now)[0].nextClass == nil, "No overnight countdown")
        let cancelledLater = try feed([event(), event(id: "cancelled", status: "cancelled", start: "11:00", end: "12:30")].joined(separator: ","))
        let last = ClassActivityPlan.lessons(from: [cancelledLater], now: now)[0]
        precondition(last.nextClass == nil && last.phase(at: last.end) == .dayFinished)
        let overlapping = try feed([event(), event(id: "overlap", start: "10:00", end: "11:00")].joined(separator: ","))
        let overlap = ClassActivityPlan.lessons(from: [overlapping], now: now)[0]
        precondition(overlap.nextClass == nil && overlap.phase(at: overlap.end) == .nextStarted, "An overlapping active class is not end of day")
        let day = ClassActivityPlan.days(from: [twoClasses], now: now)[0]
        let early = now.addingTimeInterval(-1800)
        precondition(day.presentation(at: early).phase(at: early) == .beforeClasses)
        precondition(day.nextBoundary(after: early) == pair[0].start)
        precondition(day.nextBoundary(after: pair[0].start) == pair[0].end)
        precondition(day.presentation(at: pair[0].end).phase(at: pair[0].end) == .betweenClasses)
        precondition(day.nextBoundary(after: pair[0].end) == pair[1].start)
        precondition(day.presentation(at: pair[1].start).id == pair[1].id, "One daily snapshot selects the next class")
        precondition(day.presentation(at: pair[1].end).phase(at: pair[1].end) == .dayFinished)
        precondition(day.nextBoundary(after: pair[1].end) == nil)
        let dayAfterBreak = ClassActivityPlan.days(from: [twoClasses], now: pair[1].start)[0]
        precondition(day.id == dayAfterBreak.id, "Identity remains stable across every class")
        precondition(day.entries == dayAfterBreak.entries, "Complete schedule survives phase changes")
        precondition(ClassActivityPlan.days(from: [twoClasses, tomorrow], now: now).count == 2, "One record per day, not per class")
        precondition(ClassActivityPlan.days(from: [twoClasses], now: day.dayEnd).isEmpty)
        let roundTripDay = try decoder.decode(ClassActivityDay.self, from: JSONEncoder().encode(day))
        precondition(roundTripDay == day)
        let otherDay = ClassActivityPlan.days(from: [otherProfile], now: now)[0]
        precondition(otherDay.id != day.id)
        print("ClassActivityPlan: all cases passed")
    }
}
