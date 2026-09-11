import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LANGUAGES, englishCatalogue, messageFor, type MessageKey } from '@leela/content';

import { blank } from '../../../scripts/lib/source.mjs';

/** Wiring assertions complement the controller tests and parent browser QA. */
describe('checkout is wired into the existing board without another game adoption', () => {
  const main = blank(readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'));
  const telegram = blank(readFileSync(new URL('../src/telegram.ts', import.meta.url), 'utf8'));
  const markup = blank(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), 'html');
  const view = blank(readFileSync(new URL('../src/subscription-sheet.ts', import.meta.url), 'utf8'));

  it('keeps native first and never uses the old Telegram closing path', () => {
    const start = main.indexOf("el.tollOpen.addEventListener('click'");
    const handler = main.slice(start, main.indexOf('\n});', start));
    expect(handler).toContain('if (askToSubscribe()) return');
    expect(handler).toContain('paymentSheet.show()');
    expect(handler).toContain('void subscription.start()');
    expect(handler.indexOf('askToSubscribe()')).toBeLessThan(handler.indexOf('subscription.start()'));
    for (const code of [main, telegram]) {
      expect(code).not.toMatch(/\b(?:sendData|askTelegramToSubscribe|mayAskTelegramToSubscribe)\b/);
      expect(code).not.toContain('app.close');
    }
    expect(main).toContain('window.addEventListener(ENTITLEMENT_CHANGED, () => showGate())');
  });

  it('server confirmation changes access only, not board, journal or native receipt', () => {
    const start = main.indexOf('confirmed: () => {');
    const confirmed = main.slice(start, main.indexOf('\n  },', start));
    expect(confirmed).toContain('chatAccess = { ...chatAccess, entitled: true }');
    expect(confirmed).toContain('showGate()');
    for (const forbidden of ['session =', 'rolls =', 'companion.reset', 'myGame(', 'keep(', '__leelaPro', 'location.reload']) {
      expect(confirmed).not.toContain(forbidden);
    }
  });

  it('has a named sheet section, real form controls and a way back', () => {
    const body = markup.slice(markup.indexOf('id="sheet-body"'));
    expect(body).toContain('id="subscription" aria-labelledby="subscription-title" hidden');
    expect(markup).toContain('aria-controls="subscription"');
    expect(view).toContain("create('form', 'subscription-form')");
    expect(view).toContain("create('fieldset', 'subscription-choices')");
    expect(view).toContain("create('legend', 'subscription-choose')");
    expect(view).toContain("radio.type = 'radio'");
    expect(view).toContain("accept.type = 'checkbox'");
    expect(view).toContain('accept.checked = false');
    expect(view).toContain('accept.checked = state.accepted');
    expect(view).not.toContain('accept.checked = true');
    expect(view).toContain("status.setAttribute('role', 'status')");
    expect(view).toContain("status.setAttribute('aria-live', 'polite')");
    expect(view).toContain("terms.rel = 'noopener noreferrer'");
    expect(view).toContain("close.addEventListener('click'");
    expect(view).toContain('payment.dismiss()');
    expect(view).toContain('dismiss()');
    expect(view).toContain('retry.disabled = false');
    expect(main).toContain("event.target.closest('#subscription, #toll-open')");
  });

  it('uses current server prices and durations, localized including all fallback languages', () => {
    expect(view).toContain("messageFor(language, 'app.subscriptionTier', { count: tier.days, stars: tier.stars })");
    const keys = Object.keys(englishCatalogue()).filter((key) => key.startsWith('app.subscription')) as MessageKey[];
    expect(keys.length).toBeGreaterThan(15);
    for (const key of keys) {
      for (const language of LANGUAGES) {
        const said = messageFor(language, key, { count: 23, stars: 137 });
        expect(said, `${language}: ${key}`).not.toMatch(/\{\w+\}/);
        expect(said).not.toBe(key);
        expect(said.length).toBeGreaterThan(0);
      }
      expect(messageFor('ru', key, { count: 23, stars: 137 }), key).toMatch(/[А-Яа-я]/);
    }
    for (const count of [1, 2, 5, 21, 29, 173, 367]) {
      for (const language of ['en', 'ru']) {
        const label = messageFor(language, 'app.subscriptionTier', { count, stars: 137 });
        expect(label).toContain(String(count));
        expect(label).toContain('137');
      }
    }
  });
});
