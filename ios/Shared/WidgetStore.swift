import Foundation

enum WidgetStore {
    private static let tokenKey = "widget.token"
    private static let profileNameKey = "widget.profileName"
    private static let cachedFeedKey = "widget.cachedFeed"

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
        defaults.removeObject(forKey: cachedFeedKey)
    }

    static func cache(feed: WidgetFeed) {
        guard let data = try? JSONEncoder().encode(feed) else { return }
        defaults.set(data, forKey: cachedFeedKey)
    }

    static func cachedFeed() -> WidgetFeed? {
        guard let data = defaults.data(forKey: cachedFeedKey) else { return nil }
        return try? JSONDecoder().decode(WidgetFeed.self, from: data)
    }
}
