# The bot, as a service.
#
# A Dockerfile rather than a buildpack: this is a Bun workspace monorepo, the
# bot imports four sibling packages by `workspace:*`, and a builder that guesses
# at the root gets a lockfile it cannot satisfy. The whole repository is copied
# because `@leela/content` carries the 22 datasets the bot serves plans from.
#
# TypeScript is run directly. Bun executes it, the packages have no build step,
# and adding one here would mean a second description of what the source is.

FROM oven/bun:1.3.12-slim AS manifests

WORKDIR /app

# The manifests first, so an install is cached until a dependency changes.
#
# *Every* workspace member, not just the ones the bot imports: the lockfile
# describes all of them, and `--frozen-lockfile` refuses an install whose
# workspace set does not match it. Copying six of the eight failed with
# "lockfile had changes, but lockfile is frozen".
COPY package.json bun.lock ./
COPY packages/engine/package.json packages/engine/
COPY packages/content/package.json packages/content/
COPY packages/journal/package.json packages/journal/
COPY packages/db/package.json packages/db/
COPY packages/storage/package.json packages/storage/
COPY packages/ai/package.json packages/ai/
COPY packages/contracts/package.json packages/contracts/
COPY apps/bot/package.json apps/bot/
COPY apps/docs/package.json apps/docs/
COPY apps/miniapp/package.json apps/miniapp/
# The phone app is not built into this image and its manifest is copied all the
# same: `bun install --frozen-lockfile` resolves the whole workspace, and a
# member missing from it is a lockfile mismatch rather than a smaller image.
COPY apps/mobile/package.json apps/mobile/
# Same for the three-dimensional board, for the same reason.
COPY apps/webgl/package.json apps/webgl/

FROM manifests AS web-builder

RUN bun install --frozen-lockfile

COPY packages packages
COPY apps/webgl apps/webgl
COPY apps/miniapp apps/miniapp
COPY apps/docs apps/docs

RUN VITE_ASK_ORIGIN=https://leela-production-e9a0.up.railway.app \
      bun run --cwd apps/webgl build -- --base=./ \
  && bun run --cwd apps/miniapp build \
  && cp -R apps/miniapp/dist apps/webgl/dist/classic \
  && bun run --cwd apps/docs build ../webgl/dist/docs

FROM manifests AS runtime

RUN bun install --frozen-lockfile --production

# Sources over the top. Bun's isolated linker puts the workspace links inside
# each package's own `node_modules`, so `.dockerignore` has to keep the host's
# `node_modules` out of the build context — copying them over the installed
# ones replaces links that were made for this image with links made for a Mac.
COPY packages packages
COPY apps/bot apps/bot
# Every monitor, by pattern rather than by name.
#
# These were two `COPY` lines naming two files, and a third monitor was written,
# tested, merged and deployed before anyone found out it was not in the image —
# `railway ssh bun run scripts/monitor-live-play.mjs --inside` answered `Module
# not found`, from a container running the very commit that added it. Railway
# said RUNNING on the right commit hash, the deploy was green, and the thing did
# not exist. **A list that has to be extended by hand is a list that will be
# short**, and the failure it produces looks like a deploy problem rather than a
# missing file.
#
# The glob is why this is a pattern and not a third named line. Nothing else in
# `scripts/` belongs in a production image: the twenty-eight `audit-*.mjs` read
# the source tree, which is not shipped, and would be dead weight and dead ends.
# `monitor-*` is exactly the set that runs against the live service.
COPY scripts/monitor-*.mjs scripts/
COPY --from=web-builder /app/apps/webgl/dist apps/webgl/dist

# Where games and reports live. The volume is mounted by the platform (Railway
# rejects a Dockerfile VOLUME outright: "use Railway Volumes"); without one the
# bot still runs and says so on startup, and forgets everything on next deploy.
ENV LEELA_DB=/data/leela.db
ENV LEELA_WEB_ROOT=/app/apps/webgl/dist

# `supervise` in src/index.ts restarts the polling loop when a poll fails,
# which is the failure a `bot.catch` does not cover.
CMD ["bun", "run", "apps/bot/src/index.ts"]
