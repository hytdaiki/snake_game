# iOS StoreKit 2 Bridge (Skeleton)

This folder contains a native bridge skeleton to replace web mock purchase logic.

## Purpose
- Keep current web UI (`window.SnakeStoreKitBridge`) unchanged.
- Implement Remove Ads IAP (non-consumable) in native iOS with StoreKit 2.
- Expose purchase/restore/status to web app running in `WKWebView`.

## Included
- `SnakeStoreKitBridge.swift`
  - Injects JS bridge object into `WKWebView`
  - Handles message bridge calls:
    - `getAdsRemovedStatus`
    - `purchaseRemoveAds`
    - `restorePurchases`
  - Uses StoreKit 2 for purchase and restore
  - Persists entitlement in `UserDefaults`

## Product configuration
- Product ID default: `snake.remove_ads`
- Product type: **Non-Consumable**

## Xcode integration steps
1. Create iOS app target that hosts this web game in `WKWebView`.
2. Add `SnakeStoreKitBridge.swift` to the target.
3. Enable In-App Purchase capability.
4. Initialize and install bridge after `WKWebView` is created:

```swift
let bridge = SnakeStoreKitBridge(productID: "snake.remove_ads")
bridge.install(on: webView)
bridge.startTransactionObserver()
```

5. (Recommended) On app foreground, refresh entitlement:

```swift
Task { await bridge.refreshEntitlementAndPushToWeb() }
```

## Notes
- This is a skeleton and must be validated in a real iOS project with StoreKit test configuration.
- App Store submission still requires:
  - App Privacy answers in App Store Connect
  - IAP metadata/screenshots
  - Restore flow verification on device/sandbox account
