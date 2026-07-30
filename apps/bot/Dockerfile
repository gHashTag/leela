# The bot, as a service.
#
# A Dockerfile rather than a buildpack: this is a Bun workspace monorepo, the
# bot imports four sibling packages by `workspace:*`, and a builder that guesses
# at the root gets a lockfile it cannot satisfy. The whole repository is copied
# because `@leela/content` carries the 22 datasets the bot serves plans from.
#
# TypeScript is run directly. Bun executes it, the packages have no build step,
# and adding one here would mean a second description of what the source is.

FROM oven/bun:1.3.12-slim

WORKDIR /app

# The manifests first, so an install is cached until a dependency changes.
COPY package.json bun.lock ./
COPY packages/engine/package.json packages/engine/
COPY packages/content/package.json packages/content/
COPY packages/db/package.json packages/db/
COPY packages/ai/package.json packages/ai/
COPY packages/contracts/package.json packages/contracts/
COPY apps/bot/package.json apps/bot/

RUN bun install --frozen-lockfile --production

COPY packages packages
COPY apps/bot apps/bot

# Where games and reports live. A volume is mounted here; without one the bot
# still runs and says so on startup, and forgets everything on the next deploy.
ENV LEELA_DB=/data/leela.db
VOLUME /data

# `supervise` in src/index.ts restarts the polling loop when a poll fails,
# which is the failure a `bot.catch` does not cover.
CMD ["bun", "run", "apps/bot/src/index.ts"]
