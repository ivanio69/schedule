import SwiftUI
import UIKit
import WebKit

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @EnvironmentObject private var connection: WidgetConnectionModel

    var body: some View {
        WebAppView(url: connection.webDestination, connection: connection)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(.systemBackground))
            .ignoresSafeArea(.container, edges: .all)
            .task(id: scenePhase) {
                if scenePhase == .active { await connection.runForegroundUpdates() }
            }
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
        configuration.userContentController.addUserScript(WKUserScript(source: """
        (() => {
            if (location.hostname !== "\(WidgetEnvironment.productionBaseURL.host ?? "")") return;
            let viewport = document.querySelector('meta[name="viewport"]');
            if (!viewport) {
                viewport = document.createElement('meta');
                viewport.name = 'viewport';
                viewport.content = 'width=device-width, initial-scale=1';
                document.head.appendChild(viewport);
            }
            const existing = viewport.content.replace(/,?\\s*viewport-fit=[^,]*/g, '');
            viewport.content = existing + ', viewport-fit=cover';
            const style = document.createElement('style');
            style.textContent = `html { min-height: 100%; } body {
                box-sizing: border-box; min-height: 100dvh;
                padding-top: calc(env(safe-area-inset-top, 0px) + 12px);
                padding-left: env(safe-area-inset-left);
                padding-right: env(safe-area-inset-right);
            }`;
            document.head.appendChild(style);
        })();
        """, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        configuration.userContentController.add(context.coordinator, name: "scheduleWidget")

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.contentInset = .zero
        webView.scrollView.scrollIndicatorInsets = .zero
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
            if webView.url != url {
                webView.load(URLRequest(url: url))
            } else {
                webView.reload()
            }
        }
        if context.coordinator.lastBridgeRevision != connection.nativeBridgeRevision {
            context.coordinator.lastBridgeRevision = connection.nativeBridgeRevision
            context.coordinator.publishNativeState()
        }
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "scheduleWidget")
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        let connection: WidgetConnectionModel
        weak var webView: WKWebView?
        var lastReloadRevision = 0
        var lastBridgeRevision = -1

        init(connection: WidgetConnectionModel) {
            self.connection = connection
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard message.name == "scheduleWidget",
                  message.frameInfo.isMainFrame,
                  message.frameInfo.securityOrigin.protocol == "https",
                  message.frameInfo.securityOrigin.host == WidgetEnvironment.productionBaseURL.host,
                  let payload = message.body as? [String: Any] else { return }

            if payload["type"] as? String == "bridge-ready" {
                publishNativeState()
                return
            }

            guard let token = payload["token"] as? String, !token.isEmpty else { return }
            let profileName = payload["profileName"] as? String ?? ""
            Task { @MainActor in
                connection.accept(token: token, profileName: profileName)
            }
        }

        func publishNativeState() {
            guard let webView else { return }
            Task { @MainActor in
                let payload = connection.bridgePayload()
                guard JSONSerialization.isValidJSONObject(payload),
                      let data = try? JSONSerialization.data(withJSONObject: payload),
                      let json = String(data: data, encoding: .utf8) else { return }
                let script = """
                window.__scheduleNativeState = \(json);
                window.dispatchEvent(new CustomEvent("schedule-native-state", { detail: window.__scheduleNativeState }));
                """
                webView.evaluateJavaScript(script)
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            publishNativeState()
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            Task { @MainActor in
                connection.reportNativeError(source: "webview", code: "webview.navigation", message: error.localizedDescription)
            }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            Task { @MainActor in
                connection.reportNativeError(source: "webview", code: "webview.provisional", message: error.localizedDescription)
            }
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            Task { @MainActor in
                connection.reportNativeError(source: "webview", code: "webview.process", message: "WebView process terminated")
            }
            webView.reload()
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
