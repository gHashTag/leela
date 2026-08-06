import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// Shared with the audit scripts, which are plain JavaScript.
import { blank } from '../../../scripts/lib/source.mjs';
import { messageFor } from '@leela/content';
import { toDocument } from '@leela/journal';
import { createBot } from '../src/bot';
import { MemoryReportSink, MemoryRoomStore } from '../src/store';

/**
 * An update whose words are not in `text`.
 *
 * MEASURED against the bot this repository replaces. `leela-chakra-bot`'s
 * report command begins `const report = message?.text ? message?.text :
 * message?.caption` — the shipped bot reads the report off either place, and it
 * has to. A player photographs the page of the notebook they wrote the report
 * in; a player says it into a voice note while walking. Telegram carries those
 * words in `caption`, never in `text`.
 *
 * This bot registered four `bot.on` surfaces — `message:web_app_data`,
 * `callback_query:data`, `message:document`, `message:text` — and not one of
 * them can see a caption. So the photograph and the voice note reached the end
 * of the middleware chain and stopped: no reply, no kept report, and the report
 * gate still shut. Under the legacy rules, where the gate holds a player for a
 * day, that is not distinguishable from a bot that has died.
 *
 * The repository asserted the opposite twice. `bot.ts` says "an update never
 * ends in silence" in a doc-comment, and `bot.test.ts` has a suite of that
 * name. That suite iterates `registered()`, a regex for `bot.command('...')`
 * over the source — so **every `bot.on` surface was outside it by
 * construction**, and the surfaces that answered nothing were exactly the ones
 * the guard could not reach. Both grids below are written over `bot.on`
 * territory for that reason.
 *
 * ---
 *
 * WHAT IS STILL SILENT, measured rather than assumed. Run the last suite in
 * this file to see it. An update with no words in it at all still falls off the
 * end of the chain:
 *
 *   - a photo, voice note, video, video note, audio or animation sent with the
 *     caption box left empty;
 *   - a sticker, which Telegram gives no caption field at all;
 *   - a contact, a location, a venue, a poll, a dice.
 *
 * These are left silent deliberately, and the reason is a budget rather than a
 * judgement: answering them needs a sentence that does not exist in
 * `@leela/content`, and a new message key there is twenty-two translations and
 * a run at `audit-untranslated`. No existing key fits — `chat.hint` and
 * `chat.noTableHelp` both answer *something a player wrote*, and neither is
 * true of a sticker. So the gap is recorded here rather than papered over with
 * a wrong sentence, and the suite at the bottom holds it to its current size:
 * if somebody closes it, that test fails and this comment is why.
 *
 * A caption-bearing update of the same kinds is closed, which is the part a
 * player actually hits: the words exist, and now they arrive.
 */

const BOT_INFO = {
  id: 1,
  is_bot: true as const,
  first_name: 'Leela',
  username: 'leela_test_bot',
  can_join_groups: true as const,
  can_read_all_group_messages: false as const,
  supports_inline_queries: false as const,
  can_connect_to_business: false as const,
  has_main_web_app: false as const,
  has_topics_enabled: false as const,
  allows_users_to_create_topics: false as const,
  can_manage_bots: false as const,
  supports_join_request_queries: false as const,
};

interface Sent {
  method: string;
  payload: Record<string, unknown>;
}

const PRIVATE = { id: 500, type: 'private' as const };

/** The clock is fixed so two arms of the same row cannot differ by a tick. */
const NOW = 1_700_000_000_000;

/**
 * Anything the transport would have sent, and nothing actually sent.
 *
 * @param fileText what a document's bytes read as. Empty by default, which is
 *                 what the first two grids want — they are about words, and an
 *                 unreadable file answers as consistently as a readable one.
 *                 The third grid hands over a real path, because what it is
 *                 asserting is that the entries arrive.
 */
function harness(fileText = '') {
  const sent: Sent[] = [];
  const reports = new MemoryReportSink();

  const bot = createBot({
    token: '1:TEST',
    botInfo: BOT_INFO,
    log: () => undefined,
    store: new MemoryRoomStore(),
    reports,
    now: () => NOW,
    // A document row would otherwise reach `api.telegram.org` for its bytes.
    readFile: async () => fileText,
  });

  bot.api.config.use(async (_prev, method, payload) => {
    sent.push({ method, payload: payload as Record<string, unknown> });
    return { ok: true, result: method === 'answerCallbackQuery' ? true : { message_id: 1 } } as never;
  });

  return { bot, sent, reports };
}

const texts = (sent: Sent[]) =>
  sent.filter((s) => s.method === 'sendMessage').map((s) => String(s.payload.text));

let updateId = 0;

/**
 * The kinds Telegram can hang a caption on.
 *
 * `video_note` is in the grid although `sendVideoNote` has no caption
 * parameter today: it is the one kind of these seven that Telegram has never
 * allowed words on, and it costs nothing to be right in advance if that
 * changes. Listing it is not enumerating a known-bad case — every row here is
 * asserted the same way, and no row is exempted.
 *
 * `sticker` is deliberately absent: it has no caption field, so it belongs to
 * the still-silent gap at the bottom of this file, not to this grid.
 */
const KINDS = ['photo', 'voice', 'video', 'video_note', 'audio', 'animation', 'document'] as const;

type Kind = (typeof KINDS)[number];

/** The media part of a message of each kind, filled just enough to be one. */
function media(kind: Kind): Record<string, unknown> {
  const file = {
    file_id: `${kind}-1`,
    file_unique_id: `${kind}-u`,
    file_size: 64,
  };

  switch (kind) {
    case 'photo':
      return { photo: [{ ...file, width: 90, height: 90 }] };
    case 'voice':
      return { voice: { ...file, duration: 7 } };
    case 'video':
      return { video: { ...file, width: 90, height: 90, duration: 7 } };
    case 'video_note':
      return { video_note: { ...file, length: 90, duration: 7 } };
    case 'audio':
      return { audio: { ...file, duration: 7 } };
    case 'animation':
      return { animation: { ...file, width: 90, height: 90, duration: 7 } };
    case 'document':
      return { document: { ...file, file_name: 'path.json' } };
  }
}

/** A `bot_command` entity over the first word, the way Telegram marks one. */
const commandEntities = (words: string) =>
  words.startsWith('/')
    ? [{ type: 'bot_command' as const, offset: 0, length: words.split(' ')[0].length }]
    : undefined;

/**
 * The same words, placed the two ways an update can carry them.
 *
 * `text` is a plain message and carries no media, because Telegram has no such
 * thing as a photo with `text`: the plain message *is* the twin every caption
 * row is measured against.
 */
function update(words: string, placement: 'text' | 'caption', kind: Kind, from = 100) {
  updateId += 1;

  const carried =
    placement === 'text'
      ? { text: words, entities: commandEntities(words) }
      : { ...media(kind), caption: words, caption_entities: commandEntities(words) };

  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: PRIVATE.id, type: PRIVATE.type, title: 'A table' },
      from: { id: from, is_bot: false, first_name: `P${from}` },
      ...carried,
    },
  } as never;
}

/**
 * Throw until the report gate is owed.
 *
 * The die is seeded from the chat id, so the number of throws is fixed but not
 * known here; stopping on the gate's own words rather than on a count is what
 * keeps this from silently seating nobody. Lifted from `bot.test.ts`, which
 * cannot export it.
 */
async function seatAndOweAReport(bot: ReturnType<typeof createBot>, sent: Sent[]) {
  await bot.handleUpdate(update('/new', 'text', 'photo'));
  await bot.handleUpdate(update('/start', 'text', 'photo'));
  await bot.handleUpdate(update('/intention to see what I keep avoiding', 'text', 'photo'));

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const before = sent.length;
    await bot.handleUpdate(update('/roll', 'text', 'photo'));
    if (texts(sent.slice(before)).join(' ').includes('before you move on')) return;
  }

  throw new Error('never reached the report gate');
}

interface Outcome {
  answered: boolean;
  kept: boolean;
}

/** One arm: a fresh table, a player who owes a report, and one update. */
async function arm(words: string, placement: 'text' | 'caption', kind: Kind) {
  const { bot, sent, reports } = harness();
  await seatAndOweAReport(bot, sent);

  const before = sent.length;
  await bot.handleUpdate(update(words, placement, kind));
  const said = texts(sent.slice(before));

  const kept = (await reports.history('100')).some((entry) => entry.text === words);

  return { said, outcome: { answered: said.join('').length > 0, kept } satisfies Outcome };
}

const WORDS = 'what standing on this square brings up';

describe('words a player wrote arrive whichever field carries them', () => {
  /**
   * One invariant over the whole grid: **whichever placement produces a reply
   * and a kept report, the other does too.**
   *
   * Not seven named cases. A test that listed photo and voice would have said
   * nothing about the kind added to Telegram next year, and — more to the
   * point — nothing about the six kinds the author of the fix did not happen
   * to think of, which is the whole failure being repaired.
   */
  it('answers and keeps a report the same way from a caption as from text', async () => {
    const byText: Record<string, Outcome> = {};
    const byCaption: Record<string, Outcome> = {};
    const openings: Record<string, string[]> = {};
    const spoken: Record<string, string[]> = {};

    for (const kind of KINDS) {
      const typed = await arm(WORDS, 'text', kind);
      const captioned = await arm(WORDS, 'caption', kind);

      byText[kind] = typed.outcome;
      byCaption[kind] = captioned.outcome;

      // A document says one thing more than its twin — the file it also
      // carries was still taken in — so the caption arm is held to *beginning*
      // with everything the text arm said rather than to saying only that.
      spoken[kind] = typed.said;
      openings[kind] = captioned.said.slice(0, typed.said.length);
    }

    expect(byCaption).toEqual(byText);
    expect(openings).toEqual(spoken);

    // And the grid cannot pass by both arms being equally dead.
    expect(byText).toEqual(
      Object.fromEntries(KINDS.map((kind) => [kind, { answered: true, kept: true }])),
    );
  });
});

/**
 * `bot.ts` as text, for the two grids that derive an axis from it.
 *
 * Anchored to this file rather than to `process.cwd()`. MEASURED: the working
 * directory used to be assumed, and `npx vitest run apps/bot/tests/...` from
 * the repository root — which is how anybody outside this package runs one
 * test — threw ENOENT on `<root>/src/bot.ts` before a single assertion ran.
 * `bun run test` happens to chdir into the package, so the assumption held for
 * exactly one way of invoking it and for no reason anybody chose.
 */
function botSource(): string {
  return readFileSync(new URL('../src/bot.ts', import.meta.url), 'utf8');
}

/**
 * The commands `bot.ts` actually registers, read from the file.
 *
 * Blanked before the pattern runs, and that is not a precaution. `bot.ts`
 * documents the surfaces it registers in prose above them, so a doc-comment
 * naming a command reads to this regular expression exactly like the command
 * being registered — and this file's whole argument is that an axis derived
 * from the source beats an axis written by hand. An axis derived from the
 * source *and its comments* is a third thing, and it is worse than either: it
 * looks derived while asserting about a sentence somebody wrote.
 *
 * @param source the file's text. Defaulted rather than read inside, so the
 *               same derivation can be run over a fixture — see the prose
 *               grid below, which is the only way to see this blanking fail.
 */
function registered(source: string = botSource()): string[] {
  return [...blank(source).matchAll(/bot\.command\('([a-z]+)'/g)].map(([, name]) => name);
}

describe('a command written in a caption reaches the same handler', () => {
  /**
   * The second grid, over every command the bot registers rather than over the
   * two anybody would have thought to check.
   *
   * grammY says in its own doc that "commands are not matched in captions", and
   * `Context.has.command` proves it: the predicate is gated on
   * `:entities:bot_command` and then reads `msg.entities`, while Telegram puts
   * a caption's markup in `caption_entities`. So `/report <words>` under a
   * photo matched nothing at all.
   *
   * The carrier is a photo throughout. One kind is enough here because the
   * first grid already establishes that the seven kinds are not distinguished;
   * crossing fifteen commands with seven kinds would seat a hundred and five
   * tables to learn the same fact twice.
   *
   * MEASURED consequence of the fix, recorded because it is a real change: a
   * *document* whose caption is a command is now dispatched to that command and
   * its bytes are not imported. The player wrote an instruction; obeying it is
   * the reading that respects them. A document whose caption is ordinary words
   * still has both — the words are answered and the path is still taken in.
   *
   * ^ RETRACTED, and left standing rather than deleted because the reasoning is
   * the useful part. The consequence was real; the justification was wrong, and
   * it was wrong in a way this file could not see, because the paragraph above
   * describes a document-under-a-command and neither grid in this file crosses
   * those two axes: the first grid is seven media kinds under words that are
   * not a command, the second is every command under a photo, which carries no
   * bytes. So "obeying the instruction is the reading that respects them" was
   * asserted nowhere and was believed for two rounds.
   *
   * It does not survive contact with the three commands it actually meets.
   * MEASURED, against this same transport and the same bytes: `/path` answered
   * "You have not written anything yet", `/save` answered "You have not written
   * anything to save yet", `/take` answered "That does not read as a square" —
   * each while holding, unread and unmentioned, the file that answers it.
   * `/path`, `/save` and `/take` are instructions ABOUT the path in the file.
   * Obeying one by discarding the evidence for it is not respect, and the reply
   * never mentioned the attachment at all, so the player had no way to learn
   * their file had been dropped.
   *
   * What is true now: a document under a command does BOTH. The bytes are taken
   * in first — see the middleware in `bot.ts` for why the order is the point —
   * and the command runs after, answering with the file already in hand. The
   * grid below is the one that was missing: every registered command crossed
   * with every media kind that carries importable bytes, both axes derived from
   * `bot.ts` rather than listed here, because a hand-listed `/path`, `/save`,
   * `/take` would have gone green on the day a seventeenth command arrived.
   */
  it('says exactly what the typed command says, for every command', async () => {
    const typed: Record<string, string[]> = {};
    const captioned: Record<string, string[]> = {};

    for (const name of registered()) {
      const words = `/${name} an account of standing here`;

      typed[name] = (await arm(words, 'text', 'photo')).said;
      captioned[name] = (await arm(words, 'caption', 'photo')).said;
    }

    expect(captioned).toEqual(typed);

    // Nothing here may pass by silence on both sides either.
    expect(Object.entries(typed).filter(([, said]) => said.join('') === '')).toEqual([]);
    expect(Object.keys(typed).length).toBeGreaterThan(5);
  });

  it('keeps the report a captioned /report carries, as the typed one does', async () => {
    // The command from the shipped bot's own report handler, in the place the
    // shipped bot read it from.
    const captioned = await arm(`/report ${WORDS}`, 'caption', 'voice');
    const kept = await arm(`/report ${WORDS}`, 'text', 'voice');

    expect(captioned.outcome).toEqual(kept.outcome);
    expect(captioned.outcome.answered).toBe(true);
  });
});

/**
 * The media kinds whose bytes this bot takes in, read from the file.
 *
 * The twin of `registered()`, and here for the same reason. The defect this
 * grid guards was let through by a test that crossed commands with a carrier
 * chosen by hand — a photo, which has no bytes to lose — so the one pairing
 * that could fail was the one pairing nobody wrote down. Naming `document`
 * here would repeat that in miniature: it would still be a hand-written axis,
 * just a shorter one, and the day `bot.on('message:audio')` learns to read a
 * path this grid would go on asserting nothing about it.
 *
 * A kind imports if the surface registered for it reaches the bytes — either
 * through `takeInDocument` or through `ctx.getFile()` directly. The body is
 * bounded by the next top-level `bot.` registration so that a surface's own
 * code is read and its neighbours' is not; matching the whole file would call
 * every kind an importer.
 *
 * `message::bot_command` is not a kind and does not match: the `[a-z_]+` after
 * `message:` cannot begin with the second colon. It calls `takeInDocument` too,
 * which is the whole of the fix, but it is a route rather than a carrier.
 *
 * MEASURED, and the reason `blank` is here: `bot.ts` explains the caption route
 * in a doc-comment that writes `bot.on('message:document')` out in full, and
 * this derivation was reading it. It cost nothing on the day it was found —
 * `document` is registered for real a few lines below, and the result goes
 * through a `Set` — so the grid was right by luck, over an axis that included a
 * sentence. The next comment naming a kind the bot does not register would have
 * crossed every command with a carrier that does not exist and failed with the
 * bot innocent; a comment naming one it stopped registering would have gone on
 * asserting about it forever. Blanking is character-for-character, so the
 * `indexOf` that bounds a surface's body still points where it did.
 *
 * @param source as `registered()` above, and defaulted for the same reason.
 */
function importingKinds(source: string = botSource()): string[] {
  const code = blank(source);
  const kinds: string[] = [];

  for (const match of code.matchAll(/\bbot\.on\('message:([a-z_]+)'/g)) {
    const start = match.index ?? 0;
    const next = code.indexOf('\n  bot.', start + 1);
    const body = code.slice(start, next === -1 ? code.length : next);

    if (/takeInDocument|ctx\.getFile\(\)/.test(body)) kinds.push(match[1] as string);
  }

  return [...new Set(kinds)];
}

/**
 * A file in which every registration a reader can see is one nobody made.
 *
 * The shape, rather than the case. `bot.ts` today happens to name
 * `message:document` in a doc-comment and to register it a few lines lower, so
 * reading the prose changed nothing — asserting that one line is not there
 * would be asserting about the accident. What has to hold is the rule: a
 * surface that exists only in a sentence is not a surface, whichever sentence
 * and whichever surface.
 *
 * So both a `bot.on` and a `bot.command` appear here exactly twice and never in
 * code — once inside a block comment, once behind a `//` — and each is written
 * with everything the derivations look for, `ctx.getFile()` and a body a
 * `takeInDocument` would sit in. A derivation that reads text rather than code
 * finds them both. Below them, one real registration of each, so a helper that
 * has simply stopped finding anything cannot pass this either.
 *
 * `audio` and `ghost` are chosen because the bot has neither: if a later pass
 * registers them for real, this fixture still says what it says, because the
 * fixture is the whole of the file the helpers are given.
 */
const PROSE_ONLY = [
  '/**',
  " * Once bot.on('message:audio', ...) reached ctx.getFile() here, and",
  " * bot.command('ghost') answered when it did. Neither is written below.",
  ' */',
  "  // bot.on('message:audio', (ctx) => takeInDocument(ctx));",
  "  // bot.command('ghost', (ctx) => ctx.reply('boo'));",
  "  bot.on('message:document', async (ctx) => {",
  '    await takeInDocument(ctx);',
  '  });',
  "  bot.command('report', (ctx) => ctx.reply('kept'));",
].join('\n');

/** Both axes, derived. Neither is written down anywhere in this file. */
const COMMANDS = [...new Set(registered())];
const IMPORTING = importingKinds();
const CELLS = COMMANDS.flatMap((command) => IMPORTING.map((kind) => ({ command, kind })));

/**
 * A path with two entries in it, as `@leela/journal` writes one.
 *
 * Two rather than one so that "the entries the file contained" is a set and not
 * a coincidence, and dated in the past so the import keeps their own moments
 * rather than stamping them with `NOW`.
 */
const ENTRIES = [
  {
    plan: 6,
    text: 'the square I was standing on when I saved this',
    at: 1_600_000_000_000,
  },
  { plan: 41, text: 'and the one I reached after it', at: 1_600_000_060_000 },
];

const A_PATH = JSON.stringify(toDocument(ENTRIES));

/** What the bot says when it takes a path in. Asked of `@leela/content`,
 *  never spelled here: this grid is about the file being mentioned at all,
 *  and a sentence copied into a test is a sentence that can drift. */
const TOOK = messageFor('en', 'file.took', { count: ENTRIES.length });

/** And what it says when it is handed a path it already has. */
const NOTHING_NEW = messageFor('en', 'file.nothingNew');

const written = (entries: ReadonlyArray<{ plan: number; text: string }>) =>
  entries.map(({ plan, text }) => ({ plan, text }));

/** The same media with the caption box left empty. */
function attachment(kind: Kind, from = 100) {
  updateId += 1;

  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: PRIVATE.id, type: PRIVATE.type, title: 'A table' },
      from: { id: from, is_bot: false, first_name: `P${from}` },
      ...media(kind),
    },
  } as never;
}

/** One update: the file and the command together. */
async function together(words: string, kind: Kind) {
  const { bot, sent, reports } = harness(A_PATH);
  await seatAndOweAReport(bot, sent);

  const before = sent.length;
  await bot.handleUpdate(update(words, 'caption', kind));

  return {
    said: texts(sent.slice(before)),
    kept: written(await reports.history('100')),
  };
}

/** Two updates: the file, and then the same command typed underneath it. */
async function oneThenTheOther(words: string, kind: Kind) {
  const { bot, sent, reports } = harness(A_PATH);
  await seatAndOweAReport(bot, sent);
  await bot.handleUpdate(attachment(kind));

  const before = sent.length;
  await bot.handleUpdate(update(words, 'text', kind));

  return {
    said: texts(sent.slice(before)),
    kept: written(await reports.history('100')),
  };
}

describe('a file sent under a command is taken in as well as obeyed', () => {
  /**
   * Both axes come off `bot.ts`, so this asserts that the derivation found
   * something rather than quietly producing an empty grid — a cross product
   * with an empty side runs zero cases and passes.
   */
  it('derives both axes from the bot rather than listing them here', () => {
    expect(COMMANDS.length).toBeGreaterThan(5);
    expect(IMPORTING.length).toBeGreaterThan(0);

    // And every importing kind is one this file knows how to build a message
    // of. A surface added for a kind `media()` cannot make would otherwise be
    // crossed into the grid and silently skipped.
    for (const kind of IMPORTING) expect(KINDS).toContain(kind);

    expect(CELLS).toHaveLength(COMMANDS.length * IMPORTING.length);
  });

  /**
   * And derives them from code, not from prose.
   *
   * The test above asks whether the derivation found something; this asks
   * whether what it found is written in the file or merely described in it.
   * Both helpers are asked with one fixture, because the defect is a property
   * of *reading source with a regular expression* rather than of either
   * pattern — `registered()` was written first and `importingKinds()` copied
   * its shape, and neither had ever been handed a comment on purpose.
   *
   * Seen to fail: with `blank` taken out of `importingKinds`, the first
   * expectation below reports `['audio', 'document']`, and with it taken out of
   * `registered` the second reports `['ghost', 'ghost', 'report']` — twice,
   * because a name written in prose is written twice here and `registered`
   * does not dedupe, which is itself a small proof that the two occurrences
   * being found are the two in the comments.
   */
  it('reads a registration and not a sentence about one', () => {
    expect(importingKinds(PROSE_ONLY)).not.toContain('audio');
    expect(registered(PROSE_ONLY)).not.toContain('ghost');

    // And the fixture is not passing by finding nothing at all: the two
    // registrations that *are* written in it are both found.
    expect(importingKinds(PROSE_ONLY)).toEqual(['document']);
    expect(registered(PROSE_ONLY)).toEqual(['report']);
  });

  /**
   * One case per cell, and the same three claims in each.
   *
   * 1. The entries the file carried are in the store. This is the loss: before
   *    the fix, `/path`, `/save` and `/take` imported none of them.
   * 2. The first thing the player is told is that the file was taken in. A
   *    reply that answers the command and never mentions the attachment is the
   *    defect, not the fix — the player would have no way to know.
   * 3. After that line, the answer is *exactly* what the same command says when
   *    the file was sent a moment earlier as its own message. This is what
   *    "the command is still obeyed" means, said as an invariant rather than as
   *    a list of expected sentences: attaching the file to the command and
   *    sending it just before are the same thing to everything downstream.
   *
   * Claim 3 is also what makes the order load-bearing. Import after dispatch
   * and `/path` answers the state before the file arrived, so the twin — which
   * imported first — would differ, and this cell would go red.
   */
  it.each(CELLS.map(({ command, kind }) => [command, kind]))(
    '/%s under a %s: the path arrives and the command runs',
    async (command, kind) => {
      const words = `/${command} an account of standing here`;

      const attached = await together(words, kind as Kind);
      const separately = await oneThenTheOther(words, kind as Kind);

      expect(attached.kept).toEqual(expect.arrayContaining(written(ENTRIES)));
      expect(attached.said[0]).toBe(TOOK);
      expect(attached.said.slice(1)).toEqual(separately.said);
    },
  );

  /**
   * The cell the grid above cannot reach, and the reason the import is guarded
   * rather than merely moved.
   *
   * A caption whose first word looks like a command but names none — a typo, a
   * command from another bot in the same group, a command this bot dropped —
   * takes *both* routes: the middleware that now imports it, and then, because
   * no `bot.command` matched, `message:caption`, which calls `next()` for a
   * document and reaches `message:document` as well. The grid above is built
   * from `registered()` and so contains no such caption by construction.
   *
   * MEASURED without the guard: the path is imported, and then imported again,
   * and the second pass finds nothing new — so the player is told "Took in 2
   * plans" and, in the same breath, that their file holds nothing new. Two
   * true sentences that contradict each other about the same file.
   *
   * The name is `/notacommandthisbotknows` rather than something plausible so
   * that this cannot start passing for the wrong reason if a command is added.
   */
  it('imports a path once when the caption names a command the bot does not have', async () => {
    const attached = await together('/notacommandthisbotknows and some words', 'document');

    expect(attached.kept).toEqual(expect.arrayContaining(written(ENTRIES)));
    expect(attached.said.filter((said) => said === TOOK)).toHaveLength(1);
    expect(attached.said.filter((said) => said === NOTHING_NEW)).toHaveLength(0);
  });
});

describe('an update carrying no words at all is still silent', () => {
  /**
   * The unclosed part, asserted at its measured size rather than described.
   *
   * A photo sent with the caption box empty, or a sticker, reaches the end of
   * the chain and nothing is said. Closing it needs a sentence
   * `@leela/content` does not have and no existing key honestly fits, so it is
   * left open on purpose — see the head of this file. This test exists so the
   * gap is a fact in the suite rather than a claim in a comment, and so that
   * closing it is a deliberate act with a red test in front of it.
   */
  it('says nothing to a photo or a sticker with no caption', async () => {
    const { bot, sent } = harness();
    await seatAndOweAReport(bot, sent);

    const wordless = [
      { ...media('photo') },
      { sticker: { file_id: 's', file_unique_id: 's', width: 1, height: 1, is_animated: false, is_video: false, type: 'regular' } },
    ];

    const said: string[][] = [];

    for (const carried of wordless) {
      updateId += 1;
      const before = sent.length;
      await bot.handleUpdate({
        update_id: updateId,
        message: {
          message_id: updateId,
          date: 0,
          chat: { id: PRIVATE.id, type: PRIVATE.type, title: 'A table' },
          from: { id: 100, is_bot: false, first_name: 'P100' },
          ...carried,
        },
      } as never);
      said.push(texts(sent.slice(before)));
    }

    expect(said).toEqual([[], []]);
  });
});
