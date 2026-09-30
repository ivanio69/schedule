import SwiftUI

@main
struct Schedule214App: App {
    @StateObject private var connection = WidgetConnectionModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(connection)
                .onOpenURL { connection.handle(url: $0) }
        }
    }
}
