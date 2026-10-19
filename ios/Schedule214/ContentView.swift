import SwiftUI
import UIKit
import WebKit
import AuthenticationServices
import CryptoKit
import Security

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @EnvironmentObject private var connection: WidgetConnectionModel

    var body: some View {
        WebAppView(url: connection.webDestination, connection: connection)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            // Inset the viewport itself so fixed web headers and menus also
            // stay below the status bar / Dynamic Island.
            .padding(.top, 24)
            .background(Color("LaunchBackground"))
            .ignoresSafeArea(.container, edges: [.horizontal, .bottom])
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
                padding-left: env(safe-area-inset-left);
                padding-right: env(safe-area-inset-right);
            }`;
            document.head.appendChild(style);
        })();
        """, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        configuration.userContentController.add(context.coordinator, name: "scheduleWidget")

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.contentInset = .zero
        webView.scrollView.scrollIndicatorInsets = .zero
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 9/255, green: 9/255, blue: 11/255, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor

        context.coordinator.webView = webView
        webView.load(URLRequest(url: url, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 20))
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

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler, WKUIDelegate, ASWebAuthenticationPresentationContextProviding {
        let connection: WidgetConnectionModel
        weak var webView: WKWebView?
        var lastReloadRevision = 0
        var lastBridgeRevision = -1
        private var authenticationSession: ASWebAuthenticationSession?

        func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
            webView?.window ?? ASPresentationAnchor()
        }

        private func startTelegramLogin(_ destination: URL) {
            guard authenticationSession == nil, webView?.window != nil else { return }
            var bytes = [UInt8](repeating: 0, count: 32)
            guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { return }
            func base64url(_ data: Data) -> String {
                data.base64EncodedString().replacingOccurrences(of: "+", with: "-")
                    .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
            }
            let verifier = base64url(Data(bytes))
            let challenge = base64url(Data(SHA256.hash(data: Data(verifier.utf8))))
            var url = URLComponents(url: destination, resolvingAgainstBaseURL: false)!
            url.queryItems = (url.queryItems ?? []).filter { $0.name != "native_challenge" }
                + [URLQueryItem(name: "native_challenge", value: challenge)]
            guard let startURL = url.url else { return }
            let session = ASWebAuthenticationSession(url: startURL, callbackURLScheme: "schedule214") { [weak self] callback, error in
                Task { @MainActor in
                    guard let self else { return }
                    self.authenticationSession = nil
                    if let error {
                        if (error as? ASWebAuthenticationSessionError)?.code != .canceledLogin {
                            self.connection.reportNativeError(source: "ios", code: "auth.telegram", message: "Не удалось завершить вход через Telegram.")
                        }
                        return
                    }
                    guard let callback, callback.scheme == "schedule214", callback.host == "auth", callback.path == "/callback",
                          let values = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems else { return }
                    guard let code = values.first(where: { $0.name == "code" })?.value,
                          code.count == 43, code.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-" || $0 == "_") }) else {
                        self.webView?.load(URLRequest(url: WidgetEnvironment.productionBaseURL.appending(path: "login").appending(queryItems: [URLQueryItem(name: "openid_error", value: "telegram_denied")])))
                        return
                    }
                    // Set HttpOnly session cookies directly in WKWebView. No session token in a deep link.
                    var request = URLRequest(url: WidgetEnvironment.productionBaseURL.appending(path: "api/auth/native/complete"))
                    request.httpMethod = "POST"
                    request.cachePolicy = .reloadIgnoringLocalCacheData
                    request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
                    request.setValue("1", forHTTPHeaderField: "X-Schedule-Native-Auth")
                    request.setValue(WidgetEnvironment.productionBaseURL.absoluteString, forHTTPHeaderField: "Origin")
                    request.httpBody = Data("code=\(code)&verifier=\(verifier)".utf8)
                    self.webView?.load(request)
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = true
            authenticationSession = session
            if !session.start() { authenticationSession = nil }
        }

        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if navigationAction.targetFrame == nil { webView.load(navigationAction.request) }
            return nil
        }

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

            if destination.scheme == "https", destination.host == WidgetEnvironment.productionBaseURL.host,
               destination.path == "/api/auth/openid/start" {
                decisionHandler(.cancel)
                startTelegramLogin(destination)
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
