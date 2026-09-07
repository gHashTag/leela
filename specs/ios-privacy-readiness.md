# App Privacy release gate — 2026-09-07

The public App Store listing currently says **Data Not Collected**:
https://apps.apple.com/us/app/leela-chakra-ai/id1296604457

This does not match RevenueCat's required purchase-history disclosure. Its
official guidance requires Purchases / Purchase History for Analytics and App
Functionality. Linkage depends on whether the app can identify the customer;
do not infer tracking or contact-data collection from SDK presence alone.
https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy

Native AI text sharing now has explicit permission and revocation. The public
privacy policy and App Store data-use answers still need to be reconciled with
actual AI provider handling and any enabled account/diagnostic services before
submission. Consent by itself is not a complete privacy declaration.

App Store Connect API signing/build access works, but the public API returns
404 PATH_ERROR for the dataUsages endpoint used by fastlane's web-session
workflow. BrowserOS App Store Connect redirects to login with authResult=FAILED.
The owner has been asked to sign in there; no passwords or 2FA codes requested.

Do not publish a replacement claiming this gate passed. Build/TestFlight
preparation may continue while the browser authentication is pending.
