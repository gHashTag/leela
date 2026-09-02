import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Who Telegram says is asking — not who the caller says they are.
 *
 * `specs/009` asked whether a Telegram player's board should be the same game
 * as the chat's. The owner answered on 2026-08-28: *«да 3D поле везде!»* — yes,
 * and the 3D board everywhere. This is the first piece of that, and it is the
 * piece the prior art on this disk did not have at all.
 *
 * **What the donors did, and what must not be copied.** `leela-chakra-nextjs`
 * parsed `initData` in the browser, took `initData.user.id` as the player, and
 * looked them up with a public key —
 * `leela-chakra-nextjs/src/app/gameboard/page.tsx:81` and `:86`. A grep for
 * `createHmac|validateInitData|checkSignature` over that repository and over
 * `leela-chakra-bot` returns nothing. Anyone who could open the page could
 * claim any `telegram_id`, and the die roll travelled from the client too. The
 * fourth principle is exactly about this: *trust nothing that has been outside
 * the process*.
 *
 * So the identity is checked here, against the bot token, by Telegram's
 * documented scheme:
 *
 *   - take the `initData` query string, drop `hash`;
 *   - sort what is left by key and join `k=v` with newlines;
 *   - `secret = HMAC_SHA256(key: "WebAppData", data: botToken)`;
 *   - the signature is `HMAC_SHA256(key: secret, data: thatString)` in hex.
 *
 * The token is passed in rather than read from the environment, for the reason
 * everything else in this repository is: a function that reaches for a global
 * cannot be handed a wrong one on purpose, and the test that matters most here
 * is the one that hands it a forgery.
 */

/** What a verified launch tells us, and nothing it does not. */
export interface Vouched {
  /** The Telegram user id, as a string, because every id in this bot is one. */
  id: string;
  /** A display name from the signed user object, bounded for room storage. */
  name: string;
  /** `language_code`, when Telegram sent one. Never inferred. */
  language: string | null;
  /** When Telegram signed this, epoch ms. */
  authAt: number;
  /** Signed Main Mini App campaign, only when it matches Telegram's bound. */
  startParam: string | null;
  /** False only when Telegram signed a start_param outside the accepted bound. */
  startParamValid: boolean;
}

export type Verdict = { ok: true; who: Vouched } | { ok: false; why: string };

/**
 * How long a signed launch is worth accepting.
 *
 * Telegram signs `auth_date` once when the Web App opens and does not refresh
 * it, so this is a bound on how long a *session* may be replayed, not on how
 * long a request may take. A day is Telegram's own suggestion for a sensitive
 * action and is short enough that a captured `initData` is not a permanent key.
 */
export const FRESH_FOR_MS = 24 * 60 * 60 * 1000;

/** Equal without telling anybody how nearly. */
const sameSecret = (a: string, b: string): boolean => {
  const mine = Buffer.from(a, 'utf8');
  const theirs = Buffer.from(b, 'utf8');

  // `timingSafeEqual` throws on a length mismatch, which would itself be a
  // signal — and a forged hash of the wrong length is the easy forgery.
  return mine.length === theirs.length && timingSafeEqual(mine, theirs);
};

/**
 * The user Telegram signed for, or the reason this is not one.
 *
 * Answers a shape rather than throwing, and refuses rather than half-reading —
 * the same rule the saved-game reader follows, and for the same reason: this is
 * handed a string from outside the process, and *every* way it can be wrong
 * ends in one sentence a caller can act on.
 */
export function whoSent(
  initData: string,
  token: string,
  { now, freshForMs = FRESH_FOR_MS }: { now: number; freshForMs?: number },
): Verdict {
  if (token === '') return { ok: false, why: 'this deployment has no bot token to check against' };
  if (initData === '') return { ok: false, why: 'no initData was sent' };

  const fields = new URLSearchParams(initData);
  const hash = fields.get('hash');
  if (hash === null) return { ok: false, why: 'initData carries no hash' };

  fields.delete('hash');
  const checked = [...fields.entries()]
    .sort(([one], [other]) => (one < other ? -1 : one > other ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const signature = createHmac('sha256', secret).update(checked).digest('hex');

  if (!sameSecret(signature, hash)) return { ok: false, why: 'the signature does not match' };

  // Only after the signature: an unsigned `auth_date` is a number the caller
  // chose, so refusing on its age first would be refusing on their word.
  const authDate = Number(fields.get('auth_date'));
  if (!Number.isFinite(authDate)) return { ok: false, why: 'initData carries no auth_date' };

  const authAt = authDate * 1000;
  if (now - authAt > freshForMs) return { ok: false, why: 'this launch was signed too long ago' };

  let user: unknown;
  try {
    user = JSON.parse(fields.get('user') ?? 'null');
  } catch {
    return { ok: false, why: 'the user field is not readable' };
  }

  if (typeof user !== 'object' || user === null) return { ok: false, why: 'initData names no user' };

  const held = user as {
    id?: unknown;
    first_name?: unknown;
    last_name?: unknown;
    username?: unknown;
    language_code?: unknown;
  };
  if (typeof held.id !== 'number' && typeof held.id !== 'string') {
    return { ok: false, why: 'the user has no id' };
  }

  const name = [held.first_name, held.last_name]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    .trim();
  const fallbackName = typeof held.username === 'string' ? held.username.trim() : '';
  const startParam = fields.get('start_param');
  const startParamValid = startParam === null || /^[A-Za-z0-9_-]{1,64}$/.test(startParam);

  return {
    ok: true,
    who: {
      id: String(held.id),
      name: (name || fallbackName || 'Player').slice(0, 128),
      language: typeof held.language_code === 'string' ? held.language_code : null,
      authAt,
      startParam:
        startParam !== null && startParamValid
          ? startParam
          : null,
      startParamValid,
    },
  };
}
