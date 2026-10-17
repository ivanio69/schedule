import Foundation

enum WidgetEnvironment {
    static let appGroup = "group.com.schedule214.shared"
    static let productionBaseURL = URL(string: "https://schedule-ivanio.vercel.app")!
    static let scheduleURL = productionBaseURL
    static let widgetSetupURL = productionBaseURL.appending(path: "settings")
}
