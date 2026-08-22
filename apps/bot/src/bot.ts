/**
 * The Telegram transport.
 *
 * Deliberately thin: it turns an update into a call into `commands.ts` and the
 * replies back into messages. Anything resembling a rule belongs there, or in
 * `@leela/engine` — not here.
 */

import { Bot, InlineKeyboard, InputFile, Keyboard, type Context } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import { type Language, bookFor, messageFor, planFor, resolveLanguage } from '@leela/content';
import { isSessionOver, isWaitingToEnter } from '@leela/engine';
import { MAX_INTENTION_CHARS, isIntention, withoutOne } from '@leela/journal';
import type { Guide } from '@leela/ai';
import { Conversations } from './conversation';
import * as commands from './commands';
import type { Button, Effect, Reply, Room } from './commands';
import {
  DirectChannels,
  type Destination,
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

/** Where the mini app is published, when nothing says otherwise. */
export const DEFAULT_MINI_APP_URL = 'https://t27.ai/leela/';

/**
 * How many chats to remember having offered the board to.
 *
 * The same bound and the same failure as `MAX_REFUSED` next door: forgetting
 * costs one redrawn keyboard, which is a message the player has seen before and
 * not a defect.
 */
const MAX_OFFERED = 10_000;

/**
 * The URL the launch button opens.
 *
 * An environment variable rather than a constant, because the same bot runs
 * against a staging copy of the app and against the published one; a default so
 * that a deployment which sets nothing still gets a working button rather than
 * a silent absence of one.
 *
 * Anything that is not an HTTPS URL is refused and the default used instead.
 * Telegram rejects a `web_app` button with an `http://` URL by failing the
 * **whole `sendMessage` call**, not the button — so a typo in an environment
 * variable would not produce a dead button, it would stop the bot answering at
 * all. The caller says so in the log; taking the default is the behaviour that
 * keeps the game playable while somebody fixes the deployment.
 *
 * Takes the environment as an argument so this is a pure function and can be
 * asserted without writing to `process.env`.
 */
export function miniAppUrl(env: Record<string, string | undefined> = process.env): string {
  const set = env.LEELA_MINIAPP_URL?.trim();
  return set && set.startsWith('https://') ? set : DEFAULT_MINI_APP_URL;
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

/**
 * How many questions one player may put to the companion inside `ASK_WINDOW_MS`.
 *
 * `/ask` was the only surface in this bot that spends money with nothing at all
 * standing in the way. Everything else that reaches the model is bounded by the
 * game: a reflection costs one call per arrival, and the turn and the report
 * gate bound arrivals — five report messages on one arrival produce one call. A
 * question is bounded by how fast somebody can type.
 *
 * **Measured before this was written**, by driving `handleUpdate` with a
 * counting model: one player, fifty `/ask` updates, the clock never advanced —
 * fifty calls to the model, no cooldown, no cap.
 *
 * The donor bot did have a bound, and it was a paywall:
 * `leela-chakra-bot/src/index.ts` refuses the roll outright once a player is
 * past their first request and has not subscribed, with three Telegram Stars
 * tiers behind it. The rewrite took the companion and left the paywall, and
 * took no replacement with it. Nor was the paywall standing in for a limiter:
 * the donor's own `isLimitAi` — a three-a-day cap in
 * `core/supabase/payments.ts` — is called from nowhere, so the donor did not
 * rate-limit the model either. The obvious sentence about the donor is false,
 * and it is written down here rather than assumed.
 *
 * And the balance is **shared**. One player emptying it is not one player's
 * problem: a 402 puts `Guide` into its half-hour silence for everybody at once,
 * and a second player who has asked nothing then gets the fallback with the
 * model never called. That silence belongs to `packages/ai` and stays there.
 * This does not make it per-player; it slows how fast one player can reach it.
 *
 * Twelve an hour is a number, and the honest thing to say about it is that it
 * was chosen and not measured — nobody here has a distribution of how often a
 * real player asks anything. A bound set close to real usage is one somebody
 * raises, usually in a hurry and usually by whoever is being throttled, so it
 * is deliberately generous and it is one edit in one place.
 */
export const ASK_ALLOWANCE = 12;

/**
 * The window the allowance is counted over.
 *
 * Sliding, not a clock hour. A window that resets on the hour lets twice the
 * allowance through across the boundary and rewards whoever works out when the
 * boundary is.
 */
export const ASK_WINDOW_MS = 60 * 60_000;

/**
 * How many players' recent questions to hold at once.
 *
 * The same argument `MAX_CONVERSATIONS` is written under, and the same answer:
 * a process that is never restarted otherwise holds an entry for every player
 * who has ever asked anything. The least recently asking goes first, and being
 * evicted costs a player nothing but a fresh allowance — which takes ten
 * thousand other people asking something in between.
 */
export const MAX_ASKERS = 10_000;

/**
 * A per-player allowance over a sliding window, spent in the act of checking it.
 *
 * One method rather than a `mayAsk` and a `spend`, because two of them is a
 * call site that can ask permission and then forget to pay for it — and that
 * failure is silent and looks exactly like no bound at all. The guard is
 * written so it cannot be used that way.
 *
 * In memory and lost on a restart, like `Conversations` beside it. A restart
 * hands everybody a fresh allowance; a restart also throws away the running
 * conversations, and persistence here would be a database write on the path of
 * every question in order to defend against somebody who can restart the
 * process.
 *
 * Exported for the ask route: `serve.ts` bounds the board's HTTP questions by
 * address with this same guard, rather than growing a second sliding window
 * that would drift from this one at the first fix.
 */
export class Allowance {
  private readonly byPlayer = new Map<string, number[]>();

  constructor(
    private readonly allowance: number,
    private readonly windowMs: number,
    private readonly most: number,
  ) {}

  /**
   * Take one, and say how long to wait when there is none left to take.
   *
   * Returns 0 when the question may go on to the companion, and otherwise the
   * milliseconds until the oldest question still inside the window falls out of
   * it — which is the moment the next one is allowed, and the only honest
   * answer to *when may I ask again*.
   */
  take(playerId: string, at: number): number {
    const kept = (this.byPlayer.get(playerId) ?? []).filter((when) => at - when < this.windowMs);
    const spent = kept.length >= this.allowance;
    if (!spent) kept.push(at);

    // Deleted before it is set, so the map's own insertion order becomes an
    // order of last asking — which is what makes the eviction below the least
    // recently asking rather than the first player ever seen.
    this.byPlayer.delete(playerId);
    this.byPlayer.set(playerId, kept);

    while (this.byPlayer.size > this.most) {
      const oldest = this.byPlayer.keys().next();
      if (oldest.done) break;
      this.byPlayer.delete(oldest.value);
    }

    // `kept[0]` is there whenever the allowance is at least one; the fallback
    // is for an allowance of zero, where the wait is a whole window.
    return spent ? (kept[0] ?? at) + this.windowMs - at : 0;
  }
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

  // What each player has asked lately, so that one of them cannot spend the
  // companion's balance for everybody. See `ASK_ALLOWANCE`.
  const asks = new Allowance(ASK_ALLOWANCE, ASK_WINDOW_MS, MAX_ASKERS);

  // The messages whose attached bytes have already been taken in. See
  // `takeInDocument`: more than one route now reaches a document's bytes, and
  // importing a path twice would tell the player their own file holds nothing
  // new. Weak, so a message is forgotten with the update that carried it.
  const taken = new WeakSet<object>();

  // The updates that have already been told there is nowhere private to answer
  // them. See `nudgeOnce`: the sentence is worth saying and is not worth saying
  // twice, and it was being said once per reply that could not be delivered.
  const nudged = new WeakSet<object>();

  // Where the launch button goes. Read once, so a deployment that changes the
  // variable under a running process does not change it halfway through a game.
  const launchUrl = miniAppUrl();
  {
    const asked = process.env.LEELA_MINIAPP_URL?.trim();
    if (asked && asked !== launchUrl) {
      log(`[bot] LEELA_MINIAPP_URL is not an https URL, opening ${launchUrl} instead`);
    }
  }

  // The private chats the launch keyboard has already been sent to.
  //
  // A reply keyboard is not markup on a message: Telegram keeps it under the
  // input field until something replaces it, so sending it on every throw would
  // be an extra message each turn to redraw a button that is already there. The
  // donor did put its board button on every step and every report reply — it
  // could afford to, because it was inline and rode along on a message that was
  // being sent anyway.
  //
  // Per process, not per deployment: a restart forgets, and the cost of
  // forgetting is one extra message. The cost of remembering somewhere durable
  // would be a schema.
  const offered = new Set<string>();

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

  /**
   * A command written in a caption reaches the handler it names.
   *
   * Telegram puts the words of a photo, a voice note or a video in `caption`,
   * and the entities that mark up those words in `caption_entities`. grammY's
   * `bot.command('report')` is `filter(Context.has.command('report'))`, and
   * that predicate is gated on the query `:entities:bot_command` and then reads
   * `msg.entities.some(...)` — `entities`, never `caption_entities`. Its own
   * doc says so out loud: "commands are not matched in captions". So every one
   * of this bot's fifteen commands is unreachable to a player who types it
   * under a photo, and the update falls off the end of the chain in silence.
   *
   * Two ways to close that were open. The second — a caption-only handler that
   * re-dispatches by name — would have meant a second copy of the command
   * table, kept by hand beside the first, which is the fourth kind of thing to
   * have gone wrong in this repository. This is the first: the caption is
   * copied into `text` (and its entities into `entities`) *before* any command
   * is registered, so from there down there is one dispatch, not two, and a
   * command added tomorrow is reachable from a caption the day it is added.
   *
   * The filter is `message::bot_command`, whose empty L2 shortcut grammY
   * expands to `["entities", "caption_entities"]` — so this middleware is only
   * even entered for an update that carries a command in one place or the
   * other. For a plain text command it finds `text` already set and does
   * nothing at all.
   *
   * Only a command at offset zero is copied. A caption that merely mentions
   * `/roll` in the middle of a sentence is not a command in Telegram's own
   * reading of it, and must stay the player's words.
   *
   * ---
   *
   * AND the file underneath the caption is still taken in, before the command
   * runs. That is a correction of this middleware's own first version, which
   * lost it. MEASURED, one document and one set of bytes under four captions:
   * with no caption, with ordinary words, and with a command this bot does not
   * have, the path was imported and the player was told so; with a command it
   * does have, the path was imported no times and never mentioned. `/path`
   * answered "You have not written anything yet", `/save` answered "You have
   * not written anything to save yet", `/take` answered "That does not read as
   * a square" — each with the file that answers it in hand and unread. A
   * command handler replies and returns without `next()`, so `message:document`
   * below was never reached at all.
   *
   * The reading that was rejected: *the player wrote an instruction, so obey it
   * and let the attachment go.* It does not survive being written out with the
   * three commands it actually meets. `/path`, `/save` and `/take` are
   * instructions **about the path the file contains** — answering "what is my
   * path" with "you have written nothing", while holding the path, is not
   * respecting an instruction, it is discarding the evidence for it. The other
   * candidate fix — stop copying the caption, so the document surface keeps the
   * update — was rejected for the same reason from the other side: it loses the
   * command instead of the file, and the caption work exists because losing the
   * command was the original defect.
   *
   * So: bytes first, command second, and the order is the point rather than an
   * implementation detail. Import before dispatch and `/path` lists what was
   * just handed over; import after and it answers the older question and then
   * contradicts itself a line later. The player is told both things, in the
   * order that makes them one answer.
   */
  bot.on('message::bot_command', async (ctx, next) => {
    // Cast rather than narrow: the filter's own type is the union of "has
    // entities" and "has caption_entities", and the whole point here is to
    // write across that seam.
    const message = ctx.message as {
      text?: string;
      entities?: Array<{ type: string; offset: number; length: number }>;
      caption?: string;
      caption_entities?: Array<{ type: string; offset: number; length: number }>;
    };

    const leads = message.caption_entities?.some((e) => e.type === 'bot_command' && e.offset === 0);

    if (message.text === undefined && message.caption !== undefined && leads) {
      message.text = message.caption;
      message.entities = message.caption_entities;

      // The bytes, before the command that is about to consume this update.
      // `takeInDocument` returns at once for anything that is not a document,
      // and refuses to run twice over one message, so this is safe to ask for
      // unconditionally rather than by listing the kinds that carry a file.
      await takeInDocument(ctx);
    }

    await next();
  });

  /**
   * Buttons as a Telegram keyboard. One row, which fits on a phone.
   *
   * Two kinds of markup, because Telegram has two and they are not
   * interchangeable. An `InlineKeyboard` sits under the message and sends a
   * `callback_query` back; a reply `Keyboard` sits under the input field, is
   * private-chat-only for this purpose, and is **the only launch from which a
   * mini app may call `sendData`** — which is to say the only markup that can
   * produce the `message:web_app_data` update this file has handled all along.
   *
   * A reply carries one kind or the other, never both: Telegram's
   * `reply_markup` is a single field, so there is nothing to merge. When a list
   * somehow holds both, the launch wins — an action button is a shortcut for a
   * command the player can always type instead, and the launch is the only
   * route to the app there is.
   */
  function keyboard(buttons: Button[] | undefined): InlineKeyboard | Keyboard | undefined {
    if (!buttons?.length) return undefined;

    const launches = buttons.filter(commands.isLaunch);
    if (launches.length) {
      const markup = new Keyboard();
      for (const button of launches) markup.webApp(button.label, button.webAppUrl);
      // Without this the button is drawn at full keyboard height and takes up
      // half a phone screen for one control.
      return markup.resized();
    }

    const markup = new InlineKeyboard();
    for (const button of buttons) {
      if (button.action) markup.text(button.label, button.action);
    }
    return markup;
  }

  /**
   * Where a reply to this player would go, asked once and in one place.
   *
   * The decision itself lives in `delivery.ts` and is pure. What this adds is
   * the two arguments every caller was assembling for itself — the chat type
   * and whether the bot has ever managed to write to this player — which
   * `/save` had already had to write out a second time because a document is
   * not a `Reply`. A third copy was about to be written for each of the call
   * sites that ask *before* paying for an answer, and a decision written out
   * four times is four things to change.
   */
  function destinationOf(
    ctx: Context,
    reply: { broadcast: boolean },
    userId: string,
  ): Destination {
    return destinationFor(reply, {
      chatType: ctx.chat?.type ?? 'private',
      userId,
      canWriteDirectly: channels.canWrite(userId),
    });
  }

  /**
   * Say, in the group, that there is nowhere private for an answer to go —
   * **once per update, whatever asks.**
   *
   * The sentence carries none of the content, so two of them carry none of it
   * twice; what they do is repeat themselves at a table. It was emitted from
   * inside `deliver`'s per-reply loop, so a turn that produced two private
   * replies posted the identical sentence twice, and the report gate posted it
   * a third and fourth time when the reflection that followed had nowhere to go
   * either. Measured on the round-8 survey: the gate cost four nudges for two
   * commands.
   *
   * Keyed on the context object, which grammY builds one of per update, and
   * held weakly so an update is forgotten with the object that carried it —
   * the same rule and the same reason as `taken` above.
   */
  async function nudgeOnce(ctx: Context): Promise<void> {
    if (nudged.has(ctx)) return;
    nudged.add(ctx);
    await ctx.reply(nudgeToPrivate(languageOf(ctx), commandOf(ctx)), { parse_mode: 'HTML' });
  }

  /**
   * Put the board within reach — and with it, the only bridge the mini app has
   * back to this bot.
   *
   * Two things were missing and they are the same thing. `bot.on('message:
   * web_app_data')` below files a square handed over from the app and answers
   * it; that update arrives only from a Web App launched by a **reply-keyboard**
   * button, and this bot sent nothing but inline keyboards, so the handler and
   * everything behind it — decideSquare, square-keeping, intention adoption, the
   * companion's reflection — could never run. Separately, the donor bot put a
   * `Gameboard` button under every step and every report reply
   * (`leela-chakra-bot/src/commands/step/index.ts`) and the rewrite kept
   * neither, so a player in Telegram had no way to open the board at all.
   *
   * One reply keyboard is both: it opens the board, and what the board hands
   * back can be answered.
   *
   * **Private chats only, and that is Telegram's rule rather than a preference.**
   * A `web_app` reply-keyboard button is refused outside a private chat, and a
   * reply keyboard in a group is drawn for everybody at the table. So the offer
   * goes where the report gate's answers already go: the chat when it is
   * private, the player's own chat when the table is a group and the bot has
   * managed to write to them. When there is nowhere private, nothing is said —
   * whatever asked for a private answer is already saying so, and a second
   * sentence about a button would be noise on top of it.
   *
   * Sent at most once per chat per process; see `offered`.
   */
  async function offerTheBoard(ctx: Context, userId: string, language: Language): Promise<void> {
    const destination = destinationOf(ctx, { broadcast: false }, userId);
    if (destination.kind === 'chat-fallback') return;

    const where = destination.kind === 'direct' ? destination.userId : chatIdOf(ctx);
    if (!where || offered.has(where)) return;

    // Marked before the send, not after: two throws in flight would otherwise
    // both find it unsent and draw the keyboard twice.
    offered.add(where);
    while (offered.size > MAX_OFFERED) {
      const oldest = offered.values().next();
      if (oldest.done) break;
      offered.delete(oldest.value);
    }

    try {
      // No `parse_mode`, so nothing here is escaped: the text is one plain
      // sentence out of `@leela/content` and the button beside it carries the
      // meaning. The keyboard is the payload of this message, not decoration.
      await ctx.api.sendMessage(where, messageFor(language, 'menu.board'), {
        reply_markup: keyboard([commands.launchButton(language, launchUrl)]),
        link_preview_options: { is_disabled: true },
      });
      if (destination.kind === 'direct') channels.allow(where);
    } catch (error) {
      // Unsent, so unremembered: the next throw tries again.
      offered.delete(where);

      if (isBlockedByUser(error)) {
        channels.refuse(userId);
        return;
      }

      // Not rethrown. The command that called this has already been answered,
      // and a button that could not be drawn must not turn a completed throw
      // into an error the player reads as a lost turn. Logged, because an
      // operator whose LEELA_MINIAPP_URL is wrong learns it here.
      log(`[bot] could not offer the board: ${String(error)}`);
    }
  }

  /**
   * Ask where a private answer may go **before** anything is spent producing
   * one, and say the nudge if the answer is nowhere.
   *
   * `deliver` asks the same question, and asked it last: the model had already
   * been called, the allowance had already been spent, and the answer was
   * dropped on the floor with `chat-fallback`. For a player sitting in a group
   * who has never opened a private chat with the bot, that outcome is **known
   * before the call is made** — `DirectChannels` remembers the 403 the first
   * attempt earned — so every call after the first bought nothing. Five `/ask`
   * commands cost five model calls, five allowance tokens and delivered no
   * answers at all.
   *
   * The rule is not new to this file. `/save` has consulted `destinationFor`
   * before sending since the pass that made a journal private, and its comment
   * names the cost: *without it a blocked player costs a failed API call on
   * every `/save` they type*. A free Telegram call was guarded and a paid model
   * call was not.
   *
   * @returns true when the caller should stop — the player has been told.
   */
  async function nowhereToPutIt(ctx: Context, userId: string): Promise<boolean> {
    if (destinationOf(ctx, { broadcast: false }, userId).kind !== 'chat-fallback') return false;
    await nudgeOnce(ctx);
    return true;
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

    for (const [index, reply] of replies.entries()) {
      const last = index === replies.length - 1;
      const text = reply.html ? reply.text : escapeHtml(reply.text);
      const options = {
        parse_mode: 'HTML' as const,
        reply_markup: last ? keyboard(reply.buttons) : undefined,
        link_preview_options: { is_disabled: true },
      };

      const destination = who
        ? destinationOf(ctx, reply, who.id)
        : ({ kind: 'chat' } as const);

      // Long enough to be refused is long enough to be split. Only text this
      // side escaped: a reply that carries its own HTML is paginated upstream
      // and cutting tags in half here would break it.
      const pieces = reply.html ? [text] : intoMessages(reply.text).map(escapeHtml);

      if (destination.kind === 'chat') {
        for (const [piece, isLast] of withLast(pieces)) {
          await ctx.reply(piece, isLast ? options : { ...options, reply_markup: undefined });
        }

        // A message that arrived in this player's own chat **is** a direct
        // message to them, so a remembered refusal is out of date and the
        // proof is the send that just succeeded.
        //
        // `DirectChannels` used to forget a refusal in one way only: by trying
        // a direct message again and having it work. That was enough while the
        // refusal cost one failed API call per command. It is not enough now
        // that a refusal stops the companion being called at all — the routes
        // that would have retried no longer do, so a player who was refused in
        // March and opened a chat with the bot in April would never have been
        // tried again, and the nudge telling them to *open a chat with me, send
        // /start* would have changed nothing. The sentence has to be true.
        if (who && ctx.chat?.type === 'private' && String(ctx.chat.id) === who.id) {
          channels.allow(who.id);
        }

        continue;
      }

      if (destination.kind === 'chat-fallback') {
        // Say that it is private, without saying what it was — and say it once
        // for the update, not once for each reply in it. A turn with two
        // private replies posted the same sentence twice into the group.
        await nudgeOnce(ctx);
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
        await nudgeOnce(ctx);
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

      // Where the reflection would go, asked before it is paid for.
      //
      // A reflection is as private as the report that asked for it, so at a
      // table it goes to the player — and for a player who has never opened a
      // private chat with the bot there is nowhere to send it. `deliver` used
      // to discover that at the end, after the journey had been assembled and
      // the model had answered, and then drop the answer. The report itself is
      // already kept by `applyEffects` above; nothing of theirs is lost by
      // stopping here.
      if (await nowhereToPutIt(ctx, effect.userId)) continue;

      // The path the report belongs to. Without it a reflection on plan 40 is
      // read as though it were the first thing the player had ever said.
      //
      // Not read at all while the companion is silenced: it is a full pass
      // over everything the player has ever written, assembled for a call that
      // is not going to be made.
      const journey =
        reports.history && guide.status().available
        ? withoutOne(await reports.history(effect.userId), effect, (row) => row.createdAt.getTime())
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
        // What the companion has already said to this player, in order.
        //
        // This is the route every player is forced down — the gate after a
        // throw — and it was the one route that told the companion nothing of
        // its own. `/ask` is optional and had the memory; the compulsory path
        // did not, so a player who never typed `/ask` was answered by
        // something that had never heard itself. See `conversation.ts`.
        history: conversations.of(effect.userId),
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

      // Kept, under the same rule `/ask` keeps an answer under: only a real
      // answer, never the fallback sentence, which would teach the model that
      // this is how it talks. Paired with the account that produced it, because
      // an answer stored without what it answered is the shape this file's
      // conversation store exists to refuse.
      if (reflection.fromModel) conversations.add(effect.userId, effect.text, reflection.text);

      // Through `deliver`, not `ctx.reply`: a reflection on someone's own
      // report is as private as the report gate that asked for it. Going
      // straight to the chat would read it out to the whole table.
      await deliver(ctx, [{ text: reflection.text, broadcast: false }]);

      // The donor's other `Gameboard` button was under the report reply, and
      // this is where it belongs for a second reason: an answer has just been
      // delivered privately, so a private chat demonstrably exists.
      await offerTheBoard(ctx, effect.userId, room.language);
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

  /**
   * A chat that becomes a supergroup takes its table with it.
   *
   * Telegram does not move a group: it makes a supergroup, gives it a **new
   * id**, and leaves the old chat behind. Every room in this bot is keyed on
   * that id — `sessions.id` is the primary key, `session_players.session_id`
   * points at it and cascades on delete, and the whole `RoomStore` interface is
   * get/save/delete by chat id. So an upgrade, which any admin can perform in
   * two taps and which Telegram performs by itself when a group passes its
   * member limit, used to end a game in progress in the most confusing way
   * available: the players stayed in what is visibly the same chat, with the
   * same title and the same history, and the bot answered *No table here yet*
   * to `/roll`, `/board` and `/end` alike.
   *
   * Three separate losses, and the third is the one worth spelling out.
   *
   *   1. **The game.** Seats, turn, die and language, all still stored and none
   *      of it reachable, because no chat can address the old id any more.
   *   2. **The row.** `/end` is the only command that clears a table and it
   *      cannot be sent to a chat that no longer exists; `pruneFinished` keeps
   *      unfinished sessions on purpose. MEASURED against a real database with
   *      an abandoned row in it: `pruneFinished(-1)` returned 0 and the row was
   *      still there. Nothing in this bot would ever have removed it.
   *   3. **The intention.** What a player is playing for is kept by user id, and
   *      `letGoOfTheGame` is what drops it when a game ends. It only ever runs
   *      over the seats of a room the bot can *find* — `/end` reads one under
   *      this chat id, `/new` replaces one under this chat id. Neither can find
   *      the abandoned table, so the sentence written for it survived into the
   *      brand-new game opened in the supergroup: `/intention` in a game one
   *      minute old answered *you are playing to answer this* with a question
   *      belonging to a game nobody can reach. That is the exact defect the
   *      comment above `/new` says was paid for once already, coming back in
   *      through the one route it does not cover.
   *
   * Both service messages are handled, because either can be the one that
   * arrives: `migrate_from_chat_id` comes **in the new chat** and carries the
   * old id, `migrate_to_chat_id` comes **in the old chat** and carries the new
   * one. Handling both is not belt and braces — it is the only way the move
   * happens when a deployment was down for one of the two updates. Whichever
   * runs first does the move; the other then finds nothing under `from` and
   * returns, so the pair is idempotent rather than doubled.
   *
   * NOT handled, and deliberately: `GrammyError.parameters.migrate_to_chat_id`,
   * which Telegram attaches to a 400 when the bot sends *into* a chat that has
   * already migrated. It is a real second detection point and it is UNMEASURED
   * here — reaching it needs a live token and a real upgrade, and neither was
   * available. Writing it blind would mean a retry path in the send loop that
   * has never once been executed, which this repository has been bitten by
   * before. It is named here so the next person finds it as a known gap rather
   * than as an idea.
   */
  async function moveTheTable(from: string, to: string, ctx: Context): Promise<void> {
    // Telegram would not send either service message with both ids equal, but
    // a store asked to move a room onto itself would delete what it just wrote.
    if (from === to) return;

    const there = await readTable(from);
    if (!there.room) {
      // A row that will not assemble cannot have its chat id rewritten — the
      // rewrite goes through `Room`, and there is no `Room`. Left where it is
      // and said out loud, because the alternative is deleting somebody's game
      // to tidy up a log line.
      if (there.unreadable) {
        log(`[bot] chat ${from} is now ${to}: a table that cannot be read cannot be moved`);
      }
      return;
    }

    // Written under the new id first and removed from the old one second, and
    // the order is the whole of it: `session_players` references the session
    // and cascades on delete, so deleting first takes every seat with it and
    // leaves nothing to write. If the save throws, the delete never runs and
    // the game is still where it was.
    //
    // Both ids, and the second one is not tidiness. A `Room` carries the chat
    // id twice — its own `chatId` and the engine session's `id`, which
    // `createSession` is handed the chat id to build. Rewriting only the outer
    // one produced a room that two stores disagreed about: the memory store
    // handed back the object as written, with a session still naming the chat
    // that no longer exists, while the database rebuilt the session from the
    // row it was saved under and named the new one. MEASURED, by running this
    // move against `DatabaseRoomStore` and comparing — see the last test in
    // `a-chat-that-becomes-a-supergroup.test.ts`, which is what found it. A
    // game that says two different things about where it is depending on how
    // the process was started is the shape this repository keeps meeting.
    const moved = {
      ...there.room,
      chatId: to,
      session: { ...there.room.session, id: to },
    };
    await store.save(moved);
    await store.delete(from);

    // A table that moved and a table that vanished must not look the same. The
    // board is what says so in the players' own language, and it says it with
    // the seats and the turn holder in it — which is the evidence that the game
    // is the same game, not a claim that it is.
    //
    // Sent to `to` rather than replied, because on the `migrate_to_chat_id`
    // route this update arrived in the old chat, and the old chat is exactly
    // the thing that no longer takes messages.
    await ctx.api.sendMessage(
      to,
      `${renderBoardMessage(moved)}\n\n${escapeHtml(messageFor(moved.language, 'chat.hint'))}`,
      { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
    );
  }

  bot.on('message:migrate_from_chat_id', async (ctx) => {
    await moveTheTable(String(ctx.message.migrate_from_chat_id), String(ctx.chat.id), ctx);
  });

  bot.on('message:migrate_to_chat_id', async (ctx) => {
    await moveTheTable(String(ctx.chat.id), String(ctx.message.migrate_to_chat_id), ctx);
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

    // The table's language, taken from inside `withRoom` rather than read a
    // second time from the store: it is the one thing the offer below needs
    // from the room, and it is only defined when there was a room at all —
    // which is also exactly when a board is worth offering.
    let language: Language | undefined;
    await withRoom(ctx, (room, holder) => {
      language = room.language;
      return commands.roll(room, holder.id, now(), asked);
    });

    // Where the donor put its `Gameboard` button: under the step.
    if (who && language) await offerTheBoard(ctx, who.id, language);
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

    // Filed first and answered second, and this is the line between them: the
    // square is kept above whatever happens here. The same question `deliver`
    // asks at the end, asked before the answer is paid for — a reflection is
    // private, and a player with no private channel has nowhere for it to go.
    if (await nowhereToPutIt(ctx, who.id)) return;

    // The path this square belongs to, minus the square itself — the same rule
    // the report gate follows, so the companion is not handed the words it is
    // about to answer as though they were already history.
    //
    // Not read at all while the companion is silenced, which is the report
    // gate's other rule and was missing here: it is a full pass over everything
    // the player has ever written, assembled for a call that is not going to be
    // made. What the route does when the companion *is* available is unchanged.
    const journey =
      reports.history && guide.status().available
        ? withoutOne(await reports.history(who.id), square, (row) => row.createdAt.getTime())
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
      // The running conversation, as the report gate and `/ask` both pass it.
      // A square handed over from the app is answered in the same breath as
      // everything else this player has been told, or the companion contradicts
      // itself between two messages a minute apart.
      history: conversations.of(who.id),
      journey,
    });

    if (!reflection.fromModel) log('[bot] the companion was unreachable for a handed-over square');

    // Kept for the same reason and under the same condition as the report
    // gate's: an answer the player was actually shown is part of what has been
    // said to them, whichever surface said it.
    if (reflection.fromModel) conversations.add(who.id, square.text, reflection.text);

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

  bot.command('board', async (ctx) => {
    let language: Language | undefined;

    await withRoom(ctx, (room) => {
      language = room.language;
      return {
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
      };
    });

    // The command whose whole subject is the board is the one place a player
    // asking to see it should be handed the way to open it properly.
    const who = sender(ctx);
    if (who && language) await offerTheBoard(ctx, who.id, language);
  });

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
     * The last refusal that costs nothing: an answer with nowhere to go.
     *
     * An answer to `/ask` is private, so at a table it goes to the player — and
     * a player who has never opened a private chat with the bot cannot be sent
     * one. That is not a guess: `DirectChannels` remembers the 403 the first
     * attempt earned, so from the second command onwards the outcome is known
     * before anything is spent. `deliver` asked the same question at the end,
     * and the answer arrived, was paid for, and was dropped.
     *
     * **Above the allowance on purpose.** The wasted model call is the cheaper
     * half. `ASK_ALLOWANCE` is twelve an hour, and a player at a table used to
     * spend one on every discarded answer — five `/ask` commands cost five
     * tokens, one direct-message attempt and nothing delivered — so a player
     * could burn the hour on nothing and then be told to wait.
     */
    if (await nowhereToPutIt(ctx, who.id)) return;

    /**
     * One player's share of a balance that belongs to everybody. See
     * `ASK_ALLOWANCE` for what it protects and why the number is what it is.
     *
     * Taken **here** rather than at the top of the handler. Everything above
     * refuses without touching the model — no question, no companion, no seat,
     * not on the board yet, nowhere for the answer to go — and an allowance
     * spent on those would let a player lock themselves out of the companion by
     * mistyping. Everything below this line reaches it.
     *
     * That claim used to be written here and was false below the line, for
     * exactly the player it was written to protect. *No seat* and *not on the
     * board* refused for free; *nowhere to put the answer* was not asked at all
     * until `deliver` asked it, one model call and one allowance token later.
     * The sentence is true now because the question moved up here, and the
     * property that keeps it true is in
     * `tests/nowhere-to-put-the-answer.test.ts`: once a refusal is recorded, no
     * route in this file calls the companion again.
     *
     * Reports, rolls and the report gate are deliberately not bounded here.
     * They are bounded already, by the turn and by one account per arrival, and
     * a bound on them would be a change to what the game asks of a player —
     * which belongs in a `RuleSet` and not in a transport.
     */
    const wait = asks.take(who.id, now());
    if (wait > 0) {
      await ctx.reply(
        messageFor(language, 'ask.tooSoon', {
          // Rounded up and never zero: *ask again in 0 minutes* is an answer
          // that sends somebody straight back into the same refusal.
          count: Math.max(1, Math.ceil(wait / 60_000)),
          allowed: ASK_ALLOWANCE,
        }),
      );
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

    // The same two acts as the typed commands, reached by tapping instead. A
    // player who only ever presses buttons is exactly the player who will never
    // find the mini app any other way.
    if (action === 'roll' || action === 'board') {
      await offerTheBoard(ctx, who.id, room.language);
    }
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
    const offered = offer(
      existing,
      new Date(now()).toISOString().slice(0, 10),
      // The question goes with the path, as it does out of the other two
      // surfaces. Without it a player arriving on a phone is asked again.
      (await reports.intention?.(who.id)) ?? null,
    );

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
    const destination = destinationOf(ctx, { broadcast: false }, who.id);

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
      // Said in the group without saying what it was, through the one function
      // that says it. It used to name the command as `save`, where every other
      // caller names it as `/save` — and the sentence it lands in reads *then
      // try {command} again*.
      await nudgeOnce(ctx);
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
      await nudgeOnce(ctx);
    }
  });

  /**
   * What the bot does with words a player wrote, wherever they were carried.
   *
   * This was the body of the `message:text` handler and is now called from
   * there and from the caption handler below, because the alternative — a
   * second handler that takes a report — is two report gates that drift. The
   * leading-slash answer lives in here for the same reason: an unknown command
   * written under a photo must be answered with the same sentence as one typed
   * plainly, and it is one sentence because it is one function.
   */
  async function answerInWords(ctx: Context, words: string) {
    if (words.startsWith('/')) {
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
    // words as the report rather than making them remember the command.
    if (seated && !seated.reportSubmitted && who) {
      const result = commands.report(room, who.id, words, now());
      if (result.room && !(await keepTheGame(result.room, ctx))) return;
      await applyEffects(result.effects, ctx);
      await deliver(ctx, result.replies);
      await respondToReports(ctx, result.room ?? room, result.effects);
      return;
    }

    await ctx.reply(messageFor(languageOf(ctx, room), 'chat.hint'));
  }

  /**
   * Words carried as a caption are still words.
   *
   * The live bot this one replaces read the report off either place —
   * `message?.text ? message?.text : message?.caption` — and it had to: a
   * player photographs the page they wrote the report on, or says it into a
   * voice note, far more often than anyone designing this expected. This bot
   * registered four `bot.on` surfaces and none of them could see a caption, so
   * that player got no reply, no kept report and a gate still shut, which
   * under a day-long cooldown is indistinguishable from a bot that has died.
   *
   * Registered above `message:document` on purpose, and calling `next()` only
   * for a document. A file carries its own meaning as well as its caption's:
   * the path is still imported, and the words are still answered. Every other
   * kind — photo, voice, video, audio, animation — carries nothing but its
   * caption, so there is nothing downstream to fall through to.
   *
   * Still silent, measured rather than assumed: an update with no words at all
   * — a photo or a voice note sent with an empty caption box, a sticker, a
   * contact, a location. Answering those needs a sentence that does not exist
   * in `@leela/content` yet, and inventing one here costs twenty-two
   * translations. The test file names the gap.
   */
  bot.on('message:caption', async (ctx, next) => {
    await answerInWords(ctx, ctx.message.caption);
    if (ctx.message.document) await next();
  });

  /**
   * A path, sent as a file from the mini app.
   *
   * The two surfaces cannot see each other's reports without a server. A file
   * needs no server: the mini app saves one, the player forwards it here, and
   * whatever is new is kept. `@leela/journal` is the format, shared so the two
   * cannot describe it differently.
   */
  bot.on('message:document', takeInDocument);

  /**
   * Take a document's bytes in, at most once per message.
   *
   * Lifted out of `bot.on('message:document')` so that the caption middleware
   * above can run it *before* a command is dispatched. Two routes now reach the
   * same bytes — the plain document surface and a document whose caption leads
   * with a command — and an update can travel both: an *unregistered* command
   * in a caption matches no handler, falls through to `message:caption`, and
   * that calls `next()` for a document. Guarding the call sites would guard
   * today's two. The `taken` set guards the shape: whoever asks second is told
   * the work is done, and a third route added tomorrow cannot double-import a
   * player's path either.
   *
   * Keyed on the message object rather than on `ctx`: grammY builds one context
   * per update, so either would do today, but the message is the thing the
   * bytes belong to and it is what a future re-dispatch would carry.
   */
  async function takeInDocument(ctx: Context): Promise<void> {
    const who = sender(ctx);
    if (!who) return;

    const message = ctx.message;
    if (!message?.document) return;
    if (taken.has(message)) return;
    taken.add(message);

    const language = languageOf(ctx);
    const document = message.document;
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
  }

  // Anything that is not a command still deserves an answer. Silence is
  // indistinguishable from a broken bot, and that is how this one first looked.
  bot.on('message:text', async (ctx) => {
    await answerInWords(ctx, ctx.message.text);
  });

  // A failing update should not take the process down, and the room should not
  // be left half-written — commands are pure, so nothing was written yet.
  bot.catch((error) => {
    console.error('[bot] update failed', error);
  });

  return bot;
}
