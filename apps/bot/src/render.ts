/**
 * Turning a game into something you can read in a chat.
 *
 * Telegram gives us a monospace block and a handful of emoji, which is enough
 * to draw the board players already know: eight rows of nine, 1 in the bottom
 * left, 68 near the top. Seeing where you are on the actual board is most of
 * what a board game interface is for.
 */

import { ARROWS, BOARD_ROWS, SNAKES, WIN_LOKA, hasWon } from '@leela/engine';
import { asLeftToRight, type Language, messageFor } from '@leela/content';
import type { Room } from './commands';

/** Marks for players, in seating order. Distinct at a glance, and colourblind-safe. */
export const TOKENS = ['🔵', '🔴', '🟢', '🟡', '🟣', '🟠'] as const;

export function tokenFor(seat: number): string {
  return TOKENS[seat % TOKENS.length];
}

/** Escape the three characters Telegram's HTML parse mode cares about. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Draw the board.
 *
 * Each square is three characters wide so the grid stays square in a monospace
 * font. A square holds a player's token if someone is on it, otherwise a mark
 * for a snake head, an arrow tail, or the win square — and its number.
 */
export function renderBoard(room: Room): string {
  const occupants = new Map<number, string>();
  room.session.players.forEach((player, seat) => {
    // A player waiting to enter is not on the board yet. `hasWon` is the
    // shared check; repeating the condition is how three copies of it drifted.
    if (player.state.is_finished && !hasWon(player.state)) return;
    occupants.set(player.state.loka, tokenFor(seat));
  });

  const lines = BOARD_ROWS.map((row) =>
    row
      .map((plan) => {
        const token = occupants.get(plan);
        if (token) return token;
        if (plan === WIN_LOKA) return '🕉';
        if (plan in SNAKES) return '🐍';
        if (plan in ARROWS) return '🏹';
        // Two digits, zero-padded: a space here would be indistinguishable
        // from the separator and the grid would lose its columns.
        return String(plan).padStart(2, '0');
      })
      .join(' '),
  );

  return lines.join('\n');
}

/** Where each player stands, as a line each. */
export function renderStandings(room: Room): string {
  return room.session.players
    .map((player, seat) => {
      const name = escapeHtml(player.name ?? room.names[player.id] ?? player.id);
      const done = hasWon(player.state);
      const waiting = player.state.is_finished && !done;

      const where = done
        ? messageFor(room.language, 'standings.finished')
        : waiting
          ? messageFor(room.language, 'standings.waiting')
          : messageFor(room.language, 'standings.plan', { plan: player.state.loka });

      const turn = seat === room.session.turnIndex && room.started ? ' ←' : '';
      const owes = !player.reportSubmitted
        ? ` · ${messageFor(room.language, 'standings.owes')}`
        : '';

      return `${tokenFor(seat)} <b>${name}</b> — ${where}${owes}${turn}`;
    })
    .join('\n');
}

/**
 * A progress bar towards the win square.
 *
 * Deliberately not a percentage: Leela is not a race, and a number that goes
 * down when a snake takes you is discouraging in a way the game is not about.
 * The bar shows position, and the caption names the plan.
 */
export function renderProgress(plan: number, width = 12): string {
  const filled = Math.round((Math.min(plan, WIN_LOKA) / WIN_LOKA) * width);
  return '▰'.repeat(filled) + '▱'.repeat(Math.max(0, width - filled));
}

/** The board plus who is where, ready to send. */
export function renderBoardMessage(room: Room): string {
  return [
    // Isolated left-to-right: the squares are digits, and digits are weak in
    // the bidirectional algorithm, so an Arabic or Urdu client reorders a row
    // reading `01 02 03` into `03 02 01`. The string is fine and the board is
    // mirrored anyway. An isolate takes the grid out of the reader's paragraph.
    `<pre>${asLeftToRight(renderBoard(room))}</pre>`,
    renderStandings(room),
    '',
    `<i>${escapeHtml(messageFor(room.language, 'board.legend'))}</i>`,
  ].join('\n');
}

/**
 * A plan, formatted for a chat.
 *
 * Long plans are cut with a marker rather than silently truncated by Telegram
 * at 4096 characters, which would stop mid-word.
 */
export const MAX_MESSAGE_CHARS = 3500;

export function renderPlan(
  language: Language,
  plan: number,
  title: string,
  body: string,
): string {
  const head = `<b>${plan}. ${escapeHtml(title)}</b>\n${renderProgress(plan)}\n\n`;
  const room = MAX_MESSAGE_CHARS - head.length;
  const text = escapeHtml(body);

  if (text.length <= room) return head + text;

  const cut = text.slice(0, room);
  const lastBreak = cut.lastIndexOf('\n\n');
  const trimmed = lastBreak > room * 0.5 ? cut.slice(0, lastBreak) : cut;
  const more = messageFor(language, 'plan.continues', { plan });
  return `${head + trimmed.trim()}\n\n<i>${escapeHtml(more)}</i>`;
}
