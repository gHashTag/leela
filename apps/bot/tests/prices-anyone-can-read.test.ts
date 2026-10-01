import { describe, expect, it, vi } from 'vitest';
import { FREE_MOVES } from '@leela/content';
import { askRoute } from '../src/serve';
import { offerFor, offering } from '../src/stars';

/**
 * `GET /api/prices`: the price list, to anybody, from the one offering.
 *
 * `specs/030`: an assistant answering for this bot in the owner's private
 * messages quoted another product's token packs, because the only price route
 * here answered nothing to anything that was not the mini app. The shape of
 * that defect is *a second copy of the price somewhere else*, so the check is
 * that this route says exactly what the bot's own offer says, for every
 * configuration the environment can produce — and that it gives away nothing
 * about a player and takes nothing from anyone.
 */

const NOW = Date.UTC(2026, 9, 1);

const CONFIGS: Array<Record<string, string>> = [
  {},
  { LEELA_STARS_MONTH: '150' },
  { LEELA_STARS_MONTH: '150', LEELA_STARS_HALFYEAR: '700', LEELA_STARS_YEAR: '1200' },
  { LEELA_STARS_YEAR: '999' },
];

function routeFor(env: Record<string, string>) {
  const tiers = offering(env);
  const entitled = vi.fn(async () => true);
  const createLink = vi.fn(async () => 'https://t.me/$never');
  const route = askRoute({
    token: '1:TEST',
    now: () => NOW,
    serving: () => null,
    running: () => null,
    payments: { tiers, entitled, createLink },
  });
  return { route, tiers, entitled, createLink };
}

const get = (headers: Record<string, string> = {}, method = 'GET') =>
  new Request('https://leela.test/api/prices', { method, headers });

describe('the public price list', () => {
  it('says what the bot says, for every configuration, to a caller with no origin or signature', async () => {
    for (const env of CONFIGS) {
      const { route, tiers, entitled, createLink } = routeFor(env);
      const response = await route(get());
      expect(response.status, JSON.stringify(env)).toBe(200);

      const body = (await response.json()) as {
        currency: string;
        freeMoves: number | null;
        tiers: Array<{ id: string; days: number; stars: number }>;
      };
      expect(body.currency).toBe('XTR');
      expect(body.tiers).toEqual((tiers ?? []).map(({ id, days, stars }) => ({ id, days, stars })));
      expect(body.freeMoves).toBe(tiers ? FREE_MOVES : null);

      // Every price in the list is the price in the bot's own offer.
      if (tiers) {
        const offer = offerFor('en', tiers, null);
        for (const tier of body.tiers) expect(offer).toContain(`${tier.stars} ⭐`);
      }

      // Nothing about a player was looked up, and nothing was sold.
      expect(entitled).not.toHaveBeenCalled();
      expect(createLink).not.toHaveBeenCalled();
    }
  });

  it('answers a foreign origin too, because a price is public', async () => {
    const { route } = routeFor(CONFIGS[2]!);
    const response = await route(get({ origin: 'https://example.com' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('takes nothing: every other method is refused', async () => {
    const { route } = routeFor(CONFIGS[2]!);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const response = await route(new Request('https://leela.test/api/prices', { method, body: '{}' }));
      expect(response.status, method).toBe(405);
    }
  });
});
