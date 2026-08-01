/**
 * Turning a game into something you can read in a chat.
 *
 * Telegram gives us a monospace block and a handful of emoji, which is enough
 * to draw the board players already know: eight rows of nine, 1 in the bottom
 * left, 68 near the top. Seeing where you are on the actual board is most of
 * what a board game interface is for.
 */

import { ARROWS, BOARD_ROWS, SNAKES, WIN_LOKA, hasWon, isWaitingToEnter} from '@leela/engine';
import { asLeftToRight, type Language, messageFor } from '@leela/content';
import type { Room } from './commands';

/** Marks for players, in seating order. Distinct at a glance, and colourblind-safe. */
export const TOKENS = ['🔵', '🔴', '🟢', '🟡', '🟣', '🟠'] as const;

export function tokenFor(seat: number): string {
  // A seat that is not a whole number indexes nothing; every real one wraps.
  return TOKENS[Math.abs(Math.trunc(seat)) % TOKENS.length] ?? TOKENS[0];
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
    if (isWaitingToEnter(player.state)) return;
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
      const waiting = isWaitingToEnter(player.state);

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
 * A long text, formatted for a chat.
 *
 * Telegram truncates at 4096 characters, mid-word, so a text longer than that
 * is cut here at a paragraph and marked. It was cut at the *same* paragraph
 * every time: `renderPlan` took a body and returned its first page, and the
 * marker read "…continues. /plan 2 again for the rest." Asking again returned
 * the identical message. One plan text in eight is over the limit — 188 of the
 * 1584 this repository ships — so the rest of them was unreachable in the bot,
 * under an instruction saying how to reach it.
 *
 * So the pages are numbered and the marker says which one to ask for.
 */
export const MAX_MESSAGE_CHARS = 3500;

/**
 * A text as the messages a chat will actually accept.
 *
 * The companion's answer went to Telegram whole. The prompt asks it to be brief
 * and it usually is, but *usually* is not a limit: a model that runs long
 * produces a message the transport refuses, and a refused reply reaches the
 * player as *something went wrong, try again in a moment* — an error about a
 * good answer that was written and then thrown away.
 *
 * Split rather than truncated. `paginate` truncates a single over-long block on
 * purpose, because the blocks it packs are *reports* and half of somebody's
 * writing is worse than none. This splits the companion's own prose, where a
 * second message loses nothing.
 *
 * Paragraphs first, then lines, then — for a wall of text with no break in it
 * at all — on a space, and failing that mid-word, because something has to
 * give and a message that cannot be sent gives everything.
 */
export function intoMessages(text: string, limit = MAX_MESSAGE_CHARS): string[] {
  if (text.length <= limit) return text.length > 0 ? [text] : [];

  const out: string[] = [];
  let rest = text;

  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    // The last break of each kind inside the window, best first. `+ 2` and
    // `+ 1` keep the break itself out of the next message.
    const at =
      lastEnd(window, '\n\n', 2) ?? lastEnd(window, '\n', 1) ?? lastEnd(window, ' ', 1) ?? limit;

    const piece = rest.slice(0, at).trimEnd();
    // A break at the very front of the text cuts nothing but whitespace off.
    // Dropping the empty piece keeps a leading blank line from becoming a
    // message with nothing in it.
    if (piece.length > 0) out.push(piece);
    rest = rest.slice(at).trimStart();
  }

  if (rest.length > 0) out.push(rest);
  return out;
}

/** Where to cut, when the window holds this separator at all. */
function lastEnd(window: string, separator: string, width: number): number | null {
  const found = window.lastIndexOf(separator);
  // Not at the very start: cutting there would make an empty message and leave
  // the rest exactly as long as it was, which is a loop that never ends.
  return found > 0 ? found + width : null;
}

export interface Page {
  text: string;
  /** 1-based, and never past the end: asking for page 9 of 3 gives page 3. */
  page: number;
  pages: number;
}

/**
 * Break a text into the pages a chat can carry.
 *
 * Paragraphs are kept whole where one fits, because a page that begins
 * mid-sentence reads as a bug rather than as a page.
 */
export function paginate(text: string, room: number): string[] {
  if (room <= 0) return [text];

  const pages: string[] = [];
  let rest = text;

  while (rest.length > room) {
    const cut = rest.slice(0, room);
    const lastBreak = cut.lastIndexOf('\n\n');
    const take = lastBreak > room * 0.5 ? lastBreak : room;
    pages.push(rest.slice(0, take).trim());
    rest = rest.slice(take).trim();
  }

  if (rest.length > 0 || pages.length === 0) pages.push(rest);
  return pages;
}

/** One page of a long text, with its head and a marker when there is more. */
export function renderPaged(
  head: string,
  body: string,
  page: number,
  more: (next: number, pages: number) => string,
): Page {
  const room = MAX_MESSAGE_CHARS - head.length;
  const pages = paginate(escapeHtml(body), room);

  const index = Math.min(Math.max(Math.trunc(page) || 1, 1), pages.length);
  const text = pages[index - 1] ?? '';
  const last = index >= pages.length;

  return {
    page: index,
    pages: pages.length,
    text: last
      ? head + text
      : `${head + text}\n\n<i>${escapeHtml(more(index + 1, pages.length))}</i>`,
  };
}

export function renderPlan(
  language: Language,
  plan: number,
  title: string,
  body: string,
  page = 1,
): string {
  const head = `<b>${plan}. ${escapeHtml(title)}</b>\n${renderProgress(plan)}\n\n`;

  return renderPaged(head, body, page, (next, pages) =>
    messageFor(language, 'plan.continues', { plan, next, pages }),
  ).text;
}

/** One chapter of the rules book, formatted the same way. */
export function renderChapter(
  language: Language,
  index: number,
  title: string,
  body: string,
  page = 1,
): string {
  const head = `<b>${index}. ${escapeHtml(title)}</b>\n\n`;

  return renderPaged(head, body, page, (next, pages) =>
    messageFor(language, 'rules.continues', { chapter: index, next, pages }),
  ).text;
}
