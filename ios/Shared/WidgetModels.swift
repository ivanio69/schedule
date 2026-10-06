import Foundation

struct WidgetProfile: Codable {
    let id: String
    let name: String
}

struct WidgetAppearance: Codable {
    let theme: String
    let appAccentMode: String
    let appAccent: String
    let rehearsalAccent: String
    let individualAccent: String
    let seminarAccent: String
}

struct WidgetEvent: Codable, Identifiable {
    let id: String
    let kind: String
    let status: String
    let title: String
    let subtitle: String
    let start: String
    let end: String
}

struct WidgetFeed: Codable {
    let profile: WidgetProfile
    let date: String
    let events: [WidgetEvent]
    let freeAt: String?
    let appearance: WidgetAppearance
    let generatedAt: String
}

struct WidgetExchangeResponse: Codable {
    let token: String
    let expiresAt: String
    let profile: WidgetProfile
}
