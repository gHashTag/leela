#!/usr/bin/env bash
#
# App Store screenshots, at the size Apple actually accepts.
#
# The phone on the desk is an iPhone 13 Pro: 1170 x 2532, which is not one of
# the sizes App Store Connect takes. The required iPhone size is 6.9 inches —
# 1320 x 2868 — so the screenshots are captured on a simulator of that class
# and not on the device. A screenshot scaled up to fit is a screenshot that
# looks scaled up.
#
# `fastlane snapshot` is the usual tool for this and is worth adopting if the
# set grows past a handful or needs every language: it drives UI tests, so the
# app walks itself. It needs a UI-test target and `SnapshotHelper.swift` wired
# into the scheme, which this app does not have. Until then this script is the
# honest middle: `simctl` for everything that can be automated, and the walk
# through the app by hand.
#
# Usage:  bash scripts/shots.sh            capture into shots/
#         bash scripts/shots.sh 03-board   capture one frame under that name
#
set -euo pipefail

DEVICE_NAME="Leela Shots 6.9"
DEVICE_TYPE="com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max"
BUNDLE="xyz.ghashtag.dharma"
OUT="$(cd "$(dirname "$0")/.." && pwd)/shots"

# Apple's requirement for the 6.9-inch class. Checked rather than assumed: a
# simulator of the wrong device type produces a plausible PNG of the wrong size,
# and App Store Connect refuses it after the upload rather than before.
WANT_W=1320
WANT_H=2868

# The UDID of the first device with that name.
#
# `grep -o` and `tr`, not awk's three-argument `match`: that form is GNU-only
# and macOS awk exits with a syntax error - which the `|| true` below swallowed,
# so the script quietly decided no such device existed and created a second one.
# It then photographed the empty new simulator at exactly the right size.
udid() {
  xcrun simctl list devices \
    | grep -F "$DEVICE_NAME (" \
    | head -1 \
    | grep -oE '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}' \
    | head -1
}

id="$(udid || true)"
if [ -z "${id:-}" ]; then
  runtime="$(xcrun simctl list runtimes | grep -oE 'com.apple.CoreSimulator.SimRuntime.iOS-[0-9-]+' | tail -1)"
  id="$(xcrun simctl create "$DEVICE_NAME" "$DEVICE_TYPE" "$runtime")"
  echo "created $DEVICE_NAME"
fi

xcrun simctl boot "$id" 2>/dev/null || true
mkdir -p "$OUT"

# The status bar, fixed. Apple's own screenshots show full bars and a round
# time; a real one shows 34% battery and whatever o'clock it happens to be,
# which dates the picture and looks like a mistake.
xcrun simctl status_bar "$id" override \
  --time "9:41" \
  --dataNetwork wifi --wifiMode active --wifiBars 3 \
  --cellularMode active --cellularBars 4 \
  --batteryState charged --batteryLevel 100 2>/dev/null || true

name="${1:-shot-$(date +%H%M%S)}"
xcrun simctl io "$id" screenshot "$OUT/$name.png"

read -r w h < <(sips -g pixelWidth -g pixelHeight "$OUT/$name.png" | awk '/pixel/ {printf "%s ", $2} END {print ""}')
if [ "$w" != "$WANT_W" ] || [ "$h" != "$WANT_H" ]; then
  echo "refused: $name.png is ${w}x${h}, App Store wants ${WANT_W}x${WANT_H}" >&2
  exit 1
fi

echo "$OUT/$name.png  ${w}x${h}"
