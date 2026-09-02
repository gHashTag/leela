import { createHmac } from 'node:crypto';
import { describe as group, expect, it } from 'vitest';

import { FRESH_FOR_MS, whoSent } from '../src/vouched';

/**
 * The identity check the prior art did not have.
 *
 * `leela-chakra-nextjs` read `initData.user.id` in the browser and looked the
 * player up with it; a grep for `createHmac|validateInitData|checkSignature`
 * over it and over `leela-chakra-bot` returns nothing. Anyone who could open
 * the page could claim any account. `specs/009` prices the whole job and the
 * owner chose it on 2026-08-28; this is its first piece, and the case that
 * matters is the forgery.
 *
 * The fixtures are SIGNED HERE rather than pasted, so the test exercises the
 * scheme instead of one captured string: `signed()` is Telegram's algorithm
 * written out a second time, deliberately, because a fixture produced by the
 * code under test would agree with it however wrong both were.
 */
const TOKEN = '123456:AAHfake-token-for-tests-only';
const NOW = Date.UTC(2026, 7, 28, 12, 0, 0);

/** Telegram's scheme, written independently of the implementation. */
const signed = (fields: Record<string, string>, token = TOKEN): string => {
  const checked = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(checked).digest('hex');

  return new URLSearchParams({ ...fields, hash }).toString();
};

const launch = (over: Record<string, string> = {}) =>
  signed({
    auth_date: String(Math.floor(NOW / 1000) - 60),
    query_id: 'AAH1234',
    user: JSON.stringify({ id: 8675309, first_name: 'Mina', language_code: 'ru' }),
    ...over,
  });

group('a launch Telegram signed', () => {
  it('names the player, and their language when Telegram sent one', () => {
    const answer = whoSent(launch(), TOKEN, { now: NOW });

    expect(answer.ok).toBe(true);
    expect(answer.ok && answer.who).toMatchObject({
      id: '8675309',
      name: 'Mina',
      language: 'ru',
      startParam: null,
      startParamValid: true,
    });
  });

  it('carries a bounded start parameter only after its signature was checked', () => {
    const answer = whoSent(launch({ start_param: 'guest' }), TOKEN, { now: NOW });
    expect(answer.ok && answer.who.startParam).toBe('guest');
    expect(answer.ok && answer.who.startParamValid).toBe(true);

    const oversized = whoSent(launch({ start_param: 'x'.repeat(65) }), TOKEN, { now: NOW });
    expect(oversized.ok && oversized.who.startParam).toBeNull();
    expect(oversized.ok && oversized.who.startParamValid).toBe(false);
  });

  it('says nothing about a language Telegram did not send', () => {
    const quiet = launch({ user: JSON.stringify({ id: 7, first_name: 'Mina' }) });
    const answer = whoSent(quiet, TOKEN, { now: NOW });

    // Null, never a guess and never a default: the language the board uses is
    // the player's own choice everywhere else in this repository.
    expect(answer.ok).toBe(true);
    expect(answer.ok ? answer.who.language : 'not reached').toBeNull();
  });

  it('takes an id Telegram sent as a number and gives back a string', () => {
    // Every id in this bot is a string, and a chat id is one too — which is
    // what this will be looked up by.
    const answer = whoSent(launch(), TOKEN, { now: NOW });

    expect(answer.ok && typeof answer.who.id).toBe('string');
  });
});

group('a launch it did not', () => {
  it('refuses a hash somebody else computed', () => {
    // THE CASE THIS FILE EXISTS FOR. Signed with a different token — which is
    // every attacker who has read the public source and knows the scheme.
    const forged = signed(
      {
        auth_date: String(Math.floor(NOW / 1000)),
        user: JSON.stringify({ id: 8675309 }),
      },
      '999999:a-token-that-is-not-ours',
    );

    expect(whoSent(forged, TOKEN, { now: NOW })).toEqual({
      ok: false,
      why: 'the signature does not match',
    });
  });

  it('refuses a body edited after it was signed', () => {
    // The impersonation the prior art allowed: keep the real signature, change
    // whose game it is.
    const real = launch();
    const theirs = real.replace(/user=[^&]*/, `user=${encodeURIComponent(JSON.stringify({ id: 1 }))}`);

    expect(whoSent(theirs, TOKEN, { now: NOW }).ok).toBe(false);
  });

  it('refuses a launch with no hash at all rather than reading it', () => {
    expect(whoSent('user=%7B%22id%22%3A1%7D&auth_date=1', TOKEN, { now: NOW })).toEqual({
      ok: false,
      why: 'initData carries no hash',
    });
  });

  it('refuses a hash of the wrong length without comparing it', () => {
    // `timingSafeEqual` throws on a length mismatch, and a throw here would be
    // a 500 where a 401 belongs — and the easy forgery is the short one.
    const stub = `${launch().replace(/hash=[^&]*/, 'hash=00')}`;

    expect(whoSent(stub, TOKEN, { now: NOW })).toEqual({ ok: false, why: 'the signature does not match' });
  });
});

group('a launch signed too long ago', () => {
  it('refuses one older than the window', () => {
    const old = launch({ auth_date: String(Math.floor((NOW - FRESH_FOR_MS - 1000) / 1000)) });

    expect(whoSent(old, TOKEN, { now: NOW })).toEqual({ ok: false, why: 'this launch was signed too long ago' });
  });

  it('accepts one exactly at the edge, so the bound is the documented one', () => {
    const edge = launch({ auth_date: String(Math.floor((NOW - FRESH_FOR_MS) / 1000)) });

    expect(whoSent(edge, TOKEN, { now: NOW }).ok).toBe(true);
  });

  it('checks the signature BEFORE the age, because auth_date is the caller’s until then', () => {
    const forgedAndOld = signed(
      { auth_date: String(Math.floor((NOW - FRESH_FOR_MS - 1000) / 1000)), user: '{"id":1}' },
      'not-our-token',
    );

    // The signature complaint, not the age one: an unsigned field has not
    // earned the right to be the reason.
    expect(whoSent(forgedAndOld, TOKEN, { now: NOW })).toEqual({
      ok: false,
      why: 'the signature does not match',
    });
  });
});

group('nothing it is handed can make it throw', () => {
  it('refuses the empty, the tokenless and the unparseable', () => {
    expect(whoSent('', TOKEN, { now: NOW }).ok).toBe(false);
    expect(whoSent(launch(), '', { now: NOW }).ok).toBe(false);
    expect(whoSent('%%%not-a-query%%%', TOKEN, { now: NOW }).ok).toBe(false);
  });

  it('refuses a signed launch whose user field is not JSON', () => {
    // Signed by us, so it gets past the signature — and then has to be refused
    // on its contents rather than crash the route that called this.
    const broken = signed({ auth_date: String(Math.floor(NOW / 1000)), user: '{not json' });

    expect(whoSent(broken, TOKEN, { now: NOW })).toEqual({ ok: false, why: 'the user field is not readable' });
  });

  it('refuses a signed launch that names no user', () => {
    const nobody = signed({ auth_date: String(Math.floor(NOW / 1000)) });

    expect(whoSent(nobody, TOKEN, { now: NOW })).toEqual({ ok: false, why: 'initData names no user' });
  });

  it('refuses a signed user with no id', () => {
    const anonymous = signed({
      auth_date: String(Math.floor(NOW / 1000)),
      user: JSON.stringify({ first_name: 'Mina' }),
    });

    expect(whoSent(anonymous, TOKEN, { now: NOW })).toEqual({ ok: false, why: 'the user has no id' });
  });
});
