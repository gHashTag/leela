# Feature Specification: Reports shared between the mini app and the bot

**Feature Branch**: `001-shared-reports`

**Created**: 2026-07-30

**Status**: Draft — blocked on a decision, see Assumptions

**Input**: "добавить отчёты и социальные профили и сеть — изучи как раньше было и всю логику перенеси"

## Background

The published app had all of this and it ran on Firebase: a `Posts` collection
where a report on a plan became a post with `ownerId`, `createTime`, `liked[]`,
`comments[]`, `accept` for moderation, a `language` and a `flagEmoji`; comments
and replies on top; avatars and `intention` on a profile; `OtherPlayers` for an
online table.

Today the same logic exists in two halves that cannot see each other:

- the **bot** keeps reports in SQLite, per player, and reads them back with
  `/path`. It has a table, a database and identities.
- the **mini app** keeps reports in `localStorage` and can now save them to a
  file. It has the board, the die and nobody else.

A player who does both writes into two places and has one path in neither.

## User Scenarios & Testing

### User Story 1 — my path follows me (Priority: P1)

I play in the mini app on the train and in the bot with friends at the weekend.
What I wrote should be one path, wherever I wrote it.

**Why this priority**: it is the whole complaint. Everything else here is a
feed; this is the record the game is played to produce being split in half.

**Independent Test**: write a report in the mini app, open `/path` in the bot,
and see it. Delivers value on its own with no feed and no profiles.

**Acceptance Scenarios**:

1. **Given** a report written in the mini app, **When** the player opens `/path`
   in the bot, **Then** it is there, on the plan it was written about.
2. **Given** a report written in the bot, **When** the player opens *My path*
   in the mini app, **Then** it is there.
3. **Given** the same report already on both sides, **When** they sync again,
   **Then** nothing is duplicated — the file merge rule already holds this.
4. **Given** no network, **When** the player writes a report in the mini app,
   **Then** it is kept locally and the gate opens as it does now.

---

### User Story 2 — a profile that is mine (Priority: P2)

A name, an avatar and an intention, as `com.leelagame` had, so a report has a
person attached to it.

**Why this priority**: a feed with no author is a list. But it is only worth
anything once P1 exists.

**Independent Test**: set an intention in the mini app, see it on the bot's
`/board` beside the player's name.

**Acceptance Scenarios**:

1. **Given** a Telegram identity, **When** the mini app opens, **Then** the
   player is recognised without signing in to anything.
2. **Given** an intention, **When** it is set, **Then** it appears wherever the
   player's name does.

---

### User Story 3 — reading each other (Priority: P3)

Reports from other players at the same table, and a comment on one.

**Why this priority**: this is the part that needs moderation, and moderation is
a person rather than a feature. The published app carried `accept` and a ban
flow for exactly this reason.

**Acceptance Scenarios**:

1. **Given** a table of three, **When** one player reports, **Then** the others
   can read it *if the writer chose to share it*.
2. **Given** a report that should not have been posted, **When** it is reported,
   **Then** there is a way for someone to take it down.

### Edge Cases

- The same person on two devices with no shared identity: today the file merge
  is the only answer, and it is manual.
- A report written offline for a plan the player has since left.
- A report imported from a file that was written by somebody else — must never
  open this player's gate. Already asserted in `journal-file.test.ts`.
- Someone's whole path, requested for deletion. Firebase had no answer to this
  either; a store listing needs one.

## Requirements

### Functional Requirements

- **FR-001**: A report MUST be readable by the player who wrote it from every
  surface they play on.
- **FR-002**: Syncing MUST be a union. Nothing already written is lost, and
  syncing twice changes nothing the second time.
- **FR-003**: A report arriving from elsewhere MUST NOT open the report gate.
- **FR-004**: Every surface MUST remain playable with no network: the gate, the
  board and the local journal already work offline and must continue to.
- **FR-005**: A player MUST be able to take their whole path away as a file, and
  MUST be able to delete it. *(The first half exists.)*
- **FR-006**: Sharing a report with other players MUST be a choice made per
  report, not a default. The published app posted everything.
- **FR-007**: The system MUST NOT [NEEDS CLARIFICATION: what identity? Telegram
  `initData` verified against the bot token is the obvious candidate and needs
  no accounts, but it ties the mini app to Telegram and excludes the web.]
- **FR-008**: Shared reports MUST be moderatable [NEEDS CLARIFICATION: by whom?
  The published app had `accept` and a ban list, which is a person's job.]

### Key Entities

- **Report** — plan, text, when. Exists on both sides already; the shapes agree.
- **Player** — an identity that is the same person in the bot and the mini app.
  Does not exist today. This is the whole of the problem.
- **Share** — a report a player has chosen to let others read. Does not exist.

## Success Criteria

- **SC-001**: A report written on one surface is readable on the other within
  one refresh, without the player copying anything.
- **SC-002**: Syncing the same state twice produces no change and no duplicate.
- **SC-003**: With the network off, every existing single-player action still
  works — throwing, the gate, writing, reading the path.
- **SC-004**: A player can export and delete everything they have written.

## Assumptions

- **This needs a server, and that is a decision rather than code.** Two halves
  cannot see each other without something in the middle: a shared identity and
  somewhere to put a report that is not one device. The mini app is static files
  on GitHub Pages and the bot is a process with a SQLite file.
- The cheapest honest shape is probably: the bot grows a small HTTP surface,
  the mini app authenticates with Telegram `initData`, and the bot's existing
  SQLite stays the store. That is a deployment — a host, a URL, a backup — and
  under this repository's boundaries it is not something to start unasked.
- Until that decision: the file in the mini app *is* the bridge. A player can
  save their path and carry it, and the merge rules that make a sync safe are
  already written and tested.
- Profiles and a feed are deliberately behind P1. A feed without a shared path
  is a second place to write things down.
