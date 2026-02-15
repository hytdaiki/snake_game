import SwiftUI
import WebKit

struct SnakeWebViewContainer: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false
        webView.navigationDelegate = context.coordinator

        context.coordinator.install(on: webView)
        context.coordinator.loadGame(on: webView)

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // No-op: this container is state-light and driven by web content.
    }

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        coordinator.uninstall()
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        private let bridge = SnakeStoreKitBridge(productID: SnakeHostConfig.removeAdsProductID)

        func install(on webView: WKWebView) {
            bridge.install(on: webView)
            bridge.startTransactionObserver()
            Task { await bridge.refreshEntitlementAndPushToWeb() }
        }

        func uninstall() {
            bridge.stopTransactionObserver()
            bridge.uninstall()
        }

        func loadGame(on webView: WKWebView) {
            if let localIndexURL = Bundle.main.url(
                forResource: "index",
                withExtension: "html",
                subdirectory: SnakeHostConfig.webRootDirectoryName
            ) {
                let readAccessURL = localIndexURL.deletingLastPathComponent()
                webView.loadFileURL(localIndexURL, allowingReadAccessTo: readAccessURL)
                return
            }

            guard let fallbackURL = SnakeHostConfig.remoteFallbackURL else { return }
            webView.load(URLRequest(url: fallbackURL))
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            Task { await bridge.refreshEntitlementAndPushToWeb() }
        }
    }
}
