/**
 * The Telegram transport.
 *
 * Deliberately thin: it turns an update into a call into `commands.ts` and the
 * replies back into messages. Anything resembling a rule belongs there, or in
 * `@leela/engine` — not here.
 */

import { Bot, InlineKeyboard, InputFile, type Context } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import { type Language, bookFor, messageFor, planFor, resolveLanguage } from '@leela/content';
import { isSessionOver, isWaitingToEnter } from '@leela/engine';
import { MAX_INTENTION_CHARS, isIntention } from '@leela/journal';
import type { Guide } from '@leela/ai';
import { Conversations } from './conversation';
import * as commands from './commands';
import type { Button, Effect, Reply, Room } from './commands';
import {
  DirectChannels,
  destinationFor,
  isBlockedByUser,
  nudgeToPrivate,
} from './delivery';
import { escapeHtml, intoMessages, renderBoardMessage, renderChapter, renderPlan } from './render';
import { FILE_TIMEOUT_MS, MAX_FILE_BYTES, asReport, decide, decideSquare, keep, within } from './take-in';
import { offer, serialise } from './take-out';
import {
  MemoryRoomStore,
  discardReports,
  discardSteps,
  seedFor,
  type ReportSink,
  type RoomStore,
  type StepSink,
} from './store';

export interface BotOptions {
  token: string;
  store?: RoomStore;
  /** Where reports are kept. Defaults to dropping them. */
  reports?: ReportSink;
  /** Where moves are kept. Defaults to dropping them. */
  steps?: StepSink;
  /** Injected so the report cooldown can be tested without waiting a day. */
  now?: () => number;
  /** Where the update log goes. Injected so tests can read it. */
  log?: (message: string) => void;
  /**
   * The companion that responds to a report. Optional: without it the gate
   * still works and the report is still kept, there is simply no reply.
   */
  guide?: Guide;
  /**
   * Who the bot is, when it should not ask.
   *
   * grammY calls `getMe` before handling anything unless it is told. Supplying
   * it is what lets the transport be driven in a test — `handleUpdate` with no
   * network at all — which is the difference between this file being asserted
   * and being hoped over.
   */
  botInfo?: UserFromGetMe;
  /**
   * How a document's bytes are read.
   *
   * Injected because otherwise the only way to test this path is to let a real
   * `fetch` fail against `api.telegram.org` — which is what the suite did. That
   * test waited three seconds for DNS, was the slowest thing in the package by
   * two orders of magnitude, and asserted that the network is absent rather
   * than that the bot answers. Worse, it made the *successful* path
   * untestable: a file has never been received in a test, because the fetch
   * always failed.
   */
  readFile?: (url: string) => Promise<string>;
  /**
   * How long that read may take. Injected for the same reason the read is:
   * a minute is right in production and unbearable in a test.
   */
  fileTimeoutMs?: number;
}

/** Who sent this update, as the commands layer wants them. */
function sender(ctx: Context): { id: string; name: string } | null {
  const from = ctx.from;
  if (!from) return null;
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || String(from.id);
  return { id: String(from.id), name };
}

function chatIdOf(ctx: Context): string | null {
  return ctx.chat ? String(ctx.chat.id) : null;
}

/**
 * A player's path with the account for their current arrival taken out.
 *
 * `history` is newest first, so the first entry on the square they are standing
 * on is the one this arrival produced — when there is one. `reportSubmitted` is
 * the gate's own answer to *has this arrival been written about*, so this asks
 * the question rather than inferring it from a timestamp.
 */
function behind<T extends { plan: number }>(
  history: ReadonlyArray<T>,
  plan: number,
  filedThisArrival: boolean,
): T[] {
  if (!filedThisArrival) return [...history];

  const at = history.findIndex((entry) => entry.plan === plan);
  return at === -1 ? [...history] : [...history.slice(0, at), ...history.slice(at + 1)];
}

export function createBot({
  token,
  store = new MemoryRoomStore(),
  reports = discardReports,
  steps = discardSteps,
  now = Date.now,
  log = console.log,
  guide,
  botInfo,
  // The default is the network, which is what production wants and what a test
  // must never be left to depend on.
  readFile = async (url) => (await fetch(url)).text(),
  fileTimeoutMs = FILE_TIMEOUT_MS,
}: BotOptions) {
  const bot = new Bot(token, botInfo ? { botInfo } : undefined);

  // Who the bot has managed to message directly. Telegram refuses anyone who
  // has not started a chat, and there is no way to ask in advance.
  const channels = new DirectChannels();

  // What each player has asked the companion, in the order it was said.
  const conversations = new Conversations();

  /**
   * The floor under everything below: an update never ends in silence.
   *
   * Each surface that can fail has been given its own sentence one at a time —
   * a room that would not save, a report that was not kept, a file that never
   * arrived — and each was found by going looking. The reads were not: about
   * thirty of them, `/path` and `/returns` and `/save` and the journey the
   * companion is given, every one of them assuming a store that answers. A sink
   * that throws on `history` took `/path` out of the middleware and left the
   * player looking at nothing.
   *
   * Guarding thirty call sites would guard thirty of them. This guards the
   * shape: **whatever fails, the player is told that something did.** The
   * particular sentences stay where they are — they say more, and they are
   * worth more — and this is what is underneath when there is no particular
   * sentence to say.
   *
   * `bot.catch` is not this. It covers the polling runner, so a webhook
   * deployment has no floor at all, and it cannot answer the player.
   */
  bot.use(async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      log(`[bot] unhandled: ${String(error)}`);
      try {
        await ctx.reply(messageFor(languageOf(ctx), 'chat.wentWrong'));
      } catch (replying) {
        // The failure was Telegram itself, or the chat is gone. Nothing to be
        // done and nothing to be said, but an operator can still be told.
        log(`[bot] could not even say so: ${String(replying)}`);
      }
    }
  });

  // Without this there is no way to tell "nothing arrived" from "it arrived
  // and the answer failed" — which is exactly the question asked the first
  // time the bot appeared not to work.
  bot.use(async (ctx, next) => {
    const text = ctx.message?.text ?? ctx.channelPost?.text;
    const from = ctx.from ? `${ctx.from.id}${ctx.from.username ? ` @${ctx.from.username}` : ''}` : 'unknown';
    const chat = ctx.chat ? `${ctx.chat.type}:${ctx.chat.id}` : 'no-chat';
    log(`[bot] <- ${chat} ${from}: ${text ?? `(${Object.keys(ctx.update).filter((k) => k !== 'update_id').join(',')})`}`);

    const started = now();
    await next();
    log(`[bot] -> handled in ${now() - started}ms`);
  });

  /** Buttons as a Telegram keyboard. One row, which fits on a phone. */
  function keyboard(buttons: Button[] | undefined): InlineKeyboard | undefined {
    if (!buttons?.length) return undefined;
    const markup = new InlineKeyboard();
    for (const button of buttons) markup.text(button.label, button.action);
    return markup;
  }

  /**
   * Send every reply in order, so a move and its follow-up stay together.
   * Only the last one carries the buttons — repeating them under each message
   * clutters the chat and leaves stale keyboards above.
   */
  /**
   * Each piece with whether it is the last one.
   *
   * The buttons belong under the end of a reply, not under every piece of it —
   * a keyboard repeated three times is three keyboards in the chat.
   */
  function withLast<T>(items: T[]): Array<[T, boolean]> {
    return items.map((item, index) => [item, index === items.length - 1]);
  }

  async function deliver(ctx: Context, replies: Reply[]): Promise<void> {
    const who = sender(ctx);
    const chatType = ctx.chat?.type ?? 'private';

    for (const [index, reply] of replies.entries()) {
      const last = index === replies.length - 1;
      const text = reply.html ? reply.text : escapeHtml(reply.text);
      const options = {
        parse_mode: 'HTML' as const,
        reply_markup: last ? keyboard(reply.buttons) : undefined,
        link_preview_options: { is_disabled: true },
      };

      const destination = who
        ? destinationFor(reply, {
            chatType,
            userId: who.id,
            canWriteDirectly: channels.canWrite(who.id),
          })
        : ({ kind: 'chat' } as const);

      // Long enough to be refused is long enough to be split. Only text this
      // side escaped: a reply that carries its own HTML is paginated upstream
      // and cutting tags in half here would break it.
      const pieces = reply.html ? [text] : intoMessages(reply.text).map(escapeHtml);

      if (destination.kind === 'chat') {
        for (const [piece, isLast] of withLast(pieces)) {
          await ctx.reply(piece, isLast ? options : { ...options, reply_markup: undefined });
        }
        continue;
      }

      if (destination.kind === 'chat-fallback') {
        // Say that it is private, without saying what it was.
        await ctx.reply(nudgeToPrivate(languageOf(ctx), commandOf(ctx)), { parse_mode: 'HTML' });
        continue;
      }

      try {
        for (const [piece, isLast] of withLast(pieces)) {
          await ctx.api.sendMessage(
            destination.userId,
            piece,
            isLast ? options : { ...options, reply_markup: undefined },
          );
        }
        channels.allow(destination.userId);
      } catch (error) {
        if (!isBlockedByUser(error)) throw error;
        channels.refuse(destination.userId);
        await ctx.reply(nudgeToPrivate(languageOf(ctx), commandOf(ctx)), { parse_mode: 'HTML' });
      }
    }
  }

  /**
   * The language to answer this update in, before a room is known.
   *
   * Telegram reports the client's language on every update, so even the
   * "there is no table here" replies can be in it. Once a room exists its own
   * language wins: a table is played in one language, not one per player.
   */
  function languageOf(ctx: Context, room?: Room | null): Language {
    return room?.language ?? resolveLanguage(ctx.from?.language_code);
  }

  /** The command that produced this update, for a message that names it. */
  function commandOf(ctx: Context): string {
    const text = ctx.message?.text ?? '';
    const match = text.match(/^\/([a-z]+)/i);
    return match ? `/${match[1]}` : 'the command';
  }

  /**
   * Perform the writes a turn asked for, and say when one did not happen.
   *
   * One `catch` used to cover both kinds with one sentence — *a history that
   * fails to write must not stop the game: the move has already happened, and
   * the board is the record that matters.* True of a move. Not true of a
   * report, and the difference cost the thing the game exists to produce.
   *
   * A move is bookkeeping about a board that is already saved in the room. A
   * report **is** the record. And the gate that says one was written lives in
   * that same saved room — so when `record` threw, the player was told "has
   * reported, you may throw", the gate opened, and their words were gone with
   * nothing anywhere saying so. The same defect the mini app had at a full
   * quota, one surface over, still standing after the pass that fixed the room.
   *
   * The game still goes on. They did write it; a database that is full is not
   * their doing, and making them write it again to reopen a gate they have
   * already earned punishes the wrong person. But they are told while their own
   * words are still on the screen a scroll above, which is the one moment
   * copying them somewhere costs nothing.
   */
  async function applyEffects(effects: Effect[] | undefined, ctx: Context): Promise<void> {
    for (const effect of effects ?? []) {
      try {
        if (effect.kind === 'report') {
          await reports.record({ userId: effect.userId, plan: effect.plan, text: effect.text });
        } else if (effect.kind === 'move') {
          await steps.record({
            userId: effect.userId,
            event: effect.event,
            ruleset: effect.ruleset,
          });
        }
      } catch (error) {
        console.error(`[bot] failed to store a ${effect.kind}`, error);
        if (effect.kind === 'report') {
          await ctx.reply(messageFor(languageOf(ctx), 'report.notKept'));
        }
      }
    }
  }

  /**
   * Let the companion respond to a report.
   *
   * Separate from `applyEffects` because storing is required and answering is
   * not: the report is kept whether or not a model is configured or reachable.
   */
  async function respondToReports(
    ctx: Context,
    room: Room,
    effects: Effect[] | undefined,
  ): Promise<void> {
    if (!guide) return;

    for (const effect of effects ?? []) {
      if (effect.kind !== 'report') continue;

      // The path the report belongs to. Without it a reflection on plan 40 is
      // read as though it were the first thing the player had ever said.
      //
      // Not read at all while the companion is silenced: it is a full pass
      // over everything the player has ever written, assembled for a call that
      // is not going to be made.
      const journey =
        reports.history && guide.status().available
        ? (await reports.history(effect.userId))
            .filter((entry) => entry.plan !== effect.plan || entry.text !== effect.text)
            .reverse()
            .map((entry) => ({ plan: entry.plan, text: entry.text }))
        : undefined;

      // How they arrived, which the prompt asks for and nothing was passing.
      // `systemPrompt` has five sentences for it — brought down by a snake,
      // carried up by an arrow, walked here one square at a time — and none of
      // them had ever reached a model, because this call site gave the plan and
      // not the move that produced it. A reflection on plan 8 read the same
      // whether the player climbed to it or was bitten down to it, in a game
      // whose whole subject is what an arrival means.
      const seat = room.session.players.find((player) => player.id === effect.userId);

      const reflection = await guide.reflect(effect.text, {
        language: room.language,
        plan: effect.plan,
        // The question these answers are answering.
        intention: (await reports.intention?.(effect.userId)) ?? undefined,
        direction: seat?.state.direction || undefined,
        previousPlan: seat?.state.previous_loka,
        journey,
      });

      // `fromModel` distinguishes an answer from the fallback sentence shown
      // when the companion is unreachable. Logging it is how an operator learns
      // the companion is down: the player sees a plausible message either way,
      // so silence here would make an outage invisible.
      if (!reflection.fromModel) {
        // Two different situations wore the same log line: a model that
        // hiccuped once, and a deployment whose key has never worked. The
        // guide knows which; say so here rather than leaving an operator to
        // read a balance page to find out.
        const { reason } = guide.status();
        log(
          `[bot] companion unavailable${reason ? ` — ${reason}` : ''}, ` +
            `sent the fallback for plan ${effect.plan}`,
        );
      }

      // Through `deliver`, not `ctx.reply`: a reflection on someone's own
      // report is as private as the report gate that asked for it. Going
      // straight to the chat would read it out to the whole table.
      await deliver(ctx, [{ text: reflection.text, broadcast: false }]);
    }
  }

  /**
   * Run a command that needs an open room, telling the user plainly when
   * there isn't one rather than failing silently.
   */
  /**
   * Keep a room, and say whether it was kept.
   *
   * A store can refuse: a database locked by the write before it, a volume
   * full, a disk that has gone. When it did, the exception left the middleware
   * and the player was told **nothing at all** — and silence is
   * indistinguishable from a broken bot, which is how this one first looked.
   *
   * Worse than the silence would have been the alternative: describing a throw
   * that was not kept. The die is deterministic from `(seed, rollsTaken)`, both
   * of which live in the room that was not saved — so the same command sent
   * again makes the *same* throw. Nothing is lost by saying so and stopping.
   */
  async function keepTheGame(room: Room, ctx: Context): Promise<boolean> {
    try {
      await store.save(room);
      return true;
    } catch (error) {
      log(`[bot] could not keep the game: ${String(error)}`);
      await ctx.reply(messageFor(languageOf(ctx), 'chat.notKept'));
      return false;
    }
  }

  async function withRoom(
    ctx: Context,
    run: (room: Room, who: { id: string; name: string }) => commands.CommandResult,
  ): Promise<void> {
    const chatId = chatIdOf(ctx);
    const who = sender(ctx);
    if (!chatId || !who) return;

    const room = await store.get(chatId);
    if (!room) {
      await ctx.reply(messageFor(languageOf(ctx), 'chat.noTable'));
      return;
    }

    const result = run(room, who);

    // Kept first, and nothing said if it was not. The effects belong to a turn
    // that happened, and so do the replies describing it.
    if (result.room && !(await keepTheGame(result.room, ctx))) return;

    await applyEffects(result.effects, ctx);
    await deliver(ctx, result.replies);
    await respondToReports(ctx, result.room ?? room, result.effects);
  }

  bot.command('start', async (ctx) => {
    // Telegram uses /start as the first-contact command, so a chat with no
    // table gets the help text rather than an error.
    const chatId = chatIdOf(ctx);
    const who = sender(ctx);
    if (!chatId || !who) return;

    const room = await store.get(chatId);
    if (!room) {
      await deliver(ctx, commands.help(languageOf(ctx)).replies);
      return;
    }

    const result = commands.start(room, who.id);
    if (result.room && !(await keepTheGame(result.room, ctx))) return;
    await deliver(ctx, result.replies);
  });

  bot.command('help', async (ctx) => deliver(ctx, commands.help(languageOf(ctx)).replies));

  /**
   * Let go of what belonged to a game that is over.
   *
   * `/end` already cleared the companion's memory, under the right sentence —
   * *a new game is a new conversation* — and left the other half standing. What
   * a player is playing for is kept by user id, so ending a table and opening
   * another carried the question across: `/intention` answered *you are playing
   * to answer this* with a sentence written for a game that no longer exists,
   * the gate before the first throw stayed open, and the companion of the new
   * game was told the old question. A new game is a new question too.
   *
   * **Unless they are still sitting somewhere.** The question is kept per
   * player rather than per table, so a player at two tables who ends one must
   * keep what they wrote for the other. `roomOf` is what answers that, and it
   * is optional — a store that does not offer it gets the older behaviour,
   * which is to let go, and that is stated here rather than discovered.
   *
   * @param except A chat whose table is being replaced, so a room still stored
   *   under it does not count as somewhere they are still playing.
   */
  /**
   * The table, and whether there is one that will not assemble.
   *
   * A store that keeps its rooms in memory cannot have an unreadable one and
   * says so by not having the method — the convention `roomOf` already follows.
   */
  async function readTable(chatId: string): Promise<{ room: Room | null; unreadable: boolean }> {
    if (store.read) return store.read(chatId);
    return { room: await store.get(chatId), unreadable: false };
  }

  async function letGoOfTheGame(room: Room | null, except?: string): Promise<void> {
    for (const seat of room?.session.players ?? []) {
      const elsewhere = await store.roomOf?.(seat.id);
      if (elsewhere && elsewhere.chatId !== except) continue;

      conversations.clear(seat.id);
      await reports.setIntention?.(seat.id, '');
    }
  }

  bot.command('new', async (ctx) => {
    const chatId = chatIdOf(ctx);
    const who = sender(ctx);
    if (!chatId || !who) return;

    const opened = await readTable(chatId);

    // A table that cannot be read is not an empty chat, and this is where the
    // difference was paid for: the guard below asks about `existing`, which was
    // null for both, so `/new` wrote a fresh table over every seat at a table
    // it had merely failed to parse. Refused rather than replaced, and `/end`
    // named in the answer, because clearing somebody's game should be a thing
    // they did on purpose.
    if (opened.unreadable) {
      await ctx.reply(messageFor(languageOf(ctx), 'chat.tableUnreadable'));
      return;
    }

    const existing = opened.room;

    // `players.every(is_finished)` looked like "the game is over" and was not:
    // a player waiting to enter sits on 68 with `is_finished` set, so a table
    // where nobody had thrown a six yet counted as finished and /new quietly
    // threw it away, seats and all. `isSessionOver` is the engine's own answer
    // and knows the difference — the third time that distinction has bitten.
    if (existing && !isSessionOver(existing.session)) {
      const key = existing.started ? 'chat.running' : 'chat.tableOpen';
      await ctx.reply(messageFor(languageOf(ctx, existing), key));
      return;
    }

    // A table replaced because its game is over is a table let go of, exactly
    // as one cleared by /end. This route did neither: a player who won and
    // opened another game kept both the old question and the old conversation.
    if (existing) await letGoOfTheGame(existing, chatId);

    const language = ctx.from?.language_code;
    const result = commands.openRoom(chatId, who, seedFor(chatId, now()), { language });
    if (result.room && !(await keepTheGame(result.room, ctx))) return;
    await deliver(ctx, result.replies);
  });

  bot.command('end', async (ctx) => {
    const chatId = chatIdOf(ctx);
    const who = sender(ctx);
    if (!chatId || !who) return;

    const there = await readTable(chatId);
    const ending = there.room;

    // The way out. A row nobody can read belongs to nobody — `mayEnd` cannot be
    // asked about a table that will not assemble — and the alternative is a
    // chat that can neither continue its game nor start another. So anyone in
    // the chat may clear it, and this is the only command that will.
    if (!ending && there.unreadable) {
      await store.delete(chatId);
      await ctx.reply(messageFor(languageOf(ctx), 'chat.cleared'));
      return;
    }

    // Clearing nothing is not clearing something. The old reply said *the table
    // is cleared* to a chat that had never had one, which is the shape this
    // repository keeps meeting: an absence answered as if it were an act.
    if (!ending) {
      await ctx.reply(messageFor(languageOf(ctx), 'chat.noTable'));
      return;
    }

    // A game in progress belongs to the people sitting at it. See `mayEnd`:
    // this command asked nothing at all, while `/start` beside it is host-only
    // and `/new` refuses to discard a running session.
    if (!commands.mayEnd(ending, who.id)) {
      await ctx.reply(messageFor(languageOf(ctx, ending), 'chat.endNotYours'));
      return;
    }

    await store.delete(chatId);

    // After the room is gone, so a seat that still answers `roomOf` is one at
    // another table rather than at this one.
    await letGoOfTheGame(ending);
    const cleared = await store.get(chatId);
    await ctx.reply(messageFor(languageOf(ctx, cleared), 'chat.cleared'));
  });

  bot.command('join', (ctx) => withRoom(ctx, (room, who) => commands.join(room, who)));

  /**
   * What this player is playing for, read before the throw.
   *
   * Absent when this bot's store cannot hold one at all, which is what tells
   * `roll` not to gate: refusing a throw for a question a deployment has
   * nowhere to keep would end the game for everybody using it.
   */
  async function askedOf(userId: string): Promise<commands.Asked | undefined> {
    if (!reports.intention) return undefined;
    return { intention: (await reports.intention(userId)) ?? '' };
  }

  bot.command('roll', async (ctx) => {
    const who = sender(ctx);
    const asked = who ? await askedOf(who.id) : undefined;
    await withRoom(ctx, (room, holder) => commands.roll(room, holder.id, now(), asked));
  });

  // The board and a plan are drawn here rather than in `commands.ts`, because
  // drawing is a property of the surface: the mini app renders the same game
  // as a grid, not as a monospace block.
  /**
   * `/path` — a player's own account of the squares they have stood on.
   *
   * The reports were being kept and never read back; this is what keeping them
   * was for. A store that cannot read them says so rather than showing an
   * empty list, which would read as "you never wrote anything".
   */
  bot.command('path', async (ctx) => {
    const chatId = chatIdOf(ctx);
    const who = sender(ctx);
    if (!chatId || !who) return;

    const entries = reports.history ? await reports.history(who.id) : null;

    // No table required: a path belongs to the player, not to the chat they
    // happen to be in. Clearing a table, or opening a different one, must not
    // hide everything they have written.
    const room = await store.get(chatId);
    const language = room?.language ?? resolveLanguage(ctx.from?.language_code);

    await deliver(ctx, commands.pathFor(language, entries));
  });

  /**
   * `/take` — one square, sent as the words it was shared as.
   *
   * A file is a path; this is the thing people actually pass on. It is a
   * command rather than any pasted message, because a message that happens to
   * begin with a number is not somebody asking this bot to file it.
   *
   * Dated on arrival, and the reply says so: a shared square carries no time,
   * and inventing one would put it at a place in the path where nothing
   * happened.
   */
  bot.command('take', async (ctx) => {
    const who = sender(ctx);
    if (!who) return;

    const language = languageOf(ctx);
    const existing = reports.history ? await reports.history(who.id) : null;
    const outcome = decideSquare(ctx.match ?? '', existing?.map(asReport) ?? null, now());

    if (outcome.kind === 'took') {
      // The square is kept and the sender's question is not. `/take` is how
      // somebody hands you a square they landed on, and reading their frame is
      // not adopting it — the route that *is* the player's own is the mini
      // app's hand-over, and it decides differently.
      await keep(reports, who.id, outcome.added);
      await ctx.reply(
        messageFor(language, 'square.took', { plan: outcome.added[0]?.plan ?? 0 }),
      );
      return;
    }

    await ctx.reply(
      messageFor(
        language,
        outcome.kind === 'nothing-new'
          ? 'square.had'
          : outcome.kind === 'not-kept'
            ? 'square.notKept'
            : 'square.unreadable',
      ),
    );
  });

  /**
   * A square handed over by the mini app, and the one thing it cannot do
   * itself.
   *
   * The mini app has the plans, the returns, the whole path — everything the
   * companion is given except the companion. It is a static page: a model needs
   * a key, and a key in a browser bundle is a key given away. So the half of
   * the product that was missing was not the reflection, it was the bridge.
   *
   * Telegram has one. A mini app opened from a keyboard button may `sendData`,
   * and the bot receives it here. What arrives is the same square format the
   * pass before last taught both surfaces to read and write, so this is
   * `/take` plus the sentence only this side can produce.
   *
   * Filed first and answered second, in that order: a reflection is worth
   * having and the account is worth keeping, and the one that must not be lost
   * to a slow model is the account.
   */
  bot.on('message:web_app_data', async (ctx) => {
    const who = sender(ctx);
    if (!who) return;

    const language = languageOf(ctx);
    const sent = ctx.message.web_app_data.data;
    const existing = reports.history ? await reports.history(who.id) : null;
    const outcome = decideSquare(sent, existing?.map(asReport) ?? null, now());

    if (outcome.kind !== 'took') {
      await ctx.reply(
        messageFor(
          language,
          outcome.kind === 'nothing-new'
            ? 'square.had'
            : outcome.kind === 'not-kept'
              ? 'square.notKept'
              : 'square.unreadable',
        ),
      );
      return;
    }

    await keep(reports, who.id, outcome.added);

    // The question, only where this player has none. This route is the one
    // place a square is unambiguously the sender's own — Telegram hands it over
    // from *their* mini app — so the frame is theirs and not a stranger's. A
    // question already given is never replaced: what somebody is playing for is
    // not a file's to set, nor an app's.
    if (outcome.intention && reports.intention && reports.setIntention) {
      const held = await reports.intention(who.id);
      if (!held) await reports.setIntention(who.id, outcome.intention);
    }

    const square = outcome.added[0];
    if (!square) return;

    await ctx.reply(messageFor(language, 'square.took', { plan: square.plan }));
    if (!guide) return;

    // The path this square belongs to, minus the square itself — the same rule
    // the report gate follows, so the companion is not handed the words it is
    // about to answer as though they were already history.
    const journey = reports.history
      ? (await reports.history(who.id))
          .filter((entry) => entry.plan !== square.plan || entry.text !== square.text)
          .reverse()
          .map((entry) => ({ plan: entry.plan, text: entry.text }))
      : undefined;

    const reflection = await guide.reflect(square.text, {
      language,
      plan: square.plan,
      // Sent, not stood on. Without this the companion is told the player is
      // on the square — they may be on plan 6, or not in the game at all — and
      // answers somebody else's account as though it were where they live.
      arrival: 'received',
      intention: (await reports.intention?.(who.id)) ?? undefined,
      journey,
    });

    if (!reflection.fromModel) log('[bot] the companion was unreachable for a handed-over square');
    await deliver(ctx, [{ text: reflection.text, broadcast: false }]);
  });

  /**
   * `/returns` — the squares that came back.
   *
   * `/path` answers "what have I written". This answers the question the game
   * is about: what keeps arriving. Same store, same absence rule — a bot that
   * keeps nothing says so rather than showing an empty list.
   */
  bot.command('returns', async (ctx) => {
    const chatId = chatIdOf(ctx);
    const who = sender(ctx);
    if (!chatId || !who) return;

    const entries = reports.history ? await reports.history(who.id) : null;

    const room = await store.get(chatId);
    const language = room?.language ?? resolveLanguage(ctx.from?.language_code);

    await deliver(ctx, commands.returnsFor(language, entries));
  });

  bot.command('board', (ctx) =>
    withRoom(ctx, (room) => ({
      room,
      replies: [
        {
          text: renderBoardMessage(room),
          broadcast: true,
          html: true,
          buttons: room.started
            ? commands.buttonsFor(room).filter((b) => b.action !== 'board')
            : [{ label: messageFor(room.language, 'button.join'), action: 'join' as const }],
        },
      ],
    })),
  );

  bot.command('report', (ctx) =>
    withRoom(ctx, (room, who) => commands.report(room, who.id, ctx.match ?? '', now())),
  );

  /**
   * The rules book, which nothing in this bot could open.
   *
   * `/rules` lists the chapters, `/rules 3` opens one, `/rules 3 2` its second
   * page. The paging is the same as a plan's, and for the same reason: a chat
   * cuts at 4096 characters.
   */
  bot.command('rules', async (ctx) => {
    const language = languageOf(ctx);
    const [first, second] = (ctx.match ?? '').trim().split(/\s+/).filter(Boolean);
    const requested = first === undefined ? undefined : Number(first);
    const chapters = bookFor(language);
    const chapter = requested === undefined ? undefined : chapters[requested - 1];

    if (chapter && Number.isInteger(requested)) {
      await ctx.reply(
        renderChapter(
          language,
          requested as number,
          chapter.title ?? chapter.slug,
          chapter.body,
          Number(second) || 1,
        ),
        { parse_mode: 'HTML' },
      );
      return;
    }

    await deliver(ctx, commands.rules(language, requested).replies);
  });

  /**
   * Ask the companion about the square you stand on.
   *
   * `Guide.answer` and its `history` were written when the companion was, and
   * nothing had ever called either: a player could be answered about a report
   * and could not ask a question. The published app has this half — a chat
   * screen with the last few messages replayed — so this is the missing end of
   * a wire, not a new idea.
   *
   * The conversation is kept in memory and per player, as it is there.
   */
  /**
   * `/intention` — what this player is playing for.
   *
   * The frame every report is written inside. This repository's own words: *the
   * game is being played to answer it, and the reports are the answer
   * accumulating* — and the bot had nowhere to keep one, so the companion, which
   * reads every report, had never been told what the reports were answering.
   *
   * Kept by player rather than by table: a chat has no profile, but the question
   * belongs to the person and follows them between tables, exactly as their
   * reports do.
   */
  bot.command('intention', async (ctx) => {
    const who = sender(ctx);
    if (!who) return;

    const language = languageOf(ctx);
    const said = (ctx.match ?? '').trim();

    if (!reports.intention || !reports.setIntention) {
      await ctx.reply(messageFor(language, 'intention.notKept'));
      return;
    }

    if (said.length === 0) {
      const held = await reports.intention(who.id);
      // Privately, because `/intention` with nothing after it is a request to
      // be **told** something. What a player is playing for may have been set
      // in a direct chat and read back at the table, and this said it out loud
      // to six people — `broadcast: false` is the same rule `/path` and `/ask`
      // have always gone through.
      //
      // The three replies below stay in the chat on purpose: two are about the
      // bot rather than the player, and the third is about a sentence they have
      // just typed where everyone could see it.
      await deliver(ctx, [
        {
          text: held
            ? messageFor(language, 'intention.yours', { text: held })
            : messageFor(language, 'intention.none'),
          broadcast: false,
        },
      ]);
      return;
    }

    // The format's answer, not a third copy of it. This was
    // `said.length < 2 || said.length > MAX_INTENTION_CHARS`, written inline
    // with the two as a literal, under a comment saying it was the mini app's
    // bound — which is exactly how one question comes to have three answers.
    /**
     * Which end of the rule was broken, said as itself.
     *
     * `isIntention` refuses both bounds and this answered every refusal with
     * *a little more than that — two characters at least*, so somebody who had
     * just written a considered question of nine hundred characters was told to
     * write more. The wrong cause, in the one dialog the game will not start
     * without — and the same shape as the report one field along: the other two
     * surfaces stop the box at the bound while it is being typed, and a chat
     * has no box to stop.
     *
     * Refused rather than clamped, unlike a report. The format keeps a report
     * that is too long by cutting the end off it; it drops an over-long
     * question **whole**, and a question cut mid-word is a different question.
     */
    if (!isIntention(said)) {
      const over = said.length - MAX_INTENTION_CHARS;
      await ctx.reply(
        over > 0
          ? messageFor(language, 'intention.tooLong', { count: over, max: MAX_INTENTION_CHARS })
          : messageFor(language, 'intention.tooShort'),
      );
      return;
    }

    await reports.setIntention(who.id, said);
    await ctx.reply(messageFor(language, 'intention.set'));
  });

  bot.command('ask', async (ctx) => {
    const who = sender(ctx);
    if (!who) return;

    const language = languageOf(ctx);
    const question = (ctx.match ?? '').trim();

    if (question.length === 0) {
      await ctx.reply(messageFor(language, 'ask.what'));
      return;
    }

    if (!guide) {
      await ctx.reply(messageFor(language, 'ask.silent'));
      return;
    }

    // The table in this chat, or — since the answer is private and so is the
    // natural place to ask — whichever table this player is actually seated
    // at. Asked in a private chat while playing in a group, this used to say
    // "take a seat first" to somebody holding one.
    const room =
      (await store.get(String(ctx.chat?.id ?? ''))) ?? (await store.roomOf?.(who.id)) ?? null;
    const seat = room?.session.players.find((player) => player.id === who.id);

    if (!seat) {
      await ctx.reply(messageFor(language, 'ask.notSeated'));
      return;
    }

    // A player who has not entered stands on no square. The engine parks them
    // on `WIN_LOKA` until a six moves them, so asking here used to tell the
    // companion they were on Cosmic Consciousness — and the whole package
    // exists to keep the answer resting on the right square's text.
    if (isWaitingToEnter(seat.state)) {
      await ctx.reply(messageFor(language, 'ask.notOnBoard'));
      return;
    }

    /**
     * The path, as the report gate already passes it — **minus the account
     * this arrival has already produced.**
     *
     * Without the path at all, the companion answering a *question* was blind
     * to everything the same companion sees when answering a report, including
     * what this player wrote the last times they stood on this very square.
     * With the whole of it, the account they wrote *on this arrival* went in
     * too, and `summariseReturns` announced it: **They have stood here before,
     * and wrote:** — about words from minutes ago — under a paragraph asking
     * the model to notice *what changed between the tellings*, of which there
     * was one.
     *
     * The report gate and the handed-over square both take out the words they
     * are about to answer, and say so in as many words. This is the same rule,
     * asked a different way: `/ask` has no text to filter by, so what comes out
     * is the newest account on this square, and only once the gate says this
     * arrival has been written about.
     */
    const journey =
      reports.history && guide.status().available
        ? behind(await reports.history(who.id), seat.state.loka, seat.reportSubmitted)
            .reverse()
            .map((entry) => ({ plan: entry.plan, text: entry.text }))
        : undefined;

    const reflection = await guide.answer(question, {
      language,
      plan: seat.state.loka,
      intention: (await reports.intention?.(who.id)) ?? undefined,
      direction: seat.state.direction || undefined,
      previousPlan: seat.state.previous_loka,
      history: conversations.of(who.id),
      journey,
    });

    // Only a real answer is worth remembering: replaying the fallback sentence
    // would teach the model that this is how it talks.
    if (reflection.fromModel) conversations.add(who.id, question, reflection.text);

    await deliver(ctx, [{ text: reflection.text, broadcast: false }]);
  });

  bot.command('plan', (ctx) =>
    withRoom(ctx, (room, who) => {
      // Two tokens, as `/rules` has always read them. `Number("2 2")` is NaN,
      // so `/plan 2 2` fell through to *the board runs from 1 to 72* — an
      // instruction the command had printed itself, four lines earlier, in
      // `plan.continues`: *…continues. /plan {plan} {next} for page {next}*.
      // A hundred and seventy-five plan texts across 22 languages had a second
      // page nothing could reach.
      const [first, second] = (ctx.match ?? '').trim().split(/\s+/).filter(Boolean);
      const requested = first === undefined ? undefined : Number(first);
      // The same question the pure command asks, and not a second answer to it.
      const number = requested ?? commands.standingSquare(room, who.id) ?? undefined;

      if (number === undefined || !Number.isInteger(number) || number < 1 || number > 72) {
        return commands.plan(room, who.id, requested);
      }

      const found = planFor(room.language, number);
      return {
        room,
        replies: [
          {
            text: renderPlan(room.language, number, found.title, found.body, Number(second) || 1),
            broadcast: false,
            html: true,
            buttons: room.started
            ? [{ label: messageFor(room.language, 'button.roll'), action: 'roll' as const }]
            : undefined,
          },
        ],
      };
    }),
  );

  /**
   * A button press runs the same command the slash version does.
   *
   * `answerCallbackQuery` has to be called or Telegram leaves a spinner on the
   * button for the user, so it happens first and unconditionally.
   */
  bot.on('callback_query:data', async (ctx) => {
    await ctx.answerCallbackQuery();

    const action = ctx.callbackQuery.data;
    const who = sender(ctx);
    const chatId = chatIdOf(ctx);
    if (!who || !chatId) return;

    if (action === 'help') {
      await deliver(ctx, commands.help(languageOf(ctx)).replies);
      return;
    }

    if (action === 'new') {
      const result = commands.openRoom(chatId, who, seedFor(chatId, now()), {
        language: ctx.from?.language_code,
      });
      if (result.room && !(await keepTheGame(result.room, ctx))) return;
      await deliver(ctx, result.replies);
      return;
    }

    const room = await store.get(chatId);
    if (!room) {
      await ctx.reply(messageFor(languageOf(ctx), 'chat.noTableShort'));
      return;
    }

    const result =
      action === 'roll'
        ? commands.roll(room, who.id, now(), await askedOf(who.id))
        : action === 'join'
          ? commands.join(room, who)
          : action === 'start'
            ? commands.start(room, who.id)
            : action === 'board'
              ? { room, replies: [{ text: renderBoardMessage(room), broadcast: true, html: true }] }
              : action === 'plan'
                ? planReply(room, who.id)
                : null;

    if (!result) return;

    if (result.room && !(await keepTheGame(result.room, ctx))) return;
    await applyEffects(result.effects, ctx);
    await deliver(ctx, result.replies);
  });

  /** A player's current plan, drawn. */
  function planReply(room: Room, playerId: string): commands.CommandResult {
    const seated = room.session.players.find((p) => p.id === playerId);
    if (!seated) return commands.plan(room, playerId);

    const found = planFor(room.language, seated.state.loka);
    return {
      room,
      replies: [
        {
          text: renderPlan(room.language, seated.state.loka, found.title, found.body),
          broadcast: false,
          html: true,
        },
      ],
    };
  }

  /**
   * `/save` — the path, as a file to keep.
   *
   * The other half of the bridge. The mini app has saved one since it learned
   * to; a player who plays mostly in a chat could not get what they had written
   * out at all, which made the bridge look finished when it went one way.
   */
  bot.command('save', async (ctx) => {
    const who = sender(ctx);
    if (!who) return;

    const language = languageOf(ctx);
    const existing = reports.history ? await reports.history(who.id) : null;
    const offered = offer(existing, new Date(now()).toISOString().slice(0, 10));

    if (offered.kind !== 'file') {
      await ctx.reply(
        messageFor(language, offered.kind === 'not-kept' ? 'file.notKept' : 'file.nothingToSave'),
      );
      return;
    }

    // As a document rather than as text: a path of forty plans is past what a
    // message can carry, and a file is the thing another surface can read.
    //
    // **Through the same decision every private reply goes through.**
    // `replyWithDocument` always answers the chat the command came from, so at
    // a table of six this posted one player's whole journal — every account
    // they had written, about every square they had stood on — for everybody to
    // read and to keep. `/path` next door has routed privately since it was
    // written; this was the same material with no such rule on it.
    const destination = destinationFor(
      { broadcast: false },
      { chatType: ctx.chat?.type ?? 'private', userId: who.id, canWriteDirectly: channels.canWrite(who.id) },
    );

    const file = new InputFile(Buffer.from(serialise(offered.document), 'utf8'), offered.name);
    const caption = messageFor(language, 'file.saved', { count: offered.count });

    // All three answers, as `deliver` handles them. A first attempt required
    // `direct` and broke the ordinary case: in a private chat the destination
    // *is* the chat, and refusing to send there sent a player who had asked in
    // a direct message a note telling them to ask in a direct message.
    if (destination.kind === 'chat') {
      await ctx.replyWithDocument(file, { caption });
      return;
    }

    if (destination.kind === 'chat-fallback') {
      // Said in the group without saying what it was.
      await ctx.reply(nudgeToPrivate(language, 'save'), { parse_mode: 'HTML' });
      return;
    }

    try {
      await ctx.api.sendDocument(destination.userId, file, { caption });
      channels.allow(destination.userId);
    } catch (error) {
      // The same 403 memory `deliver` keeps. Without it a blocked player costs
      // a failed API call on every `/save` they type.
      if (!isBlockedByUser(error)) throw error;
      channels.refuse(destination.userId);
      await ctx.reply(nudgeToPrivate(language, 'save'), { parse_mode: 'HTML' });
    }
  });

  /**
   * A path, sent as a file from the mini app.
   *
   * The two surfaces cannot see each other's reports without a server. A file
   * needs no server: the mini app saves one, the player forwards it here, and
   * whatever is new is kept. `@leela/journal` is the format, shared so the two
   * cannot describe it differently.
   */
  bot.on('message:document', async (ctx) => {
    const who = sender(ctx);
    if (!who) return;

    const language = languageOf(ctx);
    const document = ctx.message.document;
    const size = document.file_size ?? 0;

    // Asked before the file is fetched: there is no reason to download a
    // hundred megabytes to find out it is not a path.
    if (size > MAX_FILE_BYTES) {
      await ctx.reply(messageFor(language, 'file.tooBig'));
      return;
    }

    const existing = reports.history ? await reports.history(who.id) : null;
    let text = '';

    if (existing !== null) {
      try {
        const file = await ctx.getFile();
        text = await within(
          readFile(`https://api.telegram.org/file/bot${token}/${file.file_path}`),
          fileTimeoutMs,
          'reading the file',
        );
      } catch (error) {
        // Not `file.unreadable`. Nothing about the file is known yet — it was
        // never fetched — and telling a player their path is not a path, when
        // the truth is that a download stalled, sends them to save a perfectly
        // good one again and read the same sentence.
        log(`[bot] could not read the file: ${String(error)}`);
        await ctx.reply(messageFor(language, 'file.notFetched'));
        return;
      }
    }

    const outcome = decide(text, size, existing?.map(asReport) ?? null);

    if (outcome.kind === 'took') {
      await keep(reports, who.id, outcome.added);

      // A path brought back carries the question it was written for, and the
      // same rule holds: only where there is none.
      if (outcome.intention && reports.intention && reports.setIntention) {
        const held = await reports.intention(who.id);
        if (!held) await reports.setIntention(who.id, outcome.intention);
      }

      await ctx.reply(messageFor(language, 'file.took', { count: outcome.added.length }));
      return;
    }

    await ctx.reply(
      messageFor(
        language,
        outcome.kind === 'nothing-new'
          ? 'file.nothingNew'
          : outcome.kind === 'too-big'
            ? 'file.tooBig'
            : outcome.kind === 'not-kept'
              ? 'file.notKept'
              : 'file.unreadable',
      ),
    );
  });

  // Anything that is not a command still deserves an answer. Silence is
  // indistinguishable from a broken bot, and that is how this one first looked.
  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) {
      await ctx.reply(messageFor(languageOf(ctx), 'chat.unknown'));
      return;
    }

    const chatId = chatIdOf(ctx);
    const room = chatId ? await store.get(chatId) : null;

    if (!room) {
      await ctx.reply(messageFor(languageOf(ctx), 'chat.noTableHelp'));
      return;
    }

    const who = sender(ctx);
    const seated = who && room.session.players.find((p) => p.id === who.id);

    // A player who owes a report is almost certainly writing it, so take plain
    // text as the report rather than making them remember the command.
    if (seated && !seated.reportSubmitted && who) {
      const result = commands.report(room, who.id, ctx.message.text, now());
      if (result.room && !(await keepTheGame(result.room, ctx))) return;
      await applyEffects(result.effects, ctx);
      await deliver(ctx, result.replies);
      await respondToReports(ctx, result.room ?? room, result.effects);
      return;
    }

    await ctx.reply(messageFor(languageOf(ctx, room), 'chat.hint'));
  });

  // A failing update should not take the process down, and the room should not
  // be left half-written — commands are pure, so nothing was written yet.
  bot.catch((error) => {
    console.error('[bot] update failed', error);
  });

  return bot;
}
