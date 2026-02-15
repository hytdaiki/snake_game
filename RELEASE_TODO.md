# Release TODO (App Store, non-personalized ads + Remove Ads IAP)

Last updated: 2026-02-15

## 1. App Store Connect setup
- [ ] Create/verify App ID, bundle ID, signing, and upload a release build.
- [ ] Fill app metadata (description, keywords, support URL, screenshots).
- [ ] Confirm screenshots match current UI and ad placement.

## 2. In-App Purchase setup
- [ ] Create non-consumable IAP product (example: `snake.remove_ads`).
- [ ] Add localized product display name and description.
- [ ] Provide IAP review screenshot(s) showing where purchase is initiated.
- [ ] Ensure "Restore Purchases" is accessible in Settings.

## 3. Privacy and policy
- [ ] Complete App Privacy questionnaire.
- [ ] Declare no tracking if still true at ship time.
- [ ] Add Privacy Policy URL if any integrated SDK requires it or collects data.

## 4. Review notes (required)
- [ ] Add short gameplay instructions.
- [ ] Explain ad behavior: non-personalized and removable via IAP.
- [ ] Explain exactly where Remove Ads and Restore Purchases are located.
- [ ] Mention expected post-purchase result: ads disappear immediately and stay off.

## 5. QA before submission
- [ ] Fresh install: ad slot visible before purchase.
- [ ] Purchase flow: ads are removed immediately.
- [ ] Relaunch app: ads remain removed.
- [ ] Restore flow on another install/account state behaves correctly.
- [ ] Core gameplay unaffected by ad UI.

## 6. Non-personalized fixed mode simplifications
These are typically unnecessary or simplified under current policy:
- ATT prompt flow: not needed (no tracking).
- IDFA permission messaging: not needed.
- Personalized ad consent UX: not needed.
- Tracking disclosures in review notes: can state tracking is not used.

## 7. Re-check triggers
If any of the following changes, update App Privacy and compliance docs before release:
- Add analytics SDK
- Add ad mediation or new ad network SDK
- Enable personalized ads
- Add account system or backend user profiles
