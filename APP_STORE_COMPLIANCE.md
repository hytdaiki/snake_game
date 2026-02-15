# App Store Compliance Log (snake_game)

> Source of truth: Apple App Review Guidelines and Apple Developer docs.
> Last reviewed: 2026-02-15

## Official references
- App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- In-App Purchase overview: https://developer.apple.com/in-app-purchase/
- In-App Purchase configuration in App Store Connect: https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/
- App Privacy details: https://developer.apple.com/app-store/app-privacy-details/
- User privacy and data use: https://developer.apple.com/app-store/user-privacy-and-data-use/

## 0. App summary
- App name: snake_game (working title: Snake Arcade)
- Category: Games (Casual / Arcade)
- Age rating target: 4+
- Platforms: iOS (planned), iPadOS (optional)
- Accounts: none
- User Generated Content: none

## 1. Payments / Monetization
### 1.1 In-App Purchase rule (Guideline 3.1.1)
- Requirement: Digital goods or feature unlocks sold in app must use Apple IAP. Restore is required.
- Our plan:
  - [ ] Ads only (non-personalized)
  - [x] IAP (Remove Ads, non-consumable)
- Product design:
  - Product type: Non-Consumable
  - Product id example: `snake.remove_ads`
  - Entitlement: `adsRemoved=true`
  - Restore: required and visible in app settings
- Evidence:
  - Link to code: `docs/src/index.js`
  - Screenshots: settings screen showing Remove Ads and Restore buttons
- Notes/Risks:
  - Do not ship external payment links for this digital unlock.
  - Ensure restore works before submission.

### 1.2 Ads policy
- Requirement: Ads must not be deceptive, misleading, or block core gameplay.
- Our plan:
  - Non-personalized ad mode only
  - Single banner slot maximum by default
  - Remove Ads IAP hides all in-game ad placements
- Evidence:
  - Link to code: `docs/index.html`, `docs/src/index.js`
- Notes/Risks:
  - Keep ad area clearly labeled and non-clickbait.
  - Avoid accidental taps near movement controls.

## 2. Privacy / Data
### 2.1 Privacy policy availability (Guideline 5.1.1)
- Requirement: If collecting user or usage data, provide clear disclosure and policy as needed.
- Our policy baseline:
  - Tracking: none
  - ATT prompt: not used
  - Personalization: not used
- Data collection target (current plan):
  - [ ] account/profile data
  - [ ] precise location
  - [ ] contacts/photos/messages
  - [ ] cross-app tracking identifiers
  - [ ] custom analytics user profiling
  - [x] local-only preference storage (`localStorage` equivalent in web prototype)
- Evidence:
  - Privacy Policy URL: TBD (required if SDK or backend starts collecting data)
  - App Store Connect App Privacy: complete before release
- Notes/Risks:
  - If ad SDK introduces any collected data categories, update App Privacy answers and policy URL before submit.

### 2.2 Account deletion (Guideline 5.1.1(v))
- Requirement: If account creation exists, account deletion entry point is required in app.
- Our app: no account system (not applicable).

### 2.3 Tracking / ATT
- Requirement: ATT is needed only for tracking as defined by Apple.
- Our plan:
  - No tracking
  - No IDFA dependency
  - No ATT prompt
- Notes/Risks:
  - Re-evaluate only if monetization strategy changes to personalized ads.

## 3. Functionality / Quality checklist
- [ ] No crashes or fatal hangs
- [ ] No broken links/placeholders beyond clearly labeled mock sections
- [ ] Controls are clear and responsive on mobile and desktop
- [ ] Ads do not overlap gameplay controls
- [ ] Remove Ads purchase immediately hides ad slot
- [ ] Restore Purchases correctly restores ad-free state

## 4. Metadata / IP / Legal
- [ ] Screenshots match shipped UI
- [ ] Description clearly states ad-supported with optional Remove Ads purchase
- [ ] Asset licenses documented for all graphics/audio/fonts
- [ ] No third-party marks used without permission

## 5. App Privacy answer template (non-tracking baseline)
Use this as a starting point in App Store Connect, then verify against actual SDK behavior:

- Do you track users across apps/websites?: `No`
- Is ATT prompt used?: `No`
- Data linked to user identity: `None` (unless SDK adds data collection)
- Data used for tracking: `None`
- Third-party advertising data collection: `None` or `Only what provider requires for non-personalized delivery` (must match SDK docs)
- Diagnostics/analytics: `No` by default (set `Yes` only when actually enabled)

## 6. Review Notes template (copy into App Store Connect)
Use the following review note template per build:

- This app is free-to-play with a non-personalized ad placeholder/banner and one non-consumable IAP: Remove Ads.
- Tracking is not used. ATT prompt is not shown.
- IAP product: `snake.remove_ads` (non-consumable).
- How to remove ads: Open Settings (gear) -> tap "Remove Ads".
- How to restore purchases: Open Settings (gear) -> tap "Restore Purchases".
- Expected behavior after successful purchase/restore: ad slot is hidden immediately and remains hidden on next launch.
- If review environment lacks a purchasable account, please validate restore/purchase flow UI and entitlement handling only.

## 7. Release checklist (App Store Connect)
- [ ] Bundle ID, signing, and build upload complete
- [ ] App Privacy questionnaire complete and consistent with implementation
- [ ] Privacy Policy URL set if required by integrated SDKs
- [ ] IAP product created (Remove Ads) with metadata and screenshots
- [ ] Purchase and restore flows tested on device and sandbox account
- [ ] Review notes include gameplay, purchase, restore, and ad behavior
