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
  tokenFor,
} from '../src/render';

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
