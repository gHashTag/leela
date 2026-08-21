#!/bin/bash
#
# Bring the built board into the app, as a build step rather than as a memory.
#
# The board is built in another repository (`leela/apps/webgl`) and has to be
# copied into `ios/board`, which the Xcode folder reference then puts in the
# bundle. Done by hand, that copy is one command that can be forgotten - and it
# was: a board was copied in *before* its own source change was rebuilt, and the
# app then ran an older page than the one on disk for half an afternoon. Nothing
# was broken; everything simply behaved as though the change had not been made.
#
# So the build does it, and says out loud which board it took.
#
# Where the built board is, in order:
#   1. $LEELA_BOARD_DIST, if set - the answer for a machine laid out differently
#   2. the sibling checkout, which is this machine's layout
#
# If neither is there the build does NOT fail: someone may have only the app
# repository, and `ios/board` is committed, so what is already in the tree is
# what ships. It warns instead, because a silent fallback is how the stale copy
# happened in the first place.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
target="$here/board"

candidates=(
  "${LEELA_BOARD_DIST:-}"
  "$here/../../../leela/apps/webgl/dist"
)

source=""
for candidate in "${candidates[@]}"; do
  if [ -n "$candidate" ] && [ -f "$candidate/index.html" ]; then
    source="$candidate"
    break
  fi
done

if [ -z "$source" ]; then
  echo "warning: no built board found; shipping the copy already in ios/board"
  echo "warning: build it with 'cd apps/webgl && npx vite build', or set LEELA_BOARD_DIST"
  exit 0
fi

# Absolute paths in `index.html` mean the page was built without `base: './'`,
# and under `file://` it would come up blank with nothing to report. Refuse
# rather than ship it.
if grep -qE '(src|href)="/' "$source/index.html"; then
  echo "error: $source/index.html has absolute asset paths" >&2
  echo "error: set 'base: \"./\"' in apps/webgl/vite.config.ts and rebuild" >&2
  exit 1
fi

rm -rf "$target"
cp -R "$source" "$target"
echo "board synced from $source"
