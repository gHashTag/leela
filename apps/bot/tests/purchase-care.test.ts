import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '@leela/content';
import {
  PAYMENT_SUPPORT_EMAIL,
  acceptanceAction,
  termsUrl,
  tierAskedByAcceptance,
} from '../src/purchase-care';
import { TIERS } from '../src/stars';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('the published care around a purchase', () => {
  it('links every player to words that are actually written in that language', () => {
    for (const language of LANGUAGES) {
      const writtenIn = language === 'ru' ? 'ru' : 'en';
      expect(termsUrl(language), language).toBe(
        `https://t27.ai/leela/docs/${writtenIn}/legal/eula.html`,
      );
    }
  });

  it('uses the contact already named by every published legal source', () => {
    for (const file of [
      'eula.en.md',
      'eula.ru.md',
      'policy.en.md',
      'policy.ru.md',
    ]) {
      const source = readFileSync(join(HERE, '..', '..', 'docs', 'legal', file), 'utf8');
      expect(source, file).toContain(PAYMENT_SUPPORT_EMAIL);
    }
  });

  it('round-trips every tier and refuses every altered callback shape', () => {
    for (const tier of TIERS) {
      const action = acceptanceAction(tier.id);
      expect(Buffer.byteLength(action), tier.id).toBeLessThanOrEqual(64);
      expect(tierAskedByAcceptance(action), tier.id).toBe(tier.id);
    }

    for (const altered of ['', 'pay:', 'pay:month:extra', 'Pay:month', 'buy:month', 'pay:month ']) {
      expect(tierAskedByAcceptance(altered), altered).toBeNull();
    }
  });
});

