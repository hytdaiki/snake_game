import Foundation
import StoreKit
import WebKit

@MainActor
final class SnakeStoreKitBridge: NSObject {
    private enum BridgeError: LocalizedError {
        case malformedRequest
        case unsupportedMethod(String)
        case bridgeUnavailable
        case productNotFound(String)
        case purchasePending
        case purchaseCancelled
        case verificationFailed

        var errorDescription: String? {
            switch self {
            case .malformedRequest:
                return "Malformed bridge request"
            case .unsupportedMethod(let method):
                return "Unsupported method: \(method)"
            case .bridgeUnavailable:
                return "Bridge unavailable"
            case .productNotFound(let productID):
                return "Product not found: \(productID)"
            case .purchasePending:
                return "Purchase is pending"
            case .purchaseCancelled:
                return "Purchase was cancelled"
            case .verificationFailed:
                return "Transaction verification failed"
            }
        }
    }

    private static let messageHandlerName = "snakeStoreKitBridge"
    private static let entitlementEventName = "snake-storekit-entitlement"

    private let productID: String
    private let entitlementDefaultsKey = "snake_ads_removed_native_v1"

    private weak var webView: WKWebView?
    private var transactionObserverTask: Task<Void, Never>?

    init(productID: String = "snake.remove_ads") {
        self.productID = productID
        super.init()
    }

    deinit {
        transactionObserverTask?.cancel()
    }

    func install(on webView: WKWebView) {
        self.webView = webView
        let userContentController = webView.configuration.userContentController

        userContentController.removeScriptMessageHandler(forName: Self.messageHandlerName)
        userContentController.add(self, name: Self.messageHandlerName)

        let script = WKUserScript(
            source: Self.injectedBridgeScript(handlerName: Self.messageHandlerName,
                                              entitlementEventName: Self.entitlementEventName),
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        userContentController.addUserScript(script)
    }

    func uninstall() {
        guard let webView else { return }
        webView.configuration.userContentController.removeScriptMessageHandler(forName: Self.messageHandlerName)
        self.webView = nil
    }

    func startTransactionObserver() {
        if transactionObserverTask != nil { return }
        transactionObserverTask = Task { [weak self] in
            guard let self else { return }
            for await result in Transaction.updates {
                guard !Task.isCancelled else { return }
                do {
                    let transaction = try self.verify(result)
                    if transaction.productID == self.productID {
                        self.saveEntitlement(true)
                        await self.pushEntitlementToWeb(adsRemoved: true)
                    }
                    await transaction.finish()
                } catch {
                    continue
                }
            }
        }
    }

    func stopTransactionObserver() {
        transactionObserverTask?.cancel()
        transactionObserverTask = nil
    }

    func refreshEntitlementAndPushToWeb() async {
        let adsRemoved = await currentEntitlementStatus()
        await pushEntitlementToWeb(adsRemoved: adsRemoved)
    }

    private static func injectedBridgeScript(handlerName: String, entitlementEventName: String) -> String {
        #"""
        (() => {
          if (window.SnakeStoreKitBridge) return;

          const handler = window.webkit && window.webkit.messageHandlers
            ? window.webkit.messageHandlers["#(handlerName)"]
            : null;
          const pending = new Map();

          function callNative(method) {
            return new Promise((resolve, reject) => {
              if (!handler) {
                reject(new Error("SnakeStoreKitBridge unavailable"));
                return;
              }

              const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
              pending.set(id, { resolve, reject });
              handler.postMessage({ id, method });
            });
          }

          window.__snakeStoreKitBridgeResolve = (id, payload) => {
            const p = pending.get(id);
            if (!p) return;
            pending.delete(id);
            p.resolve(payload);
          };

          window.__snakeStoreKitBridgeReject = (id, message) => {
            const p = pending.get(id);
            if (!p) return;
            pending.delete(id);
            p.reject(new Error(message || "Bridge call failed"));
          };

          window.__snakeStoreKitBridgeNotify = (payload) => {
            window.dispatchEvent(new CustomEvent("#(entitlementEventName)", { detail: payload }));
          };

          window.SnakeStoreKitBridge = {
            getAdsRemovedStatus: () => callNative("getAdsRemovedStatus"),
            purchaseRemoveAds: () => callNative("purchaseRemoveAds"),
            restorePurchases: () => callNative("restorePurchases"),
          };
        })();
        """#
    }

    private func loadCachedEntitlement() -> Bool {
        UserDefaults.standard.bool(forKey: entitlementDefaultsKey)
    }

    private func saveEntitlement(_ adsRemoved: Bool) {
        UserDefaults.standard.set(adsRemoved, forKey: entitlementDefaultsKey)
    }

    private func currentEntitlementStatus() async -> Bool {
        do {
            let active = try await entitlementFromStoreKit()
            saveEntitlement(active)
            return active
        } catch {
            return loadCachedEntitlement()
        }
    }

    private func entitlementFromStoreKit() async throws -> Bool {
        var entitled = false
        for await result in Transaction.currentEntitlements {
            let transaction = try verify(result)
            if transaction.productID == productID,
               transaction.revocationDate == nil {
                entitled = true
                break
            }
        }
        return entitled
    }

    private func purchaseRemoveAds() async throws -> Bool {
        let products = try await Product.products(for: [productID])
        guard let product = products.first else {
            throw BridgeError.productNotFound(productID)
        }

        let purchaseResult = try await product.purchase()
        switch purchaseResult {
        case .success(let verificationResult):
            _ = try verify(verificationResult)
            saveEntitlement(true)
            return true
        case .pending:
            throw BridgeError.purchasePending
        case .userCancelled:
            throw BridgeError.purchaseCancelled
        @unknown default:
            return loadCachedEntitlement()
        }
    }

    private func restorePurchases() async throws -> Bool {
        try await AppStore.sync()
        let adsRemoved = try await entitlementFromStoreKit()
        saveEntitlement(adsRemoved)
        return adsRemoved
    }

    private func verify<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let safe):
            return safe
        case .unverified:
            throw BridgeError.verificationFailed
        }
    }

    private func handleRequest(id: String, method: String) async {
        do {
            let adsRemoved: Bool
            switch method {
            case "getAdsRemovedStatus":
                adsRemoved = await currentEntitlementStatus()
            case "purchaseRemoveAds":
                adsRemoved = try await purchaseRemoveAds()
            case "restorePurchases":
                adsRemoved = try await restorePurchases()
            default:
                throw BridgeError.unsupportedMethod(method)
            }

            let payload: [String: Any] = [
                "adsRemoved": adsRemoved,
                "productID": productID
            ]
            await sendSuccess(id: id, payload: payload)
        } catch {
            await sendFailure(id: id, message: error.localizedDescription)
        }
    }

    private func pushEntitlementToWeb(adsRemoved: Bool) async {
        let payload: [String: Any] = [
            "adsRemoved": adsRemoved,
            "productID": productID
        ]
        guard let webView else { return }
        guard
            let jsonData = try? JSONSerialization.data(withJSONObject: payload),
            let jsonPayload = String(data: jsonData, encoding: .utf8)
        else { return }

        let js = "window.__snakeStoreKitBridgeNotify(\(jsonPayload));"
        _ = try? await webView.evaluateJavaScript(js)
    }

    private func sendSuccess(id: String, payload: [String: Any]) async {
        guard let webView else { return }
        guard
            let jsonData = try? JSONSerialization.data(withJSONObject: payload),
            let jsonPayload = String(data: jsonData, encoding: .utf8),
            let quotedID = jsonStringLiteral(id)
        else {
            await sendFailure(id: id, message: BridgeError.malformedRequest.localizedDescription)
            return
        }

        let js = "window.__snakeStoreKitBridgeResolve(\(quotedID), \(jsonPayload));"
        _ = try? await webView.evaluateJavaScript(js)
    }

    private func sendFailure(id: String, message: String) async {
        guard let webView else { return }
        guard
            let quotedID = jsonStringLiteral(id),
            let quotedMessage = jsonStringLiteral(message)
        else { return }

        let js = "window.__snakeStoreKitBridgeReject(\(quotedID), \(quotedMessage));"
        _ = try? await webView.evaluateJavaScript(js)
    }

    private func jsonStringLiteral(_ raw: String) -> String? {
        guard
            let data = try? JSONSerialization.data(withJSONObject: [raw]),
            let json = String(data: data, encoding: .utf8),
            json.count >= 2
        else {
            return nil
        }
        return String(json.dropFirst().dropLast())
    }
}

extension SnakeStoreKitBridge: WKScriptMessageHandler {
    nonisolated func userContentController(_ userContentController: WKUserContentController,
                                           didReceive message: WKScriptMessage) {
        guard message.name == Self.messageHandlerName else { return }
        guard let body = message.body as? [String: Any] else {
            Task { @MainActor in
                await sendFailure(id: UUID().uuidString, message: BridgeError.malformedRequest.localizedDescription)
            }
            return
        }

        let id = body["id"] as? String ?? UUID().uuidString
        let method = body["method"] as? String

        guard let method else {
            Task { @MainActor in
                await sendFailure(id: id, message: BridgeError.malformedRequest.localizedDescription)
            }
            return
        }

        Task { @MainActor in
            await handleRequest(id: id, method: method)
        }
    }
}
