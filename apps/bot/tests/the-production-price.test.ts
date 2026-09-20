/**
 * The catalogue the shipped container actually receives.
 *
 * Pricing only in a README or a unit-test fixture does not price production.
 * Railway builds `apps/bot/Dockerfile`, so this test reads that exact source,
 * extracts the three public variables Docker supplies, and hands them to the
 * same parser the running service uses. A renamed, missing, malformed, or
 * partial price therefore fails before the image can be released.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { offering, type Environment } from '../src/stars';

const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');

function productionPrices(source: string): Environment {
  const prices: Environment = {};
  for (const match of source.matchAll(/\b(LEELA_STARS_(?:MONTH|HALFYEAR|YEAR))=([^\s\\]+)/g)) {
    const [, name, value] = match;
    if (name && value) prices[name] = value;
  }
  return prices;
}

describe('the production Stars catalogue', () => {
  it('ships every term at the owner-approved price', () => {
    expect(offering(productionPrices(dockerfile))).toEqual([
      { id: 'month', stars: 150, days: 30 },
      { id: 'halfyear', stars: 700, days: 182 },
      { id: 'year', stars: 1200, days: 365 },
    ]);
  });
});
