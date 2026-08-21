/**
 * What the game gives away before it asks.
 *
 * One number, in one place, on this side of the bridge.
 *
 * The rule itself is not ours: it lives in `apps/webgl/src/toll.ts`, where the
 * die is actually stopped, and it is written there because that is the only
 * side that can count throws from the saved game. This file exists so the app
 * can *say* the number without a second opinion about it, and
 * `pricing.test.ts` reads the board's source to make sure the two agree.
 *
 * They did not agree. Every one of the ten translation files told the player
 * the trial "allows creating 2 reports" while the board handed out three
 * throws — a promise wrong in its count *and* in its unit, in ten languages,
 * on the one screen where the player is asked for money. The reports it spoke
 * of belonged to the flat board this app opened on before the 3D game became
 * the way in.
 *
 * So the number is no longer written in prose at all. The copy carries
 * `{{count}}` and is handed this constant, which means a change here reaches
 * Arabic and Telugu at the same moment it reaches English, and no translator
 * has to be trusted with arithmetic.
 */

/**
 * Throws a player gets before the game asks for a subscription.
 *
 * A *throw*, not a turn and not a report: a six earns another throw, so
 * counting turns would give one player five throws and another two. The die is
 * what is being paid for.
 */
export const FREE_THROWS = 3
