import { createHmac } from 'node:crypto';
import { describe as group, expect, it } from 'vitest';

import { askRoute, type Rolled, type Standing } from '../src/serve';

/**
 * The board does not roll. It asks, and the chat's die answers.
 *
 * `specs/009` step 4 — **adopt** — settled on 2026-08-31 by a screenshot of
 * both surfaces open at once: the chat reading *«Вы стоите на плане 6»* and the
 * board, in the same session, reading *41. The human plane*. Two positions, one
 * player, one moment.
 *
 * Reading the chat's game was never the hard half. **A board that reads the
 * game and then throws its own die has two games again one throw later** — the
 * bot's own code said so before any of this was built: *the route serves a
 * position, not a table, so writing it into storage would make a board that
 * claims to be the chat's game and diverges from it the moment anybody rolls
 * here.*
 *
 * So the die is the bot's, and these assert the three things that makes true:
 * the value is never taken from the caller, the rules are the chat's own, and a
 * throw the rules forbid is a REASON rather than a silence.
 */

const TOKEN = '123456:AAHfake-token-for-tests-only';
const NOW = Date.UTC(2026, 7, 31, 12, 0, 0);
const ORIGIN = 'https://t27.ai';

const signed = (fields: Record<string, string>, token = TOKEN): string => {
  const checked = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  return new URLSearchParams({
    ...fields,
    hash: createHmac('sha256', secret).update(checked).digest('hex'),
  }).toString();
};

const launchAs = (id: number, token = TOKEN) =>
  signed({ auth_date: String(Math.floor(NOW / 1000) - 60), user: JSON.stringify({ id }) }, token);

const standing: Standing = {
  plan: 14,
  waiting: false,
  won: false,
  state: {
    loka: 14,
    previous_loka: 8,
    direction: 'step 🚶🏼',
    consecutive_sixes: 0,
    position_before_three_sixes: 8,
    is_finished: false,
  },
  yourTurn: true,
};

const rolled: Rolled = { roll: 6, standing, rollsAgain: true };

const throwing = (
  initData: string | null,
  options: Parameters<typeof askRoute>[0] = {},
  method = 'POST',
): Promise<Response> =>
  askRoute({ now: () => NOW, token: TOKEN, ...options })(
    new Request('https://leela.example/api/roll', {
      method,
      headers: {
        origin: ORIGIN,
        ...(initData === null ? {} : { authorization: `tma ${initData}` }),
      },
    }),
  );

group('one die, for the chat and the board alike', () => {
  it('throws for the caller, and asks by the VOUCHED id rather than any the body carries', async () => {
    /*
     * The whole security of this route, and the prior art on this disk is why
     * it is said out loud: the donor board read the user id out of `initData`
     * IN THE BROWSER and looked the player up with it, so anybody could roll
     * for anybody. The id comes from `whoSent`, which checked the signature.
     */
    const asked: string[] = [];
    const answer = await throwing(launchAs(8675309), {
      rollFor: async (userId) => {
        asked.push(userId);
        return rolled;
      },
    });

    expect(answer.status).toBe(200);
    expect(asked, 'rolled for somebody other than the signature').toEqual(['8675309']);
    expect(await answer.json()).toEqual(rolled);
  });

  it('REFUSES AN UNSIGNED THROW, and a forged one', async () => {
    // A refusal proves nothing on its own — a route that refuses everything
    // passes this — which is why the case above throws a real one through.
    const unsigned = await throwing(null, { rollFor: async () => rolled });
    expect(unsigned.status).toBe(401);

    const forged = await throwing(launchAs(8675309, '999:another-bot-entirely'), {
      rollFor: async () => rolled,
    });
    expect(forged.status).toBe(401);
  });

  it('TAKES NO ROLL FROM THE CALLER, whatever the body says', async () => {
    /*
     * The reason this is a POST with nothing in it. A value in the body is a
     * value the player chose, and every player can sign a launch for their own
     * game — so a board sending `{roll: 6}` would be a board that always
     * throws sixes. The bot's die is seeded per room and advanced by
     * `rollsTaken`; the answer's `roll` is what it showed.
     */
    const answer = await askRoute({
      now: () => NOW,
      token: TOKEN,
      rollFor: async () => ({ ...rolled, roll: 3 }),
    })(
      new Request('https://leela.example/api/roll', {
        method: 'POST',
        headers: { origin: ORIGIN, authorization: `tma ${launchAs(8675309)}`, 'content-type': 'application/json' },
        body: JSON.stringify({ roll: 6 }),
      }),
    );

    expect(answer.status).toBe(200);
    expect(((await answer.json()) as Rolled).roll, 'the body chose the die').toBe(3);
  });

  it('SAYS WHY when the rules forbid the throw, rather than saying nothing', async () => {
    /*
     * *You may not throw yet* and *you have no game* look identical to a caller
     * that only checks for absence, and one is a wait while the other is a dead
     * end. A board told 404 for somebody else's turn would offer the player a
     * new game instead of the wait they are in.
     */
    const answer = await throwing(launchAs(8675309), {
      rollFor: async () => ({ refused: 'write what this plan brings up first' }),
    });

    expect(answer.status).toBe(409);
    expect(await answer.json()).toEqual({ error: 'write what this plan brings up first' });
  });

  it('answers 404 for a player with no game, and 503 where no game is kept at all', async () => {
    // Three different facts, three different codes: nothing of yours here, and
    // this deployment has nothing for anybody.
    expect((await throwing(launchAs(1), { rollFor: async () => null })).status).toBe(404);
    expect((await throwing(launchAs(1), {})).status).toBe(503);
  });

  it('ANSWERS ANYWAY when the roller itself throws', async () => {
    /*
     * `audit-promises.mjs` asked for this before any player did — the same
     * audit that caught the fingerprint reader in #61, on the same shape: an
     * injected dependency nobody had tried with a broken one.
     *
     * A store that is down, a row that will not parse, a bug in `roll` — none
     * of them may take the route with them. The player is told *no game of
     * yours here yet*, which is wrong-but-actionable, where an unhandled
     * rejection is a board that spins forever.
     */
    const answer = await throwing(launchAs(8675309), {
      rollFor: async () => {
        throw new Error('the database went away');
      },
    });

    // **What the player is TOLD**, not merely that nothing exploded. Every
    // defect of this family was caught somewhere and told nobody; a test that
    // asserts only survival proves the half that was never in doubt.
    const said = (await answer.json()) as { error?: string };

    expect(answer.status).toBe(404);
    expect(said.error, 'the board was told nothing it can show').toMatch(/no game of yours/);
  });

  it('is POST only — a die thrown by a prefetch is a die nobody threw', async () => {
    /*
     * Not pedantry. A GET that changes a game is thrown by a link preview, a
     * browser restoring a tab, or a crawler — and the player finds their token
     * moved by nobody.
     */
    const got = await throwing(launchAs(8675309), { rollFor: async () => rolled }, 'GET');

    expect(got.status).toBe(405);
  });

  it('carries the whole state, because a position cannot be played on', async () => {
    /*
     * `consecutive_sixes` decides whether the next six sends the player back to
     * where they started the run; `is_finished` decides whether a six is an
     * entry or a win. A board given `{plan, waiting, won}` computes a different
     * game from the same square — which is what the old three-field answer
     * could not avoid, and why adopting it would have been a lie one roll deep.
     */
    const answer = await throwing(launchAs(8675309), { rollFor: async () => rolled });
    const body = (await answer.json()) as Rolled;

    expect(body.standing.state).toEqual(standing.state);
    expect(body.standing.state?.consecutive_sixes).toBe(0);
    expect(body.standing.state?.is_finished).toBe(false);
    expect(body.rollsAgain, 'a six throws again').toBe(true);
  });
});
