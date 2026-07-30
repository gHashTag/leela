import { describe, expect, it } from 'vitest';
import {
  CLASSIC,
  ONLINE,
  canCurrentPlayerRoll,
  currentPlayer,
  hasWon,
  isSessionOver,
  type Session,
} from '@leela/engine';
import {
  afterReport,
  join,
  openRoom,
  report,
  roll,
  start,
  type Room,
} from '../src/commands';

/**
 * What the bot says when a report is filed, and whether it is true.
 *
 * The reply was one sentence — *"{name} has reported. You may throw."* — said
 * whatever the state was. Found by playing a whole game through these
 * functions rather than by reading them: a player who had just reached Cosmic
 * Consciousness was told they may throw, **one line after the bot announced the
 * game was over**. And at a table of two it was wrong far more often than that,
 * because a player reports when they owe a report and by then the turn has
 * usually moved on.
 *
 * These functions are pure — `(room, input)` to `(room, replies)` — so a whole
 * game plays out in a test, which is the only reason this was findable at all.
 * The rule asserted here is not the two situations that were wrong. It is:
 * **the sentence is true of the player it is about, at every report of a whole
 * game.**
 */

const NOW = 1_700_000_000_000;

function table(seed: number, ruleset = CLASSIC): Room {
  let room = openRoom('chat-1', { id: 'u1', name: 'Ada' }, seed).room as Room;
  room = join(room, { id: 'u2', name: 'Bo' }).room as Room;
  room = join(room, { id: 'u3', name: 'Cy' }).room as Room;
  room = start(room, 'u1').room as Room;

  return { ...room, session: { ...room.session, rules: ruleset } };
}

/** Every report filed in a game played to its end, with what was said. */
function playedGame(seed: number, ruleset = CLASSIC) {
  let room = table(seed, ruleset);
  const filed: { session: Session; playerId: string; now: number; text: string }[] = [];

  for (let turn = 0; turn < 600 && !isSessionOver(room.session); turn++) {
    const holder = currentPlayer(room.session);
    const thrown = roll(room, holder.id, NOW + turn * 1000);
    if (thrown.room) room = thrown.room;

    for (const seated of room.session.players) {
      if (seated.reportSubmitted) continue;

      const now = NOW + turn * 1000 + 1;
      const result = report(room, seated.id, `About ${seated.state.loka}.`, now);
      if (result.room) room = result.room;

      // The session as it is *after* filing, which is what the sentence
      // describes: the gate has just opened, or it has not.
      filed.push({
        session: room.session,
        playerId: seated.id,
        now,
        text: result.replies.map((reply) => reply.text).join(' '),
      });
    }
  }

  return filed;
}

describe('the sentence after a report is true of the player it is about', () => {
  const SEEDS = [1, 4242, 77, 20260801];

  it('never tells a player who has finished that they may throw', () => {
    // The one that started this. A game that has just been declared over, and
    // an invitation to keep playing it.
    for (const seed of SEEDS) {
      for (const moment of playedGame(seed)) {
        const player = moment.session.players.find((seated) => seated.id === moment.playerId);
        if (!player || !hasWon(player.state)) continue;

        expect(moment.text, `seed ${seed}`).not.toMatch(/may throw/i);
        expect(moment.text, `seed ${seed}`).toContain('complete');
      }
    }
  });

  it('never tells a player it is their turn when it is somebody else’s', () => {
    for (const seed of SEEDS) {
      for (const moment of playedGame(seed)) {
        const holder = currentPlayer(moment.session);
        if (holder.id === moment.playerId) continue;

        const player = moment.session.players.find((seated) => seated.id === moment.playerId);
        if (player && hasWon(player.state)) continue;

        expect(moment.text, `seed ${seed}`).not.toMatch(/may throw/i);
      }
    }
  });

  it('says "may throw" exactly when the engine would take the throw', () => {
    // The whole rule in one line, over every report of every game: the promise
    // and the gate are the same thing or one of them is lying.
    for (const seed of SEEDS) {
      for (const moment of playedGame(seed)) {
        const holder = currentPlayer(moment.session);
        const player = moment.session.players.find((seated) => seated.id === moment.playerId);

        const trulyMayThrow =
          holder.id === moment.playerId &&
          !(player && hasWon(player.state)) &&
          canCurrentPlayerRoll(moment.session, moment.now).allowed;

        expect(/may throw/i.test(moment.text), `seed ${seed} / ${moment.playerId}`).toBe(
          trulyMayThrow,
        );
      }
    }
  });

  it('meets three of the four situations in ordinary play', () => {
    // If a whole run never produced a finished player, the assertions above
    // would be vacuous. The fourth — waiting — cannot arise in a game played
    // straight through, and is covered on its own below: under `online` the
    // wait begins when the report is filed, and by then the turn has already
    // moved to somebody else.
    const seen = new Set<string>();

    for (const seed of SEEDS) {
      for (const moment of playedGame(seed)) {
        seen.add(afterReport(moment.session, moment.playerId, moment.now).say);
      }
    }

    expect([...seen].sort()).toEqual(['finished', 'may-roll', 'not-your-turn']);
  });
});

describe('the decision itself', () => {
  it('puts a finished game ahead of whose turn it is', () => {
    // A player who has finished is not waiting for their turn — they are done,
    // and being told to wait would be a promise of a throw that never comes.
    const room = table(4242);
    const won = {
      ...room.session,
      players: room.session.players.map((seated, index) =>
        index === 1
          ? {
              ...seated,
              state: {
                loka: 68,
                previous_loka: 51,
                direction: 'win 🕉' as const,
                consecutive_sixes: 0,
                position_before_three_sixes: 0,
                is_finished: true,
              },
            }
          : seated,
      ),
    };

    expect(afterReport(won, 'u2', NOW)).toEqual({ say: 'finished' });
  });

  it('names who does hold the turn, so the sentence can say it', () => {
    const room = table(4242);
    const holder = currentPlayer(room.session);
    const other = room.session.players.find((seated) => seated.id !== holder.id);

    expect(afterReport(room.session, other?.id ?? '', NOW)).toEqual({
      say: 'not-your-turn',
      holder: holder.id,
    });
  });

  it('defers to the ruleset about waiting rather than deciding itself', () => {
    // `online` makes a player wait a day between throws, counted from the
    // report. Nothing here knows that — `canCurrentPlayerRoll` does, and this
    // asks it. A player told "you may throw" and then refused for a day would
    // be the same defect wearing a different sentence.
    const room = table(4242, ONLINE);
    const holder = currentPlayer(room.session);

    // On the board, so the gate applies: a player waiting to enter is never
    // gated, because there is no plan to reflect on yet.
    const playing: Session = {
      ...room.session,
      players: room.session.players.map((seated) =>
        seated.id === holder.id
          ? {
              ...seated,
              state: { ...seated.state, loka: 41, previous_loka: 35, is_finished: false },
            }
          : seated,
      ),
    };

    const filed = { ...playing, players: playing.players };
    // Long enough for `online`, which refuses fewer than a hundred characters
    // — the published app's own rule, and a refused report never reaches this
    // decision at all.
    const written = `Where I am, at length, because this variant asks for a hundred characters before it will take a report at all.`;
    const reported = report({ ...room, session: filed }, holder.id, written, NOW);
    const verdict = afterReport(reported.room?.session ?? filed, holder.id, NOW);

    expect(verdict).toEqual({ say: 'wait', waitMs: ONLINE.turnCooldownMs });
  });

  it('says nothing strange about somebody who is not at the table', () => {
    const room = table(4242);
    expect(afterReport(room.session, 'nobody', NOW)).toEqual({ say: 'may-roll' });
  });
});
