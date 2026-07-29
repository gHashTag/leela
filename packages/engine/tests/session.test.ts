import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  LEGACY_MOBILE,
  MAX_SEATS,
  NEUROLEELA,
  ONE_DAY_MS,
  ONLINE,
  SessionError,
  START_LOKA,
  WIN_LOKA,
  advance,
  canCurrentPlayerRoll,
  createSession,
  currentPlayer,
  isSessionOver,
  standings,
  submitReport,
  type Session,
} from '../src';

const NOW = 1_700_000_000_000;

function threeSeats(rules = NEUROLEELA) {
  return createSession('s1', [{ id: 'a' }, { id: 'b' }, { id: 'c' }], rules);
}

/** Roll for whoever holds the turn, ignoring gates that are not under test. */
function roll(session: Session, value: number, now = NOW) {
  return advance(session, value, now);
}

describe('createSession', () => {
  it('seats one to six players', () => {
    expect(createSession('s', [{ id: 'a' }]).players).toHaveLength(1);
    const six = Array.from({ length: MAX_SEATS }, (_, i) => ({ id: `p${i}` }));
    expect(createSession('s', six).players).toHaveLength(MAX_SEATS);
  });

  it('refuses an empty table or a seventh player', () => {
    expect(() => createSession('s', [])).toThrow(SessionError);
    const seven = Array.from({ length: MAX_SEATS + 1 }, (_, i) => ({ id: `p${i}` }));
    expect(() => createSession('s', seven)).toThrow(SessionError);
  });

  it('refuses duplicate player ids', () => {
    expect(() => createSession('s', [{ id: 'a' }, { id: 'a' }])).toThrow(SessionError);
  });

  it('starts everyone off the board waiting for a six', () => {
    for (const player of threeSeats().players) {
      expect(player.state.loka).toBe(WIN_LOKA);
      expect(player.state.is_finished).toBe(true);
      expect(player.lastRollAt).toBeNull();
    }
  });

  it('gives the turn to the first seat', () => {
    expect(currentPlayer(threeSeats()).id).toBe('a');
  });
});

describe('turn order', () => {
  it('passes the turn round the table', () => {
    let s = threeSeats();
    expect(currentPlayer(s).id).toBe('a');
    s = roll(s, 3).session;
    expect(currentPlayer(s).id).toBe('b');
    s = roll(s, 3).session;
    expect(currentPlayer(s).id).toBe('c');
    s = roll(s, 3).session;
    expect(currentPlayer(s).id).toBe('a');
  });

  it('keeps the turn on a six when the variant grants another throw', () => {
    let s = threeSeats(LEGACY_MOBILE);
    // The entry six consumes the turn even under legacy rules.
    const entry = roll(s, 6);
    expect(entry.keepsTurn).toBe(false);
    s = entry.session;
    expect(currentPlayer(s).id).toBe('b');

    // b enters, then c, then a is back on the board and rolls another six.
    s = roll(s, 6).session;
    s = roll(s, 6).session;
    expect(currentPlayer(s).id).toBe('a');
    const again = roll(s, 6);
    expect(again.keepsTurn).toBe(true);
    expect(currentPlayer(again.session).id).toBe('a');
  });

  it('passes the turn on a six when the variant does not grant one', () => {
    let s = threeSeats(NEUROLEELA);
    s = roll(s, 6).session;
    s = roll(s, 6).session;
    s = roll(s, 6).session;
    expect(currentPlayer(s).id).toBe('a');
    const again = roll(s, 6);
    expect(again.keepsTurn).toBe(false);
    expect(currentPlayer(again.session).id).toBe('b');
  });

  it('counts every roll taken at the table', () => {
    let s = threeSeats();
    for (const value of [3, 4, 5, 2]) s = roll(s, value).session;
    expect(s.rollCount).toBe(4);
  });
});

describe('finishing', () => {
  /** Walk a single-seat session to the win square. */
  function winner() {
    let s = createSession('w', [{ id: 'a' }], NEUROLEELA);
    s = roll(s, 6).session; // enters on plan 6
    expect(currentPlayer(s).state.loka).toBe(START_LOKA);
    // 6 -> 10 is an arrow to 23; 23 -> 27 is an arrow to 41; 41 -> 45 -> 67; 67 + 1 = 68.
    for (const value of [4, 4, 4, 1]) s = roll(s, value).session;
    return s;
  }

  it('ends a solo session when its player wins', () => {
    const s = winner();
    expect(currentPlayer(s).state.loka).toBe(WIN_LOKA);
    expect(isSessionOver(s)).toBe(true);
  });

  it('refuses to roll once the session is over', () => {
    expect(() => roll(winner(), 3)).toThrow(SessionError);
  });

  it('skips a seat that has already finished', () => {
    let s = createSession('m', [{ id: 'a' }, { id: 'b' }], NEUROLEELA);
    // a enters and walks to the win square; b never enters.
    s = roll(s, 6).session;
    s = roll(s, 1).session; // b fails to enter, turn back to a
    for (const value of [4, 4, 4, 1]) {
      s = roll(s, value).session;
      if (currentPlayer(s).id === 'b') s = roll(s, 1).session; // b keeps failing
    }
    expect(s.players[0].state.loka).toBe(WIN_LOKA);
    expect(isSessionOver(s)).toBe(false); // b is still trying
    expect(currentPlayer(s).id).toBe('b'); // a is skipped
  });

  it('does not treat a player who never entered as finished', () => {
    const s = threeSeats();
    expect(isSessionOver(s)).toBe(false);
  });
});

describe('report gate in a session', () => {
  it('asks for a report on the plan a player enters the game on', () => {
    const s = createSession('r', [{ id: 'a' }], CLASSIC);
    const entry = roll(s, 6);
    // Arriving on plan 6 is an arrival like any other: reflect before moving.
    expect(entry.owesReport).toBe(true);
    expect(canCurrentPlayerRoll(entry.session, NOW).reason).toBe('report-required');
  });

  it('blocks the next roll until the report is filed', () => {
    let s = createSession('r', [{ id: 'a' }], CLASSIC);
    s = submitReport(roll(s, 6).session, 'a'); // enter, then reflect on plan 6

    const moved = roll(s, 3); // now standing on plan 9
    expect(moved.owesReport).toBe(true);
    s = moved.session;

    expect(canCurrentPlayerRoll(s, NOW).reason).toBe('report-required');
    expect(() => roll(s, 2)).toThrow(/report-required/);

    s = submitReport(s, 'a');
    expect(canCurrentPlayerRoll(s, NOW).allowed).toBe(true);
  });

  it('does not gate variants that never asked for reports', () => {
    let s = createSession('r', [{ id: 'a' }], NEUROLEELA);
    s = roll(s, 6).session;
    const moved = roll(s, 3);
    expect(moved.owesReport).toBe(false);
    expect(canCurrentPlayerRoll(moved.session, NOW).allowed).toBe(true);
  });

  it('rejects a report from someone not at the table', () => {
    expect(() => submitReport(threeSeats(), 'nobody')).toThrow(SessionError);
  });
});

describe('cooldown in a session', () => {
  it('holds the player for a day between rolls', () => {
    let s = createSession('o', [{ id: 'a' }], ONLINE);
    s = submitReport(roll(s, 6, NOW).session, 'a'); // enter, reflect on plan 6

    const blocked = canCurrentPlayerRoll(s, NOW + 1000);
    expect(blocked.reason).toBe('cooldown');
    expect(blocked.nextAllowedAt).toBe(NOW + ONE_DAY_MS);

    expect(canCurrentPlayerRoll(s, NOW + ONE_DAY_MS).allowed).toBe(true);
  });
});

describe('standings', () => {
  it('ranks by plan, with finishers first', () => {
    let s = threeSeats();
    s = roll(s, 6).session; // a -> 6
    s = roll(s, 6).session; // b -> 6
    s = roll(s, 6).session; // c -> 6
    s = roll(s, 4).session; // a: 6 + 4 = 10, arrow to 23
    s = roll(s, 2).session; // b: 6 + 2 = 8

    const ranked = standings(s);
    expect(ranked[0].id).toBe('a');
    expect(ranked[0].state.loka).toBe(23);
    expect(ranked[1].id).toBe('b');
  });

  it('does not mutate the session', () => {
    const s = threeSeats();
    const order = s.players.map((p) => p.id);
    standings(s);
    expect(s.players.map((p) => p.id)).toEqual(order);
  });
});

describe('immutability', () => {
  it('never mutates the session it was given', () => {
    const s = threeSeats();
    const before = JSON.stringify(s);
    advance(s, 6, NOW);
    expect(JSON.stringify(s)).toBe(before);
  });
});
