# SnakeArcadeHost (iOS shell skeleton)

This folder provides a minimal iOS host shell around the existing web game.

## What this skeleton includes
- SwiftUI app entry (`App/`)
- `WKWebView` host loading bundled web assets (`WebRoot/`)
- StoreKit bridge integration via `ios/SnakeStoreKitBridge.swift`
- Remove Ads product wiring (`snake.remove_ads`)

## Xcode setup steps
1. Create a new iOS App project in Xcode (SwiftUI).
2. Add these files from `ios/SnakeArcadeHost/App/` to your target.
3. Add `/Users/aa/Codex_Projects/snake_game/ios/SnakeStoreKitBridge.swift` to your target.
4. Add `ios/SnakeArcadeHost/WebRoot/` as folder reference (blue folder) and ensure target membership is enabled.
5. Enable capability: `In-App Purchase`.
6. Confirm deployment target is iOS 15.0+ (StoreKit 2).

## Runtime flow
- App loads `WebRoot/index.html` in `WKWebView`.
- Web app calls `window.SnakeStoreKitBridge` for:
  - `getAdsRemovedStatus`
  - `purchaseRemoveAds`
  - `restorePurchases`
- Native bridge returns `{ adsRemoved: Bool }` and dispatches entitlement updates.

## Notes
- This is a skeleton, not a full signed release project.
- You still need App Store Connect product setup and sandbox purchase testing.
