import Foundation

@main
struct WidgetStoreTests {
    static func main() {
        // This executable runs only on the isolated CI runner, never in the app.
        WidgetStore.clear()
        defer { WidgetStore.clear() }
        let date = ISO8601DateFormatter().date(from: "2026-12-31T21:30:00Z")!
        precondition(WidgetStore.dateKey(date) == "2027-01-01", "Cache keys use the schedule's timezone, not the device's")
        let appearance = WidgetAppearance(theme: "dark", appAccentMode: "manual", appAccent: "mint", rehearsalAccent: "amber", individualAccent: "rose", seminarAccent: "violet")
        let feed = WidgetFeed(profile: WidgetProfile(id: "first", name: "First"), date: "2027-01-01", events: [], freeAt: nil, appearance: appearance, generatedAt: "2026-12-31T21:30:00Z")
        WidgetStore.save(token: "first-token", profileName: "First")
        WidgetStore.cache(feed: feed)
        precondition(WidgetStore.cachedFeed(for: date)?.profile.id == "first")
        WidgetStore.save(token: "first-token", profileName: "Updated")
        precondition(WidgetStore.cachedFeed(for: date) != nil, "Reconnecting the same token preserves the cache")
        WidgetStore.save(token: "second-token", profileName: "Second")
        precondition(WidgetStore.cachedFeed(for: date) == nil, "A changed token cannot display the previous profile's schedule")
        precondition(WidgetStore.profileName == "Second")
        print("WidgetStore: timezone and profile isolation passed")
    }
}
