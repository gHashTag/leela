/**
 * The Telegram transport.
 *
 * Deliberately thin: it turns an update into a call into `commands.ts` and the
 * replies back into messages. Anything resembling a rule belongs there, or in
 * `@leela/engine` — not here.
 */

import { Bot, InlineKeyboard, type Context } from 'grammy';
import { type Language, messageFor, planFor, resolveLanguage } from '@leela/content';
import type { Guide } from '@leela/ai';
import * as commands from './commands';
import type { Button, Effect, Reply, Room } from './commands';
import {
  DirectChannels,
  destinationFor,
  isBlockedByUser,
  nudgeToPrivate,
} from './delivery';
import { escapeHtml, renderBoardMessage, renderPlan } from './render';
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

export function createBot({
  token,
  store = new MemoryRoomStore(),
  reports = discardReports,
  steps = discardSteps,
  now = Date.now,
  log = console.log,
  guide,
}: BotOptions) {
  const bot = new Bot(token);

  // Who the bot has managed to message directly. Telegram refuses anyone who
  // has not started a chat, and there is no way to ask in advance.
  const channels = new DirectChannels();

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

      if (destination.kind === 'chat') {
        await ctx.reply(text, options);
        continue;
      }

      if (destination.kind === 'chat-fallback') {
        // Say that it is private, without saying what it was.
        await ctx.reply(nudgeToPrivate(languageOf(ctx), commandOf(ctx)), { parse_mode: 'HTML' });
        continue;
      }

      try {
        await ctx.api.sendMessage(destination.userId, text, options);
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
   * Apply a command's effects after its room has been saved.
   *
   * A report that fails to store must not stop the reply — the player has
   * written it and the gate has opened; losing the text is worse handled by
   * telling them nothing happened.
   */
  async function applyEffects(effects: Effect[] | undefined): Promise<void> {
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
        // A history that fails to write must not stop the game: the move has
        // already happened, and the board is the record that matters.
        console.error(`[bot] failed to store a ${effect.kind}`, error);
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

      const reflection = await guide.reflect(effect.text, {
        language: room.language,
        plan: effect.plan,
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
    if (result.room) await store.save(result.room);
    await applyEffects(result.effects);
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
    if (result.room) await store.save(result.room);
    await deliver(ctx, result.replies);
  });

  bot.command('help', async (ctx) => deliver(ctx, commands.help(languageOf(ctx)).replies));

  bot.command('new', async (ctx) => {
    const chatId = chatIdOf(ctx);
    const who = sender(ctx);
    if (!chatId || !who) return;

    const existing = await store.get(chatId);
    if (existing && !existing.session.players.every((p) => p.state.is_finished)) {
      await ctx.reply(messageFor(languageOf(ctx, existing), 'chat.running'));
      return;
    }

    const language = ctx.from?.language_code;
    const result = commands.openRoom(chatId, who, seedFor(chatId, now()), { language });
    if (result.room) await store.save(result.room);
    await deliver(ctx, result.replies);
  });

  bot.command('end', async (ctx) => {
    const chatId = chatIdOf(ctx);
    if (!chatId) return;
    await store.delete(chatId);
    const cleared = await store.get(chatId);
    await ctx.reply(messageFor(languageOf(ctx, cleared), 'chat.cleared'));
  });

  bot.command('join', (ctx) => withRoom(ctx, (room, who) => commands.join(room, who)));

  bot.command('roll', (ctx) => withRoom(ctx, (room, who) => commands.roll(room, who.id, now())));

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

  bot.command('board', (ctx) =>
    withRoom(ctx, (room) => ({
      room,
      replies: [
        {
          text: renderBoardMessage(room),
          broadcast: true,
          html: true,
          buttons: room.started
            ? commands.playingButtons(room.language).filter((b) => b.action !== 'board')
            : [{ label: messageFor(room.language, 'button.join'), action: 'join' as const }],
        },
      ],
    })),
  );

  bot.command('report', (ctx) =>
    withRoom(ctx, (room, who) => commands.report(room, who.id, ctx.match ?? '')),
  );

  bot.command('plan', (ctx) =>
    withRoom(ctx, (room, who) => {
      const raw = (ctx.match ?? '').trim();
      const requested = raw.length > 0 ? Number(raw) : undefined;
      const seated = room.session.players.find((p) => p.id === who.id);
      const number = requested ?? seated?.state.loka;

      if (number === undefined || !Number.isInteger(number) || number < 1 || number > 72) {
        return commands.plan(room, who.id, requested);
      }

      const found = planFor(room.language, number);
      return {
        room,
        replies: [
          {
            text: renderPlan(room.language, number, found.title, found.body),
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
      if (result.room) await store.save(result.room);
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
        ? commands.roll(room, who.id, now())
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

    if (result.room) await store.save(result.room);
    await applyEffects(result.effects);
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
      const result = commands.report(room, who.id, ctx.message.text);
      if (result.room) await store.save(result.room);
      await applyEffects(result.effects);
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
