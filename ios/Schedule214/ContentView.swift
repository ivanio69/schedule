import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var connection: WidgetConnectionModel

    var body: some View {
        ZStack(alignment: .top) {
            WebAppView(url: WidgetEnvironment.widgetSetupURL, connection: connection)

            if connection.busy {
                HStack(spacing: 8) {
                    ProgressView()
                    Text("Подключаем виджет…")
                        .font(.caption.weight(.semibold))
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 9)
                .background(.ultraThinMaterial, in: Capsule())
                .padding(.top, 8)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .background(Color(.systemBackground))
    }
}
