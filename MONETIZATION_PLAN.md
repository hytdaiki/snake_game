# Monetization Plan (snake_game)

Last updated: 2026-02-15

## Scope
This plan fixes the first release monetization to:
- Free app
- Non-personalized ads only
- One-time IAP to remove ads permanently

No tracking-based monetization is in scope.

## Design principles
- Keep gameplay first: controls and board remain primary.
- Keep ads minimal: one banner slot maximum in normal play surfaces.
- Keep consent simple: no ATT prompt because tracking is not used.
- Keep implementation replaceable: web mock functions map cleanly to StoreKit implementation later.

## Ad strategy (phase 1)
- Format: single banner slot only (placeholder in current web build).
- Placement: outside critical controls; never cover D-pad or pause/new game actions.
- Frequency: static slot display only.
- Deferred formats: interstitial and rewarded ads are out of phase 1.

## IAP strategy (Remove Ads)
- Product: non-consumable (buy once, permanent).
- Entitlement flag: `adsRemoved`.
- Behavior:
  - `adsRemoved=false` -> show ad slot.
  - `adsRemoved=true` -> hide all ad placements.
- Restore Purchases: required in Settings.
- Persistence:
  - Web mock: local storage key `snake_ads_removed_v1`.
  - Native app: secure persisted entitlement synced with Apple receipt validation strategy.

## Implementation boundary (current repo)
- Current code is a mock integration boundary, not StoreKit.
- Interface methods reserved for native replacement:
  - `purchaseRemoveAds()`
  - `restorePurchases()`
- Current mock behavior:
  - Purchase sets `adsRemoved=true`.
  - Restore reads current persisted entitlement state.

## Out of scope for this phase
- Personalized ads
- ATT prompt flow
- IDFA-based attribution
- Subscription products
- Cross-device entitlement sync backend

## Success criteria
- User can remove ads from settings with one tap in mock mode.
- User can restore purchases from settings.
- Ad slot visibility always matches `adsRemoved`.
- App review metadata can be answered without ATT or tracking dependencies.
