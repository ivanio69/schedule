import SwiftUI
import UIKit
import WebKit

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

struct WebAppView: UIViewRepresentable {
    let url: URL
    @ObservedObject var connection: WidgetConnectionModel

    func makeCoordinator() -> Coordinator {
        Coordinator(connection: connection)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.userContentController.add(context.coordinator, name: "scheduleWidget")

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        webView.scrollView.backgroundColor = .systemBackground

        context.coordinator.webView = webView
        webView.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        if context.coordinator.lastReloadRevision != connection.webReloadRevision {
            context.coordinator.lastReloadRevision = connection.webReloadRevision
            webView.reload()
        }
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "scheduleWidget")
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        let connection: WidgetConnectionModel
        weak var webView: WKWebView?
        var lastReloadRevision = 0

        init(connection: WidgetConnectionModel) {
            self.connection = connection
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard message.name == "scheduleWidget",
                  let payload = message.body as? [String: Any],
                  let token = payload["token"] as? String,
                  !token.isEmpty else { return }

            let profileName = payload["profileName"] as? String ?? ""
            Task { @MainActor in
                connection.accept(token: token, profileName: profileName)
            }
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let destination = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            if destination.scheme == "schedule214" {
                connection.handle(url: destination)
                decisionHandler(.cancel)
                return
            }

            if let scheme = destination.scheme?.lowercased(),
               scheme != "http",
               scheme != "https",
               scheme != "about" {
                UIApplication.shared.open(destination)
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
        }
    }
}
