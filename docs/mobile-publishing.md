# Mobile Publishing Handoff (Story 3.4)

**Status**: App is built and EAS-ready (`mobile/eas.json`, `mobile/app.json`). Actual store submission needs accounts and credentials only you can provide — an AI agent cannot create or hold these.

## What's already done
- `mobile/app.json`: app name "RestoLedger", scheme `restoledger`, placeholder bundle identifiers `com.restoledger.app` (iOS `bundleIdentifier` and Android `package`)
- `mobile/eas.json`: three build profiles — `development` (internal, dev client), `preview` (internal distribution, staging API), `production` (auto-incrementing build number, production API)
- App icons/splash already present from the Expo scaffold (`mobile/assets/`) — replace with RestoLedger branding before a real release

## What you need to do (things I can't do for you)

### 1. Pick real bundle identifiers
`com.restoledger.app` is a placeholder. Change `expo.ios.bundleIdentifier` and `expo.android.package` in `mobile/app.json` to identifiers under a domain you actually control (e.g. `com.yourcompany.restoledger`) — these must be globally unique and can't be changed after first submission.

### 2. Create accounts
- **Expo/EAS account**: https://expo.dev — free tier is enough to start. Run `npx eas login` in `mobile/`.
- **Apple Developer Program**: $99/year, needed for iOS builds and App Store submission — https://developer.apple.com/programs/
- **Google Play Console**: one-time $25 fee — https://play.google.com/console

### 3. Link the project to EAS
```
cd mobile
npx eas init
```
This writes a real `projectId` into `app.json`'s `expo.extra.eas` block (currently absent).

### 4. Set the production API URL
`eas.json`'s `production` profile currently points at a placeholder (`https://api.restoledger.example/api/v1`) — update it once the backend is actually deployed somewhere (Sprint 4 / DevOps).

### 5. Build
```
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
```
First iOS build will prompt EAS to generate/manage signing credentials (or you can supply your own certificates). First Android build similarly generates a keystore — **back it up**, losing it means you can never update the app under that package name again.

### 6. Submit
```
npx eas submit --platform ios
npx eas submit --platform android
```
Requires App Store Connect / Play Console app records to already exist (create them in each console first — app name, screenshots, privacy policy URL, content rating questionnaire, etc. — none of which I can fill in on your behalf since they require your legal/business details).

## Why this is a hard stop for automation
Every step above requires either a payment method, a real identity/business verification (Apple in particular), or credentials that must stay in your control (signing keys — losing them or having them mishandled is a real security incident, not a formality). This is the correct boundary: I built everything up to the point where these become your decisions, not mine.
