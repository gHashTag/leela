/**
 * The Telegram Stars rail: dark until somebody names a price.
 *
 * The owner prices the game in the environment. With none of
 * `LEELA_STARS_MONTH`, `LEELA_STARS_HALFYEAR`, `LEELA_STARS_YEAR` set,
 * `offering` answers `null`, no command is registered, no invoice can be
 * assembled, and the shared access decision leaves play open.
 *
 * Everything here is pure. The transport in `bot.ts` reads the environment
 * once, at startup, and hands the answer down — so a variable changed under a
 * running process does not half-arm the rail mid-game, which is the same rule
 * `miniAppUrl` is read under.
 *
 * What is sourced rather than assumed, from `@grammyjs/types` 4.0.0, the copy
 * this workspace compiles against:
 *
 *   - `currency` is `"XTR"` for Telegram Stars, and `provider_token` is the
 *     empty string for them — a token obtained from BotFather is for the
 *     other currencies.
 *   - `prices` "must contain exactly one item for payments in Telegram Stars",
 *     so a tier is one line and never a breakdown.
 *   - `title` is 1–32 characters, `description` 1–255, `payload` 1–128 bytes.
 *   - `answerPreCheckoutQuery`: "the Bot API must receive an answer within 10
 *     seconds after the pre-checkout query was sent".
 *   - `subscription_period` — a *recurring* Stars subscription — exists on
 *     `createInvoiceLink` only, must be exactly 2592000 (30 days), and is
 *     deliberately not used here: nothing in this rail sends one, so no
 *     recurring charge can arrive, and the tiers below are one-off payments
 *     that each buy a stretch of days. If subscriptions are turned on later,
 *     `SuccessfulPayment.subscription_expiration_date` is Telegram's own
 *     answer to when the entitlement ends and is the number to record.
 *
 * What is **not** sourced, and is therefore not enforced: an upper bound on a
 * Stars price. The types state one for paid media (1–25000) and none for an
 * invoice, so this refuses only what is certainly wrong — a price that is not
 * a whole number of Stars, or is zero or negative. A price Telegram will not
 * take is refused by Telegram, loudly, on the first `/pro`.
 */

import { messageFor, type Language } from '@leela/content';

/** Telegram's currency code for Stars. */
export const STARS_CURRENCY = 'XTR';

/**
 * A day, in milliseconds.
 *
 * Declared here and imported by `initiative.ts`, which held its own copy of the
 * same number until `audit-doubles` said so. Which of the two keeps it is not a
 * matter of taste: `initiative.ts` reads `store.ts`, `store.ts` reads this file
 * for the entitlement arithmetic, and a day declared over there would be a
 * cycle. This module imports nothing from this app, so it is the one that can
 * hold a shared unit without one.
 */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** The three tiers this rail can offer, and how long each one lasts. */
export type TierId = 'month' | 'halfyear' | 'year';

export interface TierShape {
  readonly id: TierId;
  /** The variable that prices it. Nothing else may. */
  readonly variable: string;
  /** How many days it runs for. In code, not in the environment: a price is
   *  the owner's decision and a duration is the product's. */
  readonly days: number;
}

/**
 * The shape of the offer, priced or not.
 *
 * Written out rather than generated, because each of the three is a promise a
 * player reads and a duration the entitlement arithmetic uses. 182 rather than
 * 183 for the half year: half of 365 rounded down, so a year is never worth
 * less than two half years.
 */
export const TIERS: readonly TierShape[] = [
  { id: 'month', variable: 'LEELA_STARS_MONTH', days: 30 },
  { id: 'halfyear', variable: 'LEELA_STARS_HALFYEAR', days: 182 },
  { id: 'year', variable: 'LEELA_STARS_YEAR', days: 365 },
];

/** A tier somebody has put a price on. */
export interface PricedTier {
  readonly id: TierId;
  /** Whole Stars, as Telegram counts them: XTR has no smaller unit. */
  readonly stars: number;
  readonly days: number;
}

/** What the environment can be read from. `process.env`'s shape, and no more. */
export type Environment = Record<string, string | undefined>;

/**
 * A price read out of one variable: taken, absent, or refused with a reason.
 *
 * Three states rather than two. *Absent* is a deployment that did not offer
 * this tier, which is ordinary; *refused* is a deployment that meant to and
 * mistyped it, which must never read as ordinary — see `readPrices`.
 */
type Priced =
  | { kind: 'absent' }
  | { kind: 'taken'; stars: number }
  | { kind: 'refused'; why: string };

function priceIn(env: Environment, tier: TierShape): Priced {
  const written = env[tier.variable]?.trim();
  if (written === undefined || written === '') return { kind: 'absent' };

  // `Number` rather than `parseInt`: `parseInt('12 stars')` is 12, and a price
  // that quietly drops what was written after it is how the wrong amount gets
  // charged. Everything that is not exactly a whole number is refused.
  const stars = Number(written);
  if (!Number.isInteger(stars) || stars < 1) {
    return {
      kind: 'refused',
      why: `${tier.variable} is "${written}", which is not a whole number of Stars above zero`,
    };
  }

  return { kind: 'taken', stars };
}

/**
 * Every tier that has a price, and everything that was written and unreadable.
 *
 * One reader for both questions, because two of them would drift and the whole
 * point of this module is that the gate and the reason for it agree.
 */
function readPrices(env: Environment): { tiers: PricedTier[]; refusals: string[] } {
  const tiers: PricedTier[] = [];
  const refusals: string[] = [];

  for (const tier of TIERS) {
    const price = priceIn(env, tier);
    if (price.kind === 'taken') tiers.push({ id: tier.id, stars: price.stars, days: tier.days });
    if (price.kind === 'refused') refusals.push(price.why);
  }

  return { tiers, refusals };
}

/**
 * The priced tiers, or `null` when nothing is sold.
 *
 * The gate, and the only one: everything else in this rail asks this function
 * and nothing reads a variable for itself.
 *
 * **One bad price darkens all of them.** A deployment with a good
 * `LEELA_STARS_YEAR` and a mistyped `LEELA_STARS_MONTH` is a deployment
 * somebody meant to price twice, and selling the half that parsed would be
 * charging for an offer nobody wrote. The safe direction of failure is the one
 * where no money changes hands, and `whyNothingIsSold` says so on startup
 * rather than leaving it to be discovered by a player who cannot buy the tier
 * they were told about.
 */
export function offering(env: Environment): readonly PricedTier[] | null {
  const { tiers, refusals } = readPrices(env);
  if (refusals.length > 0 || tiers.length === 0) return null;
  return tiers;
}

/**
 * Why nothing is sold, or `null` when something is.
 *
 * Read by the startup line. A price with a typo in it is otherwise invisible:
 * the bot runs, the command is absent, and the person who set the variable has
 * no way to tell that from the rail simply being off.
 */
export function whyNothingIsSold(env: Environment): string | null {
  const { tiers, refusals } = readPrices(env);
  if (refusals.length > 0) return `${refusals.join('; ')} — so nothing is sold at all`;
  if (tiers.length === 0) {
    return `no price is set (${TIERS.map((tier) => tier.variable).join(', ')}), so nothing is sold`;
  }
  return null;
}

/**
 * Who may give a payment back.
 *
 * Telegram requires that a bot selling Stars can refund them, and a refund is
 * an operator's act: it moves money and it is not a player's to ask for
 * directly. `LEELA_STARS_OPERATORS` is a comma-separated list of Telegram user
 * ids, and the same rule the prices are read under applies — anything in it
 * that is not a plain id refuses the whole list, because a half-read list of
 * who is trusted is worse than an empty one.
 */
export function operatorIds(env: Environment): readonly string[] {
  const written = env.LEELA_STARS_OPERATORS?.trim();
  if (!written) return [];

  const ids = written.split(',').map((one) => one.trim());
  // A Telegram id is a positive integer. `Number.isInteger` would take `1e3`
  // and `-5`; the pattern takes what an id actually looks like.
  return ids.every((id) => /^[1-9][0-9]*$/.test(id)) ? ids : [];
}

/** Why the operator list was refused, or `null` when it was taken. */
export function whyNoOperators(env: Environment): string | null {
  const written = env.LEELA_STARS_OPERATORS?.trim();
  if (!written) return 'LEELA_STARS_OPERATORS is not set, so nothing can be refunded from a chat';
  if (operatorIds(env).length === 0) {
    return `LEELA_STARS_OPERATORS is "${written}", which is not a comma-separated list of Telegram user ids — nobody may refund`;
  }
  return null;
}

/**
 * What a consent-bound invoice carries back to us when it is paid.
 *
 * The tier is in the payload because the price is not enough to identify one —
 * two tiers may be priced the same, and a price can change between the invoice
 * and the payment. `v2` distinguishes invoices issued only after the player
 * accepted the published Terms from `v1` invoices issued before that step.
 */
export function payloadFor(id: TierId): string {
  return `leela:pro:${id}:v2`;
}

/** The tier a current, consent-bound invoice names, or `null`. */
export function tierOfPayload(payload: string): TierId | null {
  const match = /^leela:pro:([a-z]+):v2$/.exec(payload);
  const named = match?.[1];
  return TIERS.some((tier) => tier.id === named) ? (named as TierId) : null;
}

/**
 * Decode a payment after Telegram says the money moved.
 *
 * An unpaid `v1` invoice is refused by `tierOfPayload`, but a checkout approved
 * just before deployment can deliver `successful_payment` just after it. Both
 * generations are honoured here because losing access after a completed charge
 * is worse than accepting an in-flight legacy purchase. This decoder is never
 * used to approve a charge.
 */
export function tierOfPaidPayload(payload: string): TierShape | null {
  const match = /^leela:pro:([a-z]+):v(?:1|2)$/.exec(payload);
  const named = match?.[1];
  return TIERS.find((tier) => tier.id === named) ?? null;
}

/** The tier this offering sells under that id, or `null`. */
export function tierOf(
  tiers: readonly PricedTier[] | null,
  id: string | null,
): PricedTier | null {
  if (!tiers || id === null) return null;
  return tiers.find((tier) => tier.id === id) ?? null;
}

/**
 * Refused, with the reason in the message.
 *
 * The dark case is not an error a player can reach — no command is registered
 * to reach it with — so this exists for the call that arrives from inside:
 * code that assembles an invoice without asking whether anything is sold. It
 * throws rather than returning a falsy value because the alternative is an
 * invoice for nothing, sent to somebody, in a deployment whose owner has not
 * decided to charge at all.
 */
export class NothingIsSoldError extends Error {
  constructor(why: string) {
    super(why);
    this.name = 'NothingIsSoldError';
  }
}

/** Telegram's bounds on the three fields an invoice carries. */
const MAX_INVOICE_TITLE = 32;
const MAX_INVOICE_DESCRIPTION = 255;

/**
 * An invoice, as data.
 *
 * Assembled here and sent by `bot.ts`, for the reason `commands.ts` gives
 * about the game: what is said can then be asserted without a Telegram to send
 * it to. `currency` is a literal type rather than a string, so a second
 * currency cannot be introduced by a typo — Stars are the only sanctioned way
 * to sell a digital good in a bot.
 */
export interface StarsInvoice {
  title: string;
  description: string;
  payload: string;
  currency: typeof STARS_CURRENCY;
  /** Exactly one, which is what Telegram accepts for a payment in Stars. */
  prices: ReadonlyArray<{ label: string; amount: number }>;
}

/**
 * The invoice for one tier, or a refusal that says why.
 *
 * The two refusals are the whole gate, restated where the money is: nothing is
 * sold at all, and this is not a tier that is sold. Both throw rather than
 * return a falsy value, because the caller that ignores a falsy value here
 * sends nothing and says nothing, and the player is left looking at a command
 * that did not answer.
 */
export function invoiceFor(
  language: Language,
  tiers: readonly PricedTier[] | null,
  id: string | null,
): StarsInvoice {
  if (!tiers) {
    throw new NothingIsSoldError(
      `no price is set (${TIERS.map((tier) => tier.variable).join(', ')}), so no invoice exists to send`,
    );
  }

  const tier = tierOf(tiers, id);
  if (!tier) {
    throw new NothingIsSoldError(
      `"${id ?? ''}" is not a tier this deployment sells; it sells ${tiers.map((one) => one.id).join(', ')}`,
    );
  }

  // Sliced rather than refused, the way `menuFor` slices a menu description:
  // Telegram refuses the whole call for an over-long title, so a sentence that
  // grew in translation would take the rail down instead of reading oddly.
  // `stars.test.ts` holds every translated language to fitting without this.
  return {
    title: messageFor(language, 'pro.title').slice(0, MAX_INVOICE_TITLE),
    description: messageFor(language, 'pro.description', { days: tier.days }).slice(
      0,
      MAX_INVOICE_DESCRIPTION,
    ),
    payload: payloadFor(tier.id),
    currency: STARS_CURRENCY,
    prices: [
      { label: messageFor(language, 'pro.title').slice(0, MAX_INVOICE_TITLE), amount: tier.stars },
    ],
  };
}

/**
 * A date a person can read, and the only formatting of one this rail does.
 *
 * ISO, like the filename `/save` builds from a date, and for the same reason:
 * a month name would need twenty-two translations to say one number, and an
 * entitlement's end is a fact rather than a sentence.
 */
export function asDay(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}

/**
 * What `/pro` says: the offer, the tiers, and what is already held.
 *
 * Every claim in it is bounded by the shared access rule: three successful
 * moves are free, and an entitlement opens later rolls until its date. The
 * list is built from the priced tiers rather than from a written-out list of
 * three, so a deployment that priced one names one.
 */
export function offerFor(
  language: Language,
  tiers: readonly PricedTier[],
  held: number | null,
): string {
  const lines = [messageFor(language, 'pro.free'), messageFor(language, 'pro.buys'), ''];

  for (const tier of tiers) {
    lines.push(
      messageFor(language, 'pro.tier', {
        command: `/pro ${tier.id}`,
        count: tier.days,
        stars: tier.stars,
      }),
    );
  }

  lines.push('', messageFor(language, 'pro.refundable'), messageFor(language, 'pro.care'));
  if (held !== null) lines.push(messageFor(language, 'pro.held', { until: asDay(held) }));

  return lines.join('\n');
}

/**
 * When an entitlement bought now runs out, given whatever is already held.
 *
 * **Extends rather than replaces**, and the choice is deliberate: a player who
 * buys a second year in month eleven of the first has bought two years, not a
 * year starting today. Replacing would silently take eleven months off
 * somebody for paying again, which is the one direction of error that cannot
 * be argued with afterwards. An expired entitlement is not extended from its
 * old end — that would sell a stretch of the past — so the clock restarts from
 * now.
 *
 * @param held  when the entitlement already held runs out, or `null` for none
 */
export function extendedTo(held: number | null, now: number, days: number): number {
  const from = held !== null && held > now ? held : now;
  return from + days * DAY_MS;
}
