import Foundation

enum WidgetStore {
    private static let tokenKey = "widget.token"
    private static let profileNameKey = "widget.profileName"
    private static let cachedFeedPrefix = "widget.cachedFeed."

    private static var defaults: UserDefaults {
        UserDefaults(suiteName: WidgetEnvironment.appGroup) ?? .standard
    }

    static var token: String? {
        defaults.string(forKey: tokenKey)
    }

    static var profileName: String? {
        defaults.string(forKey: profileNameKey)
    }

    static func save(token: String, profileName: String) {
        defaults.set(token, forKey: tokenKey)
        defaults.set(profileName, forKey: profileNameKey)
    }

    static func clear() {
        defaults.removeObject(forKey: tokenKey)
        defaults.removeObject(forKey: profileNameKey)

        for key in defaults.dictionaryRepresentation().keys where key.hasPrefix(cachedFeedPrefix) {
            defaults.removeObject(forKey: key)
        }
        // Remove the old single-day cache from dev7–dev13.
        defaults.removeObject(forKey: "widget.cachedFeed")
    }

    static func cache(feed: WidgetFeed) {
        guard let data = try? JSONEncoder().encode(feed) else { return }
        defaults.set(data, forKey: cachedFeedPrefix + feed.date)
        trimFeedCache(keeping: 4)
    }

    static func cachedFeed(for date: Date) -> WidgetFeed? {
        cachedFeed(forDateKey: dateKey(date))
    }

    static func cachedFeed(forDateKey date: String) -> WidgetFeed? {
        guard let data = defaults.data(forKey: cachedFeedPrefix + date),
              let feed = try? JSONDecoder().decode(WidgetFeed.self, from: data),
              feed.date == date else { return nil }
        return feed
    }

    static func dateKey(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private static func trimFeedCache(keeping limit: Int) {
        let keys = defaults.dictionaryRepresentation().keys
            .filter { $0.hasPrefix(cachedFeedPrefix) }
            .sorted()
        guard keys.count > limit else { return }
        for key in keys.prefix(keys.count - limit) {
            defaults.removeObject(forKey: key)
        }
    }
}
