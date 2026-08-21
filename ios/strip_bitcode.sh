#!/bin/bash
#
# Take the bitcode out of embedded frameworks.
#
# `hermes.framework` arrives from React Native's prebuilt runtime carrying a
# `__LLVM` segment of 458 MB. The engine itself is 2.9 MB: the rest is bitcode,
# an intermediate representation Apple used to recompile submitted apps and has
# not accepted since Xcode 14. It ships, it is installed, and nothing reads it.
#
# The effect is not subtle. Before: the installed app was 516 MB and the archive
# 765 MB. A player downloads a board game of 72 squares and loses half a
# gigabyte of phone to a segment no device will ever open.
#
# **Runs after the frameworks are embedded, and re-signs what it touches.**
# Editing a signed framework breaks its signature, and the app is then refused
# at install with no explanation worth the name. Order and re-signing are the
# whole trick here.
#
# Debug builds are left alone: this costs a few seconds per framework and buys
# nothing on a machine with a disk.
set -euo pipefail

if [ "${CONFIGURATION:-}" = "Debug" ]; then
  echo "note: Debug build, leaving bitcode alone"
  exit 0
fi

frameworks="${TARGET_BUILD_DIR:-}/${FRAMEWORKS_FOLDER_PATH:-}"
if [ ! -d "$frameworks" ]; then
  echo "note: no embedded frameworks at $frameworks"
  exit 0
fi

saved=0
for framework in "$frameworks"/*.framework; do
  [ -d "$framework" ] || continue
  name="$(basename "$framework" .framework)"
  binary="$framework/$name"
  [ -f "$binary" ] || continue

  # Only the ones that actually carry it, so the log says something true and a
  # framework without bitcode is not needlessly re-signed.
  if ! otool -l "$binary" 2>/dev/null | grep -q "segname __LLVM"; then
    continue
  fi

  before=$(stat -f%z "$binary")
  # To a temporary file and back: `bitcode_strip` reading and writing the same
  # path is not documented to be safe, and a half-written engine is a launch
  # failure nobody would connect to this script.
  xcrun bitcode_strip -r "$binary" -o "$binary.stripped"
  mv "$binary.stripped" "$binary"
  after=$(stat -f%z "$binary")
  saved=$(( saved + before - after ))
  echo "note: $name $(( before / 1048576 ))MB -> $(( after / 1048576 ))MB"

  # Signed again, or the app will not install. `--preserve-metadata` keeps the
  # identifier and entitlements the embed step gave it.
  if [ "${CODE_SIGNING_REQUIRED:-YES}" != "NO" ] && [ -n "${EXPANDED_CODE_SIGN_IDENTITY:-}" ]; then
    # shellcheck disable=SC2086
    codesign --force --sign "${EXPANDED_CODE_SIGN_IDENTITY}" \
      ${OTHER_CODE_SIGN_FLAGS:-} \
      --preserve-metadata=identifier,entitlements,flags \
      "$framework"
  fi
done

echo "note: bitcode removed, $(( saved / 1048576 ))MB saved"
