/**
 * The Telegram transport.
 *
 * Deliberately thin: it turns an update into a call into `commands.ts` and the
 * replies back into messages. Anything resembling a rule belongs there, or in
 * `@leela/engine` — not here.
 */

import { Bot, type Context } from 'grammy';
import * as commands from './commands';
import type { Effect, Reply, Room } from './commands';
import {
  MemoryRoomStore,
  discardReports,
  seedFor,
  type ReportSink,
  type RoomStore,
} from './store';

export interface BotOptions {
  token: string;
  store?: RoomStore;
  /** Where reports are kept. Defaults to dropping them. */
  reports?: ReportSink;
  /** Injected so the report cooldown can be tested without waiting a day. */
  now?: () => number;
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
  now = Date.now,
}: BotOptions) {
  const bot = new Bot(token);

  /** Send every reply in order, so a move and its follow-up stay together. */
  async function deliver(ctx: Context, replies: Reply[]): Promise<void> {
    for (const reply of replies) {
      await ctx.reply(reply.text);
    }
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
      if (effect.kind !== 'report') continue;
      try {
        await reports.record({ userId: effect.userId, plan: effect.plan, text: effect.text });
      } catch (error) {
        console.error('[bot] failed to store a report', error);
      }
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
      await ctx.reply('No table here yet. Send /new to open one.');
      return;
    }

    const result = run(room, who);
    if (result.room) await store.save(result.room);
    await applyEffects(result.effects);
    await deliver(ctx, result.replies);
  }

  bot.command('start', async (ctx) => {
    // Telegram uses /start as the first-contact command, so a chat with no
    // table gets the help text rather than an error.
    const chatId = chatIdOf(ctx);
    const who = sender(ctx);
    if (!chatId || !who) return;

    const room = await store.get(chatId);
    if (!room) {
      await deliver(ctx, commands.help().replies);
      return;
    }

    const result = commands.start(room, who.id);
    if (result.room) await store.save(result.room);
    await deliver(ctx, result.replies);
  });

  bot.command('help', async (ctx) => deliver(ctx, commands.help().replies));

  bot.command('new', async (ctx) => {
    const chatId = chatIdOf(ctx);
    const who = sender(ctx);
    if (!chatId || !who) return;

    const existing = await store.get(chatId);
    if (existing && !existing.session.players.every((p) => p.state.is_finished)) {
      await ctx.reply('A game is already running here. Finish it, or send /end.');
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
    await ctx.reply('The table is cleared.');
  });

  bot.command('join', (ctx) => withRoom(ctx, (room, who) => commands.join(room, who)));

  bot.command('roll', (ctx) => withRoom(ctx, (room, who) => commands.roll(room, who.id, now())));

  bot.command('board', (ctx) => withRoom(ctx, (room) => commands.board(room)));

  bot.command('report', (ctx) =>
    withRoom(ctx, (room, who) => commands.report(room, who.id, ctx.match ?? '')),
  );

  bot.command('plan', (ctx) =>
    withRoom(ctx, (room, who) => {
      const raw = (ctx.match ?? '').trim();
      const requested = raw.length > 0 ? Number(raw) : undefined;
      return commands.plan(room, who.id, requested);
    }),
  );

  // A failing update should not take the process down, and the room should not
  // be left half-written — commands are pure, so nothing was written yet.
  bot.catch((error) => {
    console.error('[bot] update failed', error);
  });

  return bot;
}
