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
        precondition(lesson.start == now, "Feed uses Minsk time regardless of device timezone")
        precondition(lesson.isCurrent(at: now), "Start is inclusive")
        precondition(!lesson.isCurrent(at: lesson.end), "End is exclusive")
        precondition(ClassActivityPlan.lessons(from: [standard], now: lesson.end).isEmpty)
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
        print("ClassActivityPlan: all cases passed")
    }
}
