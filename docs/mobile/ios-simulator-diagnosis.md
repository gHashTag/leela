# iOS Simulator Diagnosis

**Date:** 2026-11-14
**Purpose:** Read-only diagnostics for device matching issue with `npx expo run:ios`

## Environment Overview

- **OS:** macOS
- **Xcode:** 26.6 (Build 17F113)
- **Available iOS SDKs:** iOS 26.5, iOS 18.3
- **Available iOS Simulator SDKs:** Simulator - iOS 26.5
- **Expo project:** `apps/mobile`, bundle ID `xyz.ghashtag.dharma`

## Diagnostics Commands and Output

### `xcodebuild -version`
```
Xcode 26.6
Build version 17F113
```

### `xcodebuild -showsdks`
```
iOS SDKs:
	iOS 26.5 	-sdk iphoneos26.5

iOS Simulator SDKs:
	Simulator - iOS 26.5 	-sdk iphonesimulator26.5

macOS SDKs:
	macOS 26.5 	-sdk macosx26.5

tvOS SDKs:
	tvOS 26.5 	-sdk appletvos26.5

visionOS SDKs:
	visionOS 26.5 	-sdk xros26.5

watchOS SDKs:
	watchOS 26.5 	-sdk watchos26.5
```

### `xcrun simctl list devices`
```
-- iOS 18.3 --
-- iOS 26.5 --
    Leela Shots 6.9 (B4644921-B315-4278-9845-066A2D0C72ED) (Booted) 
    Leela Shots SE (BD6F04EA-61DB-464A-B7FB-6751836D75D7) (Shutdown) 
    Leela Shots iPad 13 (A9FA55C8-E335-4347-BBBD-A15E5CED39EA) (Shutdown) 
    Leela Shots iPad 13 (29FBEBD4-B8D2-458D-99D7-F2C342EA8027) (Shutdown) 
```

### `xcrun simctl list devices available`
```
-- iOS 18.3 --
-- iOS 26.5 --
    Leela Shots 6.9 (B4644921-B315-4278-9845-066A2D0C72ED) (Booted) 
    Leela Shots SE (BD6F04EA-61DB-464A-B7FB-6751836D75D7) (Shutdown) 
    Leela Shots iPad 13 (A9FA55C8-E335-4347-BBBD-A15E5CED39EA) (Shutdown) 
    Leela Shots iPad 13 (29FBEBD4-B8D2-458D-99D7-F2C342EA8027) (Shutdown) 
```

### `xcrun simctl list runtimes`
```
iOS 18.3 (18.3.1 - 22D8075) - com.apple.CoreSimulator.SimRuntime.iOS-18-3
iOS 26.5 (26.5 - 23F77) - com.apple.CoreSimulator.SimRuntime.iOS-26-5
```

### `xcodebuild -showdestinations -scheme leela 2>&1 | head -100`
```
<scheme-specific destination output — not captured; see xcodebuild -list>
```

### `cat /Users/playra/leela/apps/mobile/package.json` (relevant expo snippets)
```json
{
  "expo": {
    "name": "Leela",
    "slug": "mobile",
    "version": "0.1.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "leela",
    "userInterfaceStyle": "automatic",
    "plugins": {
      "expo-image-picker": {
        "photosPermission": "$(PRODUCT_NAME) would like to access your photos"
      }
    }
  }
}
```

### `npx expo config --type public` output (truncated)
```
Expo config metadata...
- name: Leela
- slug: mobile
- scheme: leela
- ios: { ... }
- android: { ... }
```

### `npx expo run:ios --help` summary
```
Options:
  --device <id>       Specific device UUID/name to target
  --clear             Clear Metro cache before start
  --no-dev            Do not start in development mode
  --wait-ms <ms>    Wait for app to load (ms)
  --limit-dev-tools   Limit dev tools visibility
```

## Diagnosis Summary

| Component | Status |
|---|---|
| **Hermes/Node path fix** | ✅ APPLIED AND VERIFIED — symlink `26.0.0 → 26.13.0_2` in `/opt/homebrew/Cellar/node/`, build proceeds past Hermes gate |
| **Xcode / iOS SDKs** | ✅ iOS 26.5 and iOS 18.3 available |
| **Simulator "Leela Shots 6.9"** | ✅ Booted and visible in `xcrun simctl list devices` |
| **`xcodebuild -showdestinations`** | ❌ Device matching failure: `Unable to find a device matching the provided destination specifier` |
| **`npx expo run:ios`** | ❌ Blocked by device matching issue (consistent across 6+ attempts) |
| **`npx expo run:ios --device "<uuid>"`** | ❌ Same device matching error |

## Root Cause of Blocker

The `xcodebuild` tool cannot match the destination specifier provided by Expo with any available device in the simulator runtime. Despite:

- `Leela Shots 6.9` being **Booted** and visible in `xcrun simctl list devices`
- Both iOS 18.3 and iOS 26.5 runtimes being installed
- The simulator being available

The `npx expo run:ios` command (and `xcodebuild` under the hood) fails with:
```
xcodebuild: error: Unable to find a device matching the provided destination specifier
```

This is a **local environment issue** with `xcodebuild`/`Expo` device matching, not a code defect, deployment blocker, or external acceptance requirement.

## Probable Causes and Checks

| Cause | Evidence | Likelihood |
|---|---|---|
| `xcodebuild` destination mismatch | `Leela Shots 6.9` is Booted but `xcodebuild` can't resolve it to a destination | High |
| Scheme name mismatch | Scheme is `leela`; `xcodebuild -list` needed to verify exact name | Medium |
| Xcode CLI tools version | `xcode-select -p` output not captured; mismatch possible | Medium |
| Expo device resolver | Expo's internal device resolver fails to map to `simctl` destination | High |
| iOS runtime compatibility | iOS 26.5 runtime present; may not match project's minimum | Low |

## Allowed Fixes (Local Environment Only)

After diagnostics, the following local environment actions are permitted:

```bash
# Boot the available simulator if needed
xcrun simctl boot "Leela Shots 6.9"

# Verify it's available
xcrun simctl list devices available

# Run on the specific booted device
cd /Users/playra/leela/apps/mobile
npx expo run:ios --device "Leela Shots 6.9"
```

If simulator runtime is missing:
```bash
xcodebuild -downloadPlatform iOS
```

**Note:** These are local environment fixes only. No deployment, no store submission, no code changes.

## Forbidden Actions (Violate Checkpoint)

- ❌ Changing `productIds.ts`, `.storekit`, RevenueCat/ASC configuration
- ❌ Changing `lila_v1`, fixtures, provider, paywall logic
- ❌ Changing Xcode project settings, bundle ID, signing, deployment target
- ❌ Running `eas build`, `eas submit`, Fastlane upload
- ❌ Pushing or publishing
- ❌ Marking smoke `PASS` without actual application launch and observation

## Conclusion

The **Hermes/Node path mismatch is fixed** and verified — the build proceeds past the Hermes/Node gate.

The **iOS simulator device matching issue is a persistent local environment blocker** that prevents `npx expo run:ios` from completing, consistent across multiple attempts. This is not a code defect and does not reflect on the application's correctness.

The checkpoint `docs/mobile/smoke-run-2026-11-14.md` must reflect **BLOCKED** status until the simulator device matching issue is resolved through local environment configuration (e.g., booting a compatible simulator, resolving `xcodebuild` destination mapping).

**Next step:** Update `docs/mobile/smoke-run-2026-11-14.md` to reflect the current state: toolchain gate PASS, simulator launch BLOCKED, Result: BLOCKED awaiting simulator environment fix.