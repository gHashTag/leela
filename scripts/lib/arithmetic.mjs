/**
 * The arithmetic the traditional text states, and whether it is true.
 *
 * Plan 9's whole argument is a calculation — *multiplied by any other number,
 * it retains its identity and integrity: 9x1=9; 9x2=18=9; …* — and plan 8's is
 * the opposite calculation, a number that shrinks. These are claims a machine
 * can check, in every language at once, without knowing a word of any of them.
 * A translated argument whose sums are wrong is not an argument.
 *
 * This is the one part of the translation audit that needs no translator. The
 * layer above it — whether a sentence still says what it said — needs a person
 * or a service this repository deliberately does not call. Whether nine times
 * two hundred and eighty is two thousand five hundred and twenty does not.
 *
 * Two claims per equation, and only two, because every further one turned out
 * to be the tool misreading rather than the text being wrong:
 *
 * - **The product.** `9х280=7,380` is false wherever it is written.
 * - **The reduction at the end.** A chain finishes at a single digit — the
 *   digital root — and that digit is checked against the product it came from.
 *   The steps in between are *not* checked: Ukrainian writes plan 8's as
 *   `8х2=16= 1 +6 =7`, spaces and all, and a first attempt at reading those
 *   steps reported six false alarms in three languages before the raw text was
 *   looked at. The end of the chain is unambiguous; the middle is typography.
 */

import { toAsciiDigits } from './numbers.mjs';

/** Multiplication, written with any of the signs 22 languages use for it. */
const TIMES = '[x×хX*✕]';

/**
 * `9х280=7,380=9` — a product and everything claimed about it afterwards.
 *
 * The tail is taken as far as it reads like arithmetic and no further, so the
 * sentence after the last semicolon is not swept in.
 */
const EQUATION = new RegExp(`(\\d+)\\s*${TIMES}\\s*(\\d+)\\s*=\\s*([\\d\\s+=]*\\d)`, 'g');

/** Thousands are grouped differently in different places, and mean the same. */
function ungroup(text) {
  return toAsciiDigits(text).replace(/(?<=\d)[ ,.   ](?=\d\d\d\b)/g, '');
}

/** Repeated digit sum: what "reduces to 9" means. */
export function digitalRoot(value) {
  return value === 0 ? 0 : 1 + ((value - 1) % 9);
}

/**
 * `900 breaths (60 х 15)` — a total, then the factors it came from.
 *
 * The other shape the arithmetic is written in, and the factors come *after*
 * the answer rather than before it, so the multiplication reader never saw it.
 * Twenty of the twenty-two languages carry this one and all twenty are right;
 * the check is here so that a rebuild cannot make one of them wrong quietly.
 *
 * The gap between the total and the bracket is bounded and may not cross a
 * sentence: without that, "9 planets … (60 x 15)" three sentences later reads
 * as a claim nobody made.
 */
const FACTORED = new RegExp(
  `(\\d+)[^.;:()（）\\d]{0,40}[(（]\\s*(\\d+)\\s*${TIMES}\\s*(\\d+)\\s*[)）]`,
  'g',
);

/** Every total a text explains by its factors. */
export function factorisationsIn(text) {
  const found = [];

  for (const match of ungroup(text).matchAll(FACTORED)) {
    const [whole, total, left, right] = match;
    found.push({
      said: whole.replace(/\s+/g, ' ').trim(),
      left: Number(left),
      right: Number(right),
      product: Number(total),
      reduced: null,
    });
  }

  return found;
}

/** Every multiplication a text states, with what it claims about each. */
export function equationsIn(text) {
  const found = [];

  for (const match of ungroup(text).matchAll(EQUATION)) {
    const [whole, left, right, tail] = match;
    const steps = tail
      .split('=')
      .map((step) => step.trim())
      .filter((step) => step.length > 0);

    const product = Number(steps[0]);
    if (!Number.isInteger(product)) continue;

    const last = steps[steps.length - 1] ?? '';
    // A reduction is claimed only when the chain ends on a lone digit. `9x8=72`
    // states a product and stops; `9x2=18=9` states where it comes down to.
    const reduced = /^\d$/.test(last) && steps.length > 1 ? Number(last) : null;

    found.push({
      said: whole.replace(/\s+/g, ' ').trim(),
      left: Number(left),
      right: Number(right),
      product,
      reduced,
    });
  }

  return found;
}

/** What is wrong with one equation, or nothing. */
export function faultsIn(equation) {
  const faults = [];
  const product = equation.left * equation.right;

  if (equation.product !== product) {
    faults.push(`${equation.left} × ${equation.right} is ${product}`);
  }

  if (equation.reduced !== null && equation.reduced !== digitalRoot(product)) {
    faults.push(`${product} comes down to ${digitalRoot(product)}`);
  }

  return faults;
}

/** Every false claim in one language's plans, as `plan: said — why`. */
export function falseClaimsIn(plans) {
  const found = [];

  for (const plan of plans) {
    const body = plan.body ?? '';
    for (const equation of [...equationsIn(body), ...factorisationsIn(body)]) {
      const faults = faultsIn(equation);
      if (faults.length > 0) found.push({ plan: plan.plan, said: equation.said, faults });
    }
  }

  return found.sort((a, b) => a.plan - b.plan);
}

/** One false claim as a line, which is also how the known ones are written. */
export function keyOf(language, claim) {
  return `${language}/${claim.plan}: ${claim.said}`;
}
