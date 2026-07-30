import { describe, expect, it } from 'vitest';
import { ARROWS, BOARD_ROWS, SNAKES, TOTAL_PLANS, WIN_LOKA } from '@leela/engine';
import { join, openRoom, report, roll, start, type Room } from '../src/commands';
import {
  TOKENS,
  escapeHtml,
  renderBoard,
  renderBoardMessage,
  renderPlan,
  renderProgress,
  renderStandings,
  tokenFor, paginate, renderChapter} from '../src/render';

const NOW = 1_700_000_000_000;
const SEED = 4242;

function table(count = 2, seed = SEED): Room {
  let room = openRoom('chat-1', { id: 'u1', name: 'Ada' }, seed).room as Room;
  for (let i = 2; i <= count; i++) {
    room = join(room, { id: `u${i}`, name: `P${i}` }).room as Room;
  }
  return start(room, 'u1').room as Room;
}

/** Play until at least one player is on the board. */
function inPlay(room: Room, turns = 40): Room {
  for (let i = 0; i < turns; i++) {
    const holder = room.session.players[room.session.turnIndex];
    const result = roll(room, holder.id, NOW);
    room = result.room as Room;
    if (result.replies.some((r) => r.text.includes('/report'))) {
      room = report(room, holder.id, 'noted').room as Room;
    }
    if (room.session.players.some((p) => !p.state.is_finished)) break;
  }
  return room;
}

describe('renderBoard', () => {
  it('draws eight rows of nine', () => {
    const lines = renderBoard(table()).split('\n');
    expect(lines).toHaveLength(BOARD_ROWS.length);
    for (const line of lines) {
      expect(line.split(' ')).toHaveLength(9);
    }
  });

  it('marks the win square, every snake and every arrow', () => {
    const board = renderBoard(table());
    expect(board).toContain('🕉');
    expect((board.match(/🐍/g) ?? []).length).toBe(Object.keys(SNAKES).length);
    expect((board.match(/🏹/g) ?? []).length).toBe(Object.keys(ARROWS).length);
  });

  it('shows no player token before anyone has entered the game', () => {
    const board = renderBoard(table(3));
    for (const token of TOKENS) expect(board).not.toContain(token);
  });

  it('puts a token on the board once a player is in play', () => {
    const room = inPlay(table(1));
    const seated = room.session.players[0];
    expect(seated.state.is_finished).toBe(false);
    expect(renderBoard(room)).toContain(tokenFor(0));
  });

  it('shows a plan number for every square nobody is on and nothing marks', () => {
    const board = renderBoard(table());
    const marked = new Set([...Object.keys(SNAKES), ...Object.keys(ARROWS)].map(Number));
    for (let plan = 1; plan <= TOTAL_PLANS; plan++) {
      if (marked.has(plan) || plan === WIN_LOKA) continue;
      expect(board, `plan ${plan}`).toContain(String(plan).padStart(2, '0'));
    }
  });

  it('keeps every cell the same width, or the columns drift apart', () => {
    for (const line of renderBoard(inPlay(table(1))).split('\n')) {
      for (const cell of line.split(' ')) {
        // Two characters, or a single emoji — never a padded number, whose
        // space would be taken for the separator.
        expect([...cell].length, `cell "${cell}"`).toBeLessThanOrEqual(2);
        expect(cell).not.toContain(' ');
      }
    }
  });

  it('gives each seat a distinct token', () => {
    const seen = new Set(TOKENS.map((_, i) => tokenFor(i)));
    expect(seen.size).toBe(TOKENS.length);
  });
});

describe('renderStandings', () => {
  it('names everyone at the table', () => {
    const text = renderStandings(table(3));
    for (const name of ['Ada', 'P2', 'P3']) expect(text).toContain(name);
  });

  it('says a player is waiting before they enter', () => {
    expect(renderStandings(table(2))).toContain('waiting for a six');
  });

  it('marks whose turn it is', () => {
    expect(renderStandings(table(2))).toContain('←');
  });

  it('does not mark a turn before the game starts', () => {
    const waiting = openRoom('c', { id: 'u1', name: 'A' }, SEED).room as Room;
    expect(renderStandings(waiting)).not.toContain('←');
  });

  it('marks who owes a report', () => {
    const room = inPlay(table(1));
    // The player just moved and has not reported.
    const owing = room.session.players.some((p) => !p.reportSubmitted);
    if (owing) expect(renderStandings(room)).toContain('owes a report');
  });

  it('escapes a name that would otherwise break the markup', () => {
    const room = openRoom('c', { id: 'u1', name: '<b>Ada</b> & co' }, SEED).room as Room;
    const text = renderStandings(room);
    expect(text).toContain('&lt;b&gt;Ada&lt;/b&gt; &amp; co');
  });
});

describe('escapeHtml', () => {
  it('escapes exactly the three characters Telegram parses', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href="x"&gt;&amp;&lt;/a&gt;');
  });

  it('leaves ordinary text alone, including other scripts', () => {
    for (const text of ['Рождение (джанма)', '誕生', 'plain']) {
      expect(escapeHtml(text)).toBe(text);
    }
  });

  it('escapes the ampersand first, so an escape is not double-escaped', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});

describe('renderProgress', () => {
  it('is empty at the start and full at the win square', () => {
    expect(renderProgress(1, 10)).toMatch(/^▱+$/);
    expect(renderProgress(WIN_LOKA, 10)).toBe('▰'.repeat(10));
  });

  it('never overflows past the win square', () => {
    expect(renderProgress(72, 10)).toHaveLength(10);
    expect(renderProgress(72, 10)).toBe('▰'.repeat(10));
  });

  it('always has the width it was asked for', () => {
    for (let plan = 1; plan <= TOTAL_PLANS; plan++) {
      expect([...renderProgress(plan, 12)], `plan ${plan}`).toHaveLength(12);
    }
  });
});

describe('renderPlan', () => {
  it('leads with the number and the title', () => {
    expect(renderPlan('en', 1, 'Birth (janma)', 'text')).toMatch(/^<b>1\. Birth \(janma\)<\/b>/);
  });

  it('escapes a title and a body that contain markup', () => {
    const out = renderPlan('en', 1, 'A <b>title</b>', 'body & <i>more</i>');
    expect(out).toContain('A &lt;b&gt;title&lt;/b&gt;');
    expect(out).toContain('body &amp; &lt;i&gt;more&lt;/i&gt;');
  });

  it('stays inside what Telegram will accept', () => {
    const out = renderPlan('en', 1, 'Title', 'x'.repeat(20_000));
    expect(out.length).toBeLessThan(4096);
  });

  it('says the text continues rather than stopping mid-word', () => {
    const out = renderPlan('en', 1, 'Title', 'word '.repeat(2000));
    expect(out).toContain('continues');
  });

  it('leaves a short plan whole', () => {
    const out = renderPlan('en', 5, 'Short', 'a small body');
    expect(out).toContain('a small body');
    expect(out).not.toContain('continues');
  });
});

describe('renderBoardMessage', () => {
  it('puts the board in a preformatted block so the grid holds', () => {
    const text = renderBoardMessage(table());
    expect(text).toMatch(/^<pre>/);
    expect(text).toContain('</pre>');
  });

  it('carries the legend, because the marks are not self-explanatory', () => {
    const text = renderBoardMessage(table());
    expect(text).toContain('snake');
    expect(text).toContain('arrow');
  });
});

describe('a token for any seat at all', () => {
  // `TOKENS[seat % TOKENS.length]` was typed `string` and is not: a seat that
  // is not a whole number indexes nothing, and the board then drew `undefined`
  // where a player should be.
  it('gives a mark for every real seat', () => {
    for (let seat = 0; seat < 6; seat += 1) {
      expect(TOKENS).toContain(tokenFor(seat));
    }
  });

  it('gives one for a seat number nobody should have', () => {
    for (const seat of [-1, 6, 99, 1.5, -0.5]) {
      expect(TOKENS, String(seat)).toContain(tokenFor(seat));
    }
  });

  it('never returns nothing', () => {
    for (const seat of [NaN, Infinity, -Infinity]) {
      expect(typeof tokenFor(seat), String(seat)).toBe('string');
      expect(tokenFor(seat).length).toBeGreaterThan(0);
    }
  });
});

describe('a text longer than a chat can carry', () => {
  /**
   * Telegram truncates at 4096 characters, mid-word, so a long plan was cut
   * here at a paragraph and marked "…continues. /plan 2 again for the rest."
   *
   * Asking again returned the identical message. One plan text in eight is over
   * the limit — 188 of the 1584 this repository ships, the longest 6090
   * characters — so the rest of them was unreachable in the bot, under an
   * instruction saying how to reach it.
   *
   * The rule asserted is not "plan 2 has two pages": it is that the pages
   * cover the text, in order, without losing any of it.
   */

  const body = (paragraphs: number) =>
    Array.from({ length: paragraphs }, (_, n) => `Paragraph ${n} ${'word '.repeat(60)}`).join(
      '\n\n',
    );

  it('covers the whole text across its pages, losing nothing', () => {
    const text = body(40);
    const pages = paginate(text, 1000);

    // Every word survives, in order. Joining is enough: the split points are
    // whitespace.
    expect(pages.join(' ').replace(/\s+/g, ' ').trim()).toBe(text.replace(/\s+/g, ' ').trim());
  });

  it('gives a different page for a different number', () => {
    // The defect itself: asking again used to return the same message.
    const long = body(40);
    const first = renderPlan('en', 2, 'Maya', long, 1);
    const second = renderPlan('en', 2, 'Maya', long, 2);

    expect(first).not.toBe(second);
  });

  it('keeps every page inside the limit, head and marker included', () => {
    for (const paragraphs of [1, 5, 20, 60]) {
      const text = body(paragraphs);
      const pages = paginate(text, 3000);

      for (let page = 1; page <= pages.length; page += 1) {
        const rendered = renderPlan('en', 41, 'The human plane', text, page);
        expect(rendered.length, `${paragraphs} paragraphs, page ${page}`).toBeLessThanOrEqual(4096);
      }
    }
  });

  it('says which page to ask for next, and stops saying it at the end', () => {
    const text = body(40);
    const pages = paginate(text, 3000).length;
    expect(pages).toBeGreaterThan(1);

    expect(renderPlan('en', 2, 'Maya', text, 1)).toContain(`/plan 2 2`);
    expect(renderPlan('en', 2, 'Maya', text, pages)).not.toContain('continues');
  });

  it('gives the last page to anyone who asks past the end', () => {
    // A number out of range is a reader's typo, not a reason to say nothing.
    const text = body(40);
    const pages = paginate(text, 3000).length;

    expect(renderPlan('en', 2, 'Maya', text, 99)).toBe(renderPlan('en', 2, 'Maya', text, pages));
    expect(renderPlan('en', 2, 'Maya', text, 0)).toBe(renderPlan('en', 2, 'Maya', text, 1));
  });

  it('is one page when the text fits, with nothing about continuing', () => {
    const short = 'A short plan.';
    expect(paginate(short, 3000)).toEqual([short]);
    expect(renderPlan('en', 1, 'Birth', short)).not.toContain('continues');
  });

  it('breaks at a paragraph where one is near enough', () => {
    // A page that begins mid-sentence reads as a bug rather than as a page.
    const pages = paginate(body(40), 1000);
    for (const page of pages.slice(1)) {
      expect(page.startsWith('Paragraph')).toBe(true);
    }
  });

  it('carries a chapter the same way, since a chapter is longer than a plan', () => {
    const text = body(40);
    const first = renderChapter('en', 2, 'Introduction', text, 1);

    expect(first).toContain('/rules 2 2');
    expect(first.length).toBeLessThanOrEqual(4096);
    expect(renderChapter('en', 2, 'Introduction', text, 2)).not.toBe(first);
  });
});
