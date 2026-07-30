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
  type RuleSet,
  type Session,
  seededRoller,
  hasWon,
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

    // Entry included. This asserted the opposite — "the entry six consumes the
    // turn even under legacy rules" — and the published app has no such
    // exception: `upStepOffline` passes the turn in the `else` of
    // `if (count === 6)`, and a player who threw one is told `oneMoreThrow`.
    // It was invisible while every surface here was one player.
    const entry = roll(s, 6);
    expect(entry.keepsTurn).toBe(true);
    s = entry.session;
    expect(currentPlayer(s).id).toBe('a');

    // Still theirs after another six, and passed on anything else.
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
  it('holds the player for a day after they write, not after they throw', () => {
    // The day begins at `startStepTimer`, which the published app calls when
    // the report is posted. Entering on a six owes no report there, so this
    // walks one square further to reach a plan worth writing about.
    let s = createSession('o', [{ id: 'a' }], ONLINE);
    s = roll(s, 6, NOW).session; // enter; a six owes nothing and starts nothing
    s = roll(s, 3, NOW + 60_000).session; // now a report is owed

    const written = NOW + 3 * ONE_DAY_MS; // they took their time
    s = submitReport(s, 'a', written);

    const blocked = canCurrentPlayerRoll(s, written + 1000);
    expect(blocked.reason).toBe('cooldown');
    expect(blocked.nextAllowedAt).toBe(written + ONE_DAY_MS);

    expect(canCurrentPlayerRoll(s, written + ONE_DAY_MS).allowed).toBe(true);
  });

  it('does not start the day at the throw, however long ago it was', () => {
    let s = createSession('o', [{ id: 'a' }], ONLINE);
    s = roll(s, 6, NOW).session;
    s = roll(s, 3, NOW + 60_000).session;

    // A day after the throw, with nothing written: the gate is the report,
    // and it says so rather than telling them to come back tomorrow.
    expect(canCurrentPlayerRoll(s, NOW + ONE_DAY_MS * 2).reason).toBe('report-required');
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

describe('the leaderboard puts people where they actually are', () => {
  // A player waiting to enter sits on 68, the highest square on the board, so
  // sorting by position alone showed someone who had never rolled at the top —
  // as though they were one square from winning. The same trap as `hasWon`: 68
  // means two different things depending on how you got there.

  /** A single-seat session walked to the win square. */
  function winner(id: string) {
    let s = createSession(`w-${id}`, [{ id }], NEUROLEELA);
    s = roll(s, 6).session;
    for (const value of [4, 4, 4, 1]) s = roll(s, value).session;
    return s.players[0];
  }

  it('ranks a player on the board above one still waiting', () => {
    let s = threeSeats();
    s = roll(s, 6).session; // a enters, lands on 6
    // b and c never entered; both sit on 68 waiting.
    expect(standings(s).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('never puts a waiting player above someone playing, wherever they stand', () => {
    let s = threeSeats();
    s = roll(s, 6).session; // a enters on 6 — the lowest square in play
    const ranked = standings(s);
    const playing = ranked.findIndex((p) => p.id === 'a');
    const waiting = ranked.findIndex((p) => p.id === 'b');
    expect(playing).toBeLessThan(waiting);
  });

  it('ranks a finisher above everyone', () => {
    const done = winner('z');
    const session: Session = {
      ...threeSeats(),
      players: [...threeSeats().players.slice(0, 2), { ...done, id: 'c' }],
    };
    expect(standings(session)[0].id).toBe('c');
  });

  it('orders players on the board by how far along they are', () => {
    let s = threeSeats();
    s = roll(s, 6).session; // a -> 6
    s = roll(s, 6).session; // b -> 6
    s = roll(s, 6).session; // c -> 6
    s = roll(s, 4).session; // a: 6 + 4 = 10, arrow to 23
    s = roll(s, 2).session; // b: 6 + 2 = 8

    const ranked = standings(s).map((p) => p.id);
    expect(ranked.indexOf('a')).toBeLessThan(ranked.indexOf('b'));
    expect(ranked.indexOf('b')).toBeLessThan(ranked.indexOf('c'));
  });

  it('keeps seating order among players who are all still waiting', () => {
    expect(standings(threeSeats()).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the session', () => {
    const s = threeSeats();
    const order = s.players.map((p) => p.id);
    standings(s);
    expect(s.players.map((p) => p.id)).toEqual(order);
  });
});

describe('a session with nobody at it', () => {
  /**
   * `createSession` refuses an empty table, so this shape only arrives from
   * outside — a hand-built object, or rows read out of a database. It used to
   * produce `(from + step) % 0`, which is NaN, and the seat NaN indexes is
   * nobody. The turn holder was then `undefined` typed as a `SeatedPlayer`.
   */
  const empty: Session = {
    id: 'nobody',
    turnIndex: 0,
    rollCount: 0,
    rules: NEUROLEELA,
    players: [],
  };

  it('says whose turn it is by throwing, not by handing back nothing', () => {
    expect(() => currentPlayer(empty)).toThrow(SessionError);
    expect(() => currentPlayer(empty)).toThrow(/turn 0 at a table of 0/);
  });

  it('says the same for a turn index past the last seat', () => {
    const two = createSession('s', [{ id: 'a' }, { id: 'b' }]);
    expect(() => currentPlayer({ ...two, turnIndex: 5 })).toThrow(/table of 2/);
  });

  it('does not loop or crash when the turn has to move', () => {
    // `advance` reaches `nextSeat`, which divided by the number of players.
    expect(() => advance(empty, 3, NOW)).toThrow();
  });
});

describe('a throw that could not be made, in the app that shipped', () => {
  /**
   * `entities` returns nothing when the throw would overshoot 72, so
   * `createHistory` never runs and the day never begins. A player who cannot
   * move is not made to wait a day for the privilege.
   */
  function nearTheEnd(rules: RuleSet) {
    const session = createSession('s', [{ id: 'a' }], rules);
    const player = { ...session.players[0], state: {
      loka: 70,
      previous_loka: 69,
      direction: 'step 🚶🏼' as const,
      consecutive_sixes: 0,
      position_before_three_sixes: 0,
      is_finished: false,
    }, reportSubmitted: true, lastRollAt: null };
    return { ...session, players: [player] };
  }

  it('does not start the day under the published rules', () => {
    const before = nearTheEnd(ONLINE);
    const after = advance(before, 5, NOW);

    expect(after.event.isBlocked).toBe(true);
    expect(after.session.players[0].lastRollAt).toBeNull();
    // And so the next throw is allowed straight away.
    expect(canCurrentPlayerRoll(after.session, NOW + 1).allowed).toBe(true);
  });

  it('does start it under the traditional rules, which is what they said before', () => {
    const cooling: RuleSet = { ...CLASSIC, turnCooldownMs: ONE_DAY_MS };
    const after = advance(nearTheEnd(cooling), 5, NOW);

    expect(after.event.isBlocked).toBe(true);
    expect(after.session.players[0].lastRollAt).toBe(NOW);
    expect(canCurrentPlayerRoll(after.session, NOW + 1).reason).toBe('cooldown');
  });

  it('starts it for a throw that did move somebody, under every variant', () => {
    // The flag is about a refusal, not about throwing. A move always counts.
    for (const rules of [ONLINE, CLASSIC]) {
      const session = createSession('s', [{ id: 'a' }], rules);
      const entered = advance(session, 6, NOW);
      expect(entered.session.players[0].lastRollAt, rules.id).toBe(NOW);
    }
  });
});

describe('a six at a table, under the published rules', () => {
  it('owes no report, so the player throws again with nothing to write', () => {
    // Online play there gates on the report and on the day, and a six trips
    // neither: the run is one move, reported once, when it ends.
    const session = createSession('s', [{ id: 'a' }], ONLINE);
    const entered = advance(session, 6, NOW);

    expect(entered.owesReport).toBe(false);
    expect(entered.session.players[0].reportSubmitted).toBe(true);
  });

  it('owes one under the traditional rules', () => {
    const session = createSession('s', [{ id: 'a' }], CLASSIC);
    expect(advance(session, 6, NOW).owesReport).toBe(true);
  });
});

describe('who throws next, over a played table', () => {
  /**
   * Found by seating three players in the mini app for the first time: the
   * entering six passed the turn, and it should not.
   *
   * `upStepOffline` in the published app passes the turn in the `else` of
   * `if (count === 6)` — any six keeps it, entry included, and the thrower is
   * told `oneMoreThrow`. The branch here said "entering the game consumes the
   * six" and ignored `extraTurnOnSix`, which was invisible for as long as every
   * surface in this repository was one player.
   *
   * The rule, over a whole game rather than the two throws that were wrong: the
   * turn stays exactly when the variant grants an extra one.
   */

  it('passes the turn exactly when no extra throw was granted', () => {
    for (const rules of [CLASSIC, LEGACY_MOBILE, NEUROLEELA]) {
      let session = createSession('t', [{ id: 'a' }, { id: 'b' }, { id: 'c' }], rules);
      const die = seededRoller(7);

      for (let turn = 0; turn < 200; turn += 1) {
        const before = currentPlayer(session).id;
        const moved = advance(session, die(), NOW);
        session = moved.session;

        const after = currentPlayer(session).id;
        const othersPlaying = session.players.some(
          (player) => player.id !== before && !hasWon(player.state),
        );

        // An extra throw keeps the seat. Without one the turn moves on —
        // unless there is nobody left to move it to, when it comes back to the
        // only player still in the game.
        if (moved.keepsTurn) expect(after, `${rules.id} turn ${turn}`).toBe(before);
        else if (othersPlaying) expect(after, `${rules.id} turn ${turn}`).not.toBe(before);

        // The gate is what stops a player, not the seating: they hold the turn
        // and cannot throw until they have written.
        if (moved.owesReport) session = submitReport(session, moved.playerId, NOW);
        if (isSessionOver(session)) break;
      }
    }
  });

  it('keeps it for the six that enters the game, where sixes are kept', () => {
    for (const rules of [CLASSIC, LEGACY_MOBILE]) {
      const session = createSession('t', [{ id: 'a' }, { id: 'b' }], rules);
      const entry = advance(session, 6, NOW);

      expect(entry.event.isGameStart, rules.id).toBe(true);
      expect(entry.keepsTurn, rules.id).toBe(true);
      expect(currentPlayer(entry.session).id, rules.id).toBe('a');
    }
  });

  it('passes it for the six that enters, where sixes are not kept', () => {
    // `neuroleela` grants no extra throw at all, and the entry is not an
    // exception to that either.
    const session = createSession('t', [{ id: 'a' }, { id: 'b' }], NEUROLEELA);
    const entry = advance(session, 6, NOW);

    expect(entry.keepsTurn).toBe(false);
    expect(currentPlayer(entry.session).id).toBe('b');
  });
});
