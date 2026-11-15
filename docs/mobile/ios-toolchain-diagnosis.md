# iOS Toolchain Diagnosis

**Date:** 2026-11-14
**Purpose:** Diagnose Hermes/Node path mismatch blocking `npx expo run:ios`

## Node/Bun Versions

```bash
node -v
v22.22.0

npm -v
10.9.4

bun -v
1.4.4
```

## Node Path

```bash
which node
/Users/playra/.nvm/versions/node/v22.22.0/bin/node

which bun
/Users/playra/.nvm/versions/node/v22.22.0/bin/bun
```

## Full PATH

```bash
echo $PATH
/Users/playra/.grok/bin:/Users/playra/.railway/bin:/Applications/GitButler.app/Contents/MacOS:/Users/playra/.opencode/bin:/Users/playra/.browseros/bin:/Users/playra/.antigravity/antigravity/bin:/Users/playra/.local/bin:/Users/playra/.nvm/versions/node/v22.22.0/bin:/Users/playra/.console-ninja/.bin:/Users/playra/.antigravity/antigravity/bin:/Users/playra/.cartesia/bin:/Users/playra/.codeium/windsurf/bin:/Users/playra/.bun/bin:/Users/playra/Library/pnpm:/Users/playra/.local/bin:/Users/playra/bin:/Users/playra/.elan/bin:/Users/playra/.local/bin:/Users/playra/.rbenv/shims:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/System/Cryptexes/App/usr/bin:/usr/bin:/bin:/usr/sbin:/sbin:/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/local/bin:/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/bin:/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/appleinternal/bin:/pkg/env/global/bin:/Library/Apple/usr/bin:/Library/TeX/texbin:/Users/playra/.cargo/bin:/Users/playra/.orbstack/bin:/opt/homebrew/opt/fzf/bin:/Users/playra/.lmstudio/bin
```

## Node Symlink Check

```bash
ls -la $(which node)
/Users/playra/.nvm/versions/node/v22.22.0/bin/node
-rwxr-xr-x@ 1 playra  staff  111673840 Jan 13  2026 /Users/playra/.nvm/versions/node/v22.22.0/bin/node
```

## Readlink

```bash
readlink -f $(which node)
/Users/playra/.nvm/versions/node/v22.22.0/bin/node
```

## Cellar Node Versions

```bash
ls /opt/homebrew/Cellar/node/
26.13.0_2
```

The expected path `/opt/homebrew/Cellar/node/26.0.0/bin/node` does NOT exist.

Actual Node in Cellar:

```bash
ls /opt/homebrew/Cellar/node/26.13.0_2/bin/
node
npm -> /opt/homebrew/lib/node_modules/npm/bin/npm-cli.js
npx -> /opt/homebrew/lib/node_modules/npm/bin/npx-cli.js
```

## Exported Issue

The Hermes build script (`Script-46EB2E00016370.sh`) expects Node at:

```
/opt/homebrew/Cellar/node/26.0.0/bin/node
```

But this path does not exist. The actual Node version in Cellar is `26.13.0_2` at:

```
/opt/homebrew/Cellar/node/26.13.0_2/bin/node
```

The user's active Node is via nvm:

```
/Users/playra/.nvm/versions/node/v22.22.0/bin/node
```

(v22.22.0 — different major version than the Cellar Node 26)

## Diagnosis

**Root cause:** The Hermes build script hardcodes the expectation of Node `26.0.0` at `/opt/homebrew/Cellar/node/26.0.0/bin/node`, but:

1. Node `26.0.0` never been installed in Cellar (only `26.13.0_2` exists)
2. The user's active Node is v22 via nvm, not v26 from Cellar
3. This mismatch causes `Script-46EB2E00016370.sh: line 9: /opt/homebrew/Cellar/node/26.0.0/bin/node: No such file or directory`

**This is a local developer environment/toolchain issue**, consistent with the 4 pre-existing failures documented in `docs/engine/preexisting-failures.md`. It blocks `npx expo run:ios` but is not a code defect.

## Fix Attempt 1: Symlink 26.0.0 → 26.13.0_2 ✅ COMPLETED

```bash
# Go to Cellar directory
cd /opt/homebrew/Cellar/node
# Create symlink: 26.0.0 → 26.13.0_2
ln -sfn 26.13.0_2 26.0.0
# Verify
ls -la /opt/homebrew/Cellar/node/ | head -5
```

Verified: `/opt/homebrew/Cellar/node/26.0.0/bin/node` now exists and resolves correctly.

After this, `npx expo run:ios` starts the build (previously failed immediately with "No such file or directory").

**Classification: temporary local workaround**
- **Durability:** fragile — symlink aliases Homebrew Node version directory
- **Reason:** May break after Node updates; does NOT make the machine "configured" for reproducible Hermes builds
- **Required follow-up:** Pin Node version and make Hermes script path deterministic

**Do NOT consider the machine "ready for reproducible builds" until Hermes script uses a stable Node path (e.g., via nvm or explicit PATH configuration).**

After this, `npx expo run:ios` starts the build (previously failed immediately with "No such file or directory").

**Note:** The build takes ~2-3 minutes on first run. After the first successful run, CocoaPods caches and subsequent runs are faster.

## Fix Attempt 2: Use nvm Node directly

```bash
source ~/.nvm/nvm.sh
nvm use v22.22.0
node -v
# Then run expo
npx expo run:ios
```

## Fix Attempt 3: Reinstall iOS dependencies

```bash
cd /Users/playra/leela/apps/mobile
rm -rf ios/Pods ios/build
bun install
npx expo prebuild --platform ios --clean
npx expo run:ios
```

## What Must NOT Change

- ❌ Do NOT change `productIds.ts`, `.storekit`, RevenueCat/ASC configuration
- ❌ Do NOT change `lila_v1`, fixtures, provider, paywall
- ❌ Do NOT deploy, publish, or push
- ❌ Do NOT run `eas build`, `eas submit`, Fastlane upload
- ❌ Do NOT delete `ios/` directory without backup — this could destroy native project configuration

## Resolution Criterion

Toolchain is fixed when:

```bash
node -v
```

returns a valid Node path, AND

```bash
npx expo run:ios
```

launches the application in iOS Simulator without Hermes path error.

## Next Step After Fix

Update `docs/mobile/smoke-run-2026-11-14.md`:

Replace:
```md
⛔ BUILD TOOLCHAIN ISSUE — iOS simulator run blocked
```

With:
```md
✅ App launched on iOS Simulator
```

Then fill all evidence fields and run the full smoke test.