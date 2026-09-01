/**
 * A chat that becomes a supergroup.
 *
 * Telegram does not move a group when it is upgraded. It creates a supergroup,
 * gives it a **new id**, and leaves the old chat behind — and it does this on
 * its own when a basic group passes its member limit, as well as whenever an
 * admin taps the setting. To the people in it nothing has happened: same title,
 * same history, same faces.
 *
 * Every room in this bot is keyed on that id. So the upgrade used to end a game
 * in progress silently, and in three separate ways:
 *
 *   - the table was unreachable, and `/roll` in the chat the players were still
 *     sitting in answered *No table here yet. Send /new to open one.*;
 *   - the row was unremovable — `/end` is the only command that clears a table
 *     and it cannot be sent to a chat that no longer exists, and `pruneFinished`
 *     keeps unfinished sessions on purpose;
 *   - and what those players were playing for **survived into the next game**,
 *     because `letGoOfTheGame` only ever runs over the seats of a table the bot
 *     can find under the chat id in front of it. That is the defect the comment
 *     above `/new` says was already paid for once, returning through the one
 *     route it did not cover.
 *
 * This file asserts the shape rather than the three sentences: **no room is
 * reachable under an id no chat can address any more, and nothing of a game
 * left behind reaches the game that follows it.** It is a property over a grid
 * — every old id against every new one, both of Telegram's two service
 * messages, in both languages the catalogue is complete in — because the id is
 * the only thing that changes and the defect is about the id.
 *
 * Driven through `bot.handleUpdate` with a memory store and a fixed clock, so
 * what is asserted is what a player would have seen.
 *
 * FALSIFIED: with the two `bot.on('message:migrate_…')` registrations commented
 * out, every case in this file fails, and `/roll` in the migrated chat answers
 * *No table here yet. Send /new to open one.* — measured, not predicted.
 */

import { describe, expect, it } from 'vitest';
import { messageFor, type Language } from '@leela/content';
import { createBot } from '../src/bot';
import { MemoryReportSink, MemoryRoomStore, type RoomStore } from '../src/store';
import { DatabaseRoomStore } from '../src/persistence';
import { SqliteRoomQueries } from '../src/sqlite';
import type { Room } from '../src/commands';

const BOT_INFO = {
  id: 1,
  is_bot: true,
  first_name: 'Leela',
  username: 'leela',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business_account: false,
  has_main_web_app: false,
} as never;

const NOW = 1_700_000_000_000;

const HOST = 100;
const GUEST = 101;

interface Sent {
  method: string;
  /** Where it went. A private answer goes to the player, not to the table. */
  chatId: string;
  text: string;
}

/**
 * One bot, one store, one stopped clock, and everything it said.
 *
 * `botInfo` is supplied so `handleUpdate` never reaches the network, and the
 * transport is replaced wholesale — a test that needs a token is a test that
 * asserts the network is absent.
 *
 * The store is a parameter because the claim being made is about an ordering
 * — save under the new id, *then* delete the old one — and that ordering only
 * matters in the store that has a foreign key in it. See the last test in this
 * file.
 */
function harness(language: Language, store: RoomStore = new MemoryRoomStore()) {
  const reports = new MemoryReportSink(() => NOW);
  const sent: Sent[] = [];

  const bot = createBot({
    token: '1:TEST',
    botInfo: BOT_INFO,
    log: () => undefined,
    store,
    reports,
    now: () => NOW,
    readFile: async () => '',
  });

  bot.api.config.use(async (_prev, method, payload) => {
    const body = payload as { chat_id?: number | string; text?: string };
    sent.push({
      method,
      chatId: String(body.chat_id ?? ''),
      text: String(body.text ?? ''),
    });
    return { ok: true, result: method === 'answerCallbackQuery' ? true : { message_id: 1 } } as never;
  });

  let update = 0;

  /** A command or a line of words, from one of the two players. */
  const says = (chatId: number, kind: 'group' | 'supergroup', words: string, from: number) => {
    update += 1;
    return {
      update_id: update,
      message: {
        message_id: update,
        date: 1_700_000_000,
        chat: { id: chatId, type: kind, title: 'A table' },
        // The client's language, which is what opens the table in it and what
        // every answer before a room is known is written in.
        from: { id: from, is_bot: false, first_name: `P${from}`, language_code: language },
        text: words,
        entities: words.startsWith('/')
          ? [{ type: 'bot_command' as const, offset: 0, length: words.split(' ')[0]!.length }]
          : undefined,
      },
    };
  };

  /** One of Telegram's two upgrade service messages. It carries no text. */
  const service = (
    chatId: number,
    kind: 'group' | 'supergroup',
    carries: { migrate_to_chat_id?: number; migrate_from_chat_id?: number },
  ) => {
    update += 1;
    return {
      update_id: update,
      message: {
        message_id: update,
        date: 1_700_000_000,
        chat: { id: chatId, type: kind, title: 'A table' },
        from: { id: HOST, is_bot: false, first_name: `P${HOST}` },
        ...carries,
      },
    };
  };

  return { bot, store, reports, sent, says, service };
}

/** Whichever of the two service messages Telegram happens to deliver. */
type Route = 'in the new chat' | 'in the old chat';

interface Case {
  old: number;
  fresh: number;
  route: Route;
  language: Language;
}

/**
 * The grid.
 *
 * Built from the edge of every column rather than from a remembered example:
 * the ids a basic group can have against the ids a supergroup can have, each of
 * the two service messages, and each language the catalogue is complete in. The
 * claim is about an id changing, so every case here is the same claim.
 */
function grid(): Case[] {
  const olds = [-1, -4242, -987654321];
  const freshes = [-1000000000001, -1002147483647];
  const routes: Route[] = ['in the new chat', 'in the old chat'];
  const languages: Language[] = ['en', 'ru'];

  const cases: Case[] = [];
  for (const old of olds) {
    for (const fresh of freshes) {
      for (const route of routes) {
        for (const language of languages) cases.push({ old, fresh, route, language });
      }
    }
  }
  return cases;
}

/** What this case's players were playing for. Derived, so it is not a case. */
const intentionOf = (one: Case, who: number) =>
  `To see what ${who} was avoiding at ${one.old} before it became ${one.fresh}`;

/**
 * A game opened in a basic group, seated, playing, and then upgraded.
 *
 * The play is the point: a table with two seats, a question each, and a throw
 * taken, so what has to survive the move is a game rather than an empty row.
 */
async function playedAndUpgraded(one: Case, into?: RoomStore) {
  const kit = harness(one.language, into);
  const { bot, store, says, service } = kit;
  await bot.init();

  const say = (words: string, from = HOST) =>
    bot.handleUpdate(says(one.old, 'group', words, from) as never);

  await say('/new');
  await say('/join', GUEST);
  await say('/start');
  // The gate before the first throw: a table will not roll until whoever holds
  // the turn has said what they are playing for.
  await say(`/intention ${intentionOf(one, HOST)}`);
  await say(`/intention ${intentionOf(one, GUEST)}`, GUEST);
  await say('/roll');

  const before = structuredClone(await store.get(String(one.old))) as Room;
  kit.sent.length = 0;

  await bot.handleUpdate(
    (one.route === 'in the new chat'
      ? service(one.fresh, 'supergroup', { migrate_from_chat_id: one.old })
      : service(one.old, 'group', { migrate_to_chat_id: one.fresh })) as never,
  );

  const announced = [...kit.sent];
  kit.sent.length = 0;

  return { ...kit, before, announced, say };
}

/**
 * Every path through a value whose string is exactly this id.
 *
 * Exactly, not containing: `-1` is a substring of `-1000000000001`, so a search
 * for the old id inside the JSON of a room migrated to the new one would report
 * the new one as the old one. A check that cries wolf on correct code is one
 * somebody deletes rather than obeys.
 */
function named(value: unknown, id: string, at = 'room'): string[] {
  if (typeof value === 'string') return value === id ? [at] : [];
  if (Array.isArray(value)) return value.flatMap((item, index) => named(item, id, `${at}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => named(item, id, `${at}.${key}`));
  }
  return [];
}

/** Every id in the grid, so "somewhere else" can be asked as a question. */
const everyId = [
  ...new Set(grid().flatMap((one) => [one.old, one.fresh])),
].map(String);

describe('a chat that becomes a supergroup', () => {
  it('carries its table to the new id, whole', async () => {
    for (const one of grid()) {
      const { store, before } = await playedAndUpgraded(one);
      const where = `${one.old} → ${one.fresh}, ${one.route}`;

      const after = await store.get(String(one.fresh));

      // The shape first, because it is the claim: **nothing anywhere in the
      // room still names the chat that no longer exists.** A room carries the
      // chat id in two places — its own `chatId` and the engine session's `id`,
      // which `createSession` is handed the chat id to build — and the first
      // version of this move rewrote one of them. Named fields would have been
      // written to match whatever the code did; a walk over every string in the
      // room could not be.
      expect(named(after, String(one.old)), `${where}: still names the old chat`).toEqual([]);
      expect(named(after, String(one.fresh)), `${where}: names the new chat`).not.toEqual([]);

      // Then the game itself. Not "a table is there": the same table. Seats,
      // whose turn it is, the seed and the count of throws taken — the die is
      // deterministic from the last two, so a room that arrives with either of
      // them changed is a different game wearing the same seats.
      expect(after, where).toEqual({
        ...before,
        chatId: String(one.fresh),
        session: { ...before.session, id: String(one.fresh) },
      });
    }
  });

  it('leaves no room under an id no chat can address any more', async () => {
    for (const one of grid()) {
      const { store } = await playedAndUpgraded(one);
      const where = `${one.old} → ${one.fresh}, ${one.route}`;

      // The invariant, asked of every id in the grid rather than of the one
      // this case moved away from: after the move there is exactly one place a
      // room can be found, and it is the chat the players are sitting in.
      for (const id of everyId) {
        const room = await store.get(id);
        if (id === String(one.fresh)) expect(room, `${where}: at ${id}`).not.toBeNull();
        else expect(room, `${where}: at ${id}`).toBeNull();
      }
      // Not only the ids this file names: the store is holding exactly one
      // room, so there is nothing left anywhere for a sweep to have to find.
      if (store instanceof MemoryRoomStore) expect(store.size, where).toBe(1);

      // And by the other route a room can be reached by. A seat that still
      // answers with the old id is a seat pointing at a chat that is gone.
      for (const who of [HOST, GUEST]) {
        const seated = await store.roomOf!(String(who));
        expect(seated?.chatId, `${where}: roomOf ${who}`).toBe(String(one.fresh));
      }
    }
  });

  it('is still the same game to the players sitting in it', async () => {
    for (const one of grid()) {
      const { bot, sent, says, before } = await playedAndUpgraded(one);
      const where = `${one.old} → ${one.fresh}, ${one.route}`;

      // Driven, not read: the store having the room is one claim, and the bot
      // answering to it in the chat the players are in is the one that matters.
      // Both players throw, because which of them holds the turn depends on a
      // die — and a refusal naming the holder is still an answer from a table
      // that is there, which is what is being asked about.
      await bot.handleUpdate(says(one.fresh, 'supergroup', '/roll', HOST) as never);
      await bot.handleUpdate(says(one.fresh, 'supergroup', '/roll', GUEST) as never);
      await bot.handleUpdate(says(one.fresh, 'supergroup', '/board', GUEST) as never);

      const answers = sent.filter((s) => s.method === 'sendMessage');
      const vanished = messageFor(before.language, 'chat.noTable');
      expect(answers.some((s) => s.text === vanished), `${where}: /roll and /board`).toBe(false);

      // The board names everybody at the table, so "the same game" is shown
      // rather than asserted.
      for (const who of [HOST, GUEST]) {
        expect(answers.some((s) => s.text.includes(`P${who}`)), `${where}: P${who}`).toBe(true);
      }
    }
  });

  it('says so in the new chat, so a table that moved does not look like one that vanished', async () => {
    for (const one of grid()) {
      const { announced, before } = await playedAndUpgraded(one);
      const where = `${one.old} → ${one.fresh}, ${one.route}`;

      // In the new chat whichever service message arrived, because the old chat
      // is the thing that stopped taking messages.
      const inTheNewChat = announced.filter(
        (s) => s.method === 'sendMessage' && s.chatId === String(one.fresh),
      );
      expect(inTheNewChat.length, where).toBeGreaterThan(0);

      const vanished = messageFor(before.language, 'chat.noTable');
      for (const one_ of inTheNewChat) expect(one_.text, where).not.toBe(vanished);

      // Through the catalogue in the room's own language, like everything else
      // this bot says — not a bare English string written at the call site.
      expect(
        inTheNewChat.some((s) => s.text.includes(messageFor(before.language, 'chat.hint'))),
        where,
      ).toBe(true);

      // And nothing was said into the chat that no longer exists.
      expect(
        announced.some((s) => s.method === 'sendMessage' && s.chatId === String(one.old)),
        `${where}: spoke into the old chat`,
      ).toBe(false);
    }
  });

  it('lets go of the moved game when it ends, so nothing of it reaches the next one', async () => {
    for (const one of grid()) {
      const { bot, sent, store, reports, says } = await playedAndUpgraded(one);
      const where = `${one.old} → ${one.fresh}, ${one.route}`;

      const inTheNewChat = (words: string, from = HOST) =>
        bot.handleUpdate(says(one.fresh, 'supergroup', words, from) as never);

      // The game is reachable, so it can be ended — which is the whole of the
      // second loss: a table nobody can address is a table nobody can clear.
      await inTheNewChat('/end');
      expect(await store.get(String(one.fresh)), `${where}: after /end`).toBeNull();

      await inTheNewChat('/new');
      await inTheNewChat('/join', GUEST);
      sent.length = 0;

      // The property, over the room's identity rather than over one sentence:
      // whoever sat at the table that moved, and sits at no other table, is
      // playing for nothing until they say so again. Written this way because
      // the defect is not about the words somebody chose — it is about a
      // question outliving the game it belonged to.
      for (const who of [HOST, GUEST]) {
        const held = await reports.intention(String(who));
        expect(held ?? '', `${where}: what ${who} is playing for`).toBe('');

        await inTheNewChat('/intention', who);
        const answers = sent.filter((s) => s.method === 'sendMessage');
        sent.length = 0;

        expect(
          answers.map((s) => s.text),
          `${where}: /intention for ${who}`,
        ).toContain(messageFor(one.language, 'intention.none'));

        // Said twice on purpose: the answer is the catalogue's *and* the old
        // game's words are nowhere in it. Either alone could pass while the
        // other failed — a second reply carrying the old question would still
        // leave the first one right.
        const before = intentionOf(one, who);
        for (const answer of answers) {
          expect(answer.text, `${where}: ${who} was told the old question`).not.toContain(before);
        }
      }
    }
  });

  /**
   * The same claim, in the store that has a foreign key in it.
   *
   * Everything above runs against rooms in a map, where the order of two writes
   * is a matter of taste. It is not one here: `session_players.session_id`
   * references `sessions.id` `ON DELETE CASCADE` and there is no `ON UPDATE`,
   * so a move that deleted the old row first would take every seat at the table
   * with it and have nothing left to write under the new id. The rows are
   * counted rather than the room, because a room read back through
   * `roomFromRows` is exactly what a cascade would leave looking healthy — with
   * the seats gone, `read` answers *a table with no seats*, which the bot
   * reports as unreadable rather than as absent.
   */
  it('moves the rows, not just the room, in the store the deployment uses', async () => {
    for (const one of grid()) {
      const queries = new SqliteRoomQueries({ path: ':memory:', now: () => NOW });
      const store = new DatabaseRoomStore(queries, () => undefined);
      const { before } = await playedAndUpgraded(one, store);
      const where = `${one.old} → ${one.fresh}, ${one.route}`;

      expect(await queries.loadSession(String(one.old)), `${where}: old session row`).toBeNull();
      expect(await queries.loadSeats(String(one.old)), `${where}: old seat rows`).toEqual([]);

      expect(await queries.loadSession(String(one.fresh)), `${where}: new session row`).not.toBeNull();
      expect(
        (await queries.loadSeats(String(one.fresh))).map((seat) => seat.user_id).sort(),
        `${where}: the seats`,
      ).toEqual([String(HOST), String(GUEST)].sort());

      // And the game the rows rebuild into is the game that was played, which
      // is the only reason the rows matter.
      expect(await store.get(String(one.fresh)), where).toEqual({
        ...before,
        chatId: String(one.fresh),
        session: { ...before.session, id: String(one.fresh) },
      });
    }
  });
});
