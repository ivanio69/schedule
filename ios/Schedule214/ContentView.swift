import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var connection: WidgetConnectionModel
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 22) {
                HStack(spacing: 14) {
                    Text("214Р")
                        .font(.system(size: 17, weight: .black, design: .rounded))
                        .frame(width: 58, height: 58)
                        .foregroundStyle(.white)
                        .background(.black, in: RoundedRectangle(cornerRadius: 17, style: .continuous))

                    VStack(alignment: .leading, spacing: 3) {
                        Text("Расписание")
                            .font(.title2.bold())
                        Text("iOS companion")
                            .foregroundStyle(.secondary)
                    }
                }

                GroupBox {
                    VStack(alignment: .leading, spacing: 10) {
                        Label(
                            connection.connected ? "Виджет подключён" : "Виджет не подключён",
                            systemImage: connection.connected ? "checkmark.circle.fill" : "iphone.gen3"
                        )
                        .font(.headline)

                        if let name = connection.profileName {
                            Text("Профиль: \(name)")
                                .foregroundStyle(.secondary)
                        } else {
                            Text("Открой веб-приложение → Настройки → Приложение → iOS-виджет и нажми «Подключить iPhone».")
                                .foregroundStyle(.secondary)
                        }

                        if let message = connection.statusMessage {
                            Text(message)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    openURL(WidgetEnvironment.scheduleURL)
                } label: {
                    Label("Открыть расписание", systemImage: "arrow.up.right.square")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)

                if connection.connected {
                    Button(role: .destructive) {
                        Task { await connection.disconnect() }
                    } label: {
                        Text(connection.busy ? "Подождите…" : "Отключить этот iPhone")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(connection.busy)
                }

                Spacer()
            }
            .padding(20)
            .navigationTitle("214Р")
        }
    }
}
