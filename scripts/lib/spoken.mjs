/**
 * Sentences written into the source instead of into the catalogue.
 *
 * The sixth principle says every sentence the game says about itself comes from
 * `@leela/content`. `apps/webgl/src/main.ts` carries a comment recording four
 * English strings that had been "written straight into this file, one line
 * above the `messageFor` that renders everything else — so a Russian board
 * printed FROM THE TEXT and MODEL beside Russian sentences". They were moved.
 *
 * **Nothing was added to stop the next one, and on 2026-08-28 there were three,
 * two hundred lines above that comment.** The worst was not an aria-label:
 *
 *     el.look.textContent = nextLook === 'light' ? 'Light' : 'Dark';
 *
 * — the visible face of a button, in English, on all twenty-two boards. Beside
 * it sat `` `Language: ${…}` `` and `` `Theme: ${nextLook}` ``, whose leading
 * words were English and whose `nextLook` was the raw token `light`.
 *
 * A defect fixed without a guard comes back; this repository has said so about
 * other things and then proved it here. This is the guard.
 *
 * WHAT IT ASKS: when a line hands a **sentence** to the page — `textContent`, or
 * an `aria-label` — does the value contain an English word typed on the spot?
 *
 * THREE THINGS IT LEARNED ON ITS FIRST RUN, all of them its own fault. It
 * reported three findings and every one was a false positive:
 *
 *   1. **It read doc comments as code.** Its first finding was the comment
 *      written to explain it, which quotes the strings it is about. Comments
 *      are stripped now — a checker that reports the paragraph describing a
 *      defect has found the paragraph, not the defect.
 *   2. **It knew one catalogue reader and there are two.** `apps/miniapp` says
 *      everything through a local `said(el, key)`, so every correct call in
 *      that app was a finding. Rather than list the helpers — a list that rots
 *      — a literal shaped like a message key (`app.close`, `plan.title`) is
 *      read as a key. Any helper that takes one is speaking properly, whatever
 *      it is called.
 *   3. **Its offset was one token short**, so the region began mid-argument and
 *      quotes paired across it: `', said(board, '` came back as a sentence.
 *
 * Measured after the repair, over 55 files: three findings, all three real, and
 * they are the three this file was written for.
 */

/** What counts as speaking to the reader. */
export const SPOKEN = ['.textContent', 'aria-label'];

/**
 * Two letters in a row, anywhere in a literal.
 *
 * One letter is not a word — `×`, `·` and a stray `s` in a format string are
 * punctuation as far as this is concerned. Two is enough for `of`, `to`,
 * `Language`.
 */
const WORD = /[A-Za-z]{2,}/;

/**
 * A message key, which is a name and not a sentence.
 *
 * `app.close`, `plan.title`: lowercase word, dot, more word, and no spaces.
 * This is what lets any helper read the catalogue without being named here.
 */
const KEY = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/;

/**
 * The source with its comments taken out.
 *
 * Deliberately simple, and its limit is stated rather than hidden: a `//`
 * inside a string literal — a URL — takes the rest of that line with it. That
 * can only ever cause this to look at LESS text, so it can hide a finding and
 * never invent one, and a checker that errs toward silence is the safer of the
 * two mistakes for something that reports on other people's code.
 */
export function withoutComments(source) {
  // The newlines are KEPT, and that is not tidiness. Replacing a forty-line
  // doc comment with one space moved every line after it: the first falsified
  // run reported the planted defect at line 196 when it sits at 273, which is
  // a finding an operator cannot go and look at. Blank the comment, keep the
  // shape of the file.
  const blanked = (text) => text.replace(/[^\n]/g, ' ');

  return source
    .replace(/\/\*[\s\S]*?\*\//g, blanked)
    .replace(/\/\/[^\n]*/g, blanked);
}

/**
 * The string literals in a fragment, with `${…}` holes removed.
 *
 * The holes go first and that is the trick: a template literal is a sentence
 * only in the parts the author typed, and everything between `${` and `}` is a
 * value somebody else already decided the language of.
 */
export function literalsIn(fragment) {
  const withoutHoles = fragment.replace(/\$\{[^}]*\}/g, ' ');
  const found = [];

  for (const match of withoutHoles.matchAll(/'([^'\\\n]*)'|"([^"\\\n]*)"|`([^`\\]*)`/g)) {
    found.push(match[1] ?? match[2] ?? match[3] ?? '');
  }

  return found;
}

/** Every place this source hands a sentence to the page, as {line, said}. */
export function unspokenIn(source) {
  const code = withoutComments(source);
  const found = [];
  const lineAt = (index) => code.slice(0, index).split('\n').length;

  const regions = [];
  for (const match of code.matchAll(/\.textContent\s*=/g)) {
    regions.push([match.index, match.index + match[0].length]);
  }
  // Past the attribute's own name AND its comma: the name is not the sentence,
  // and starting on it made every correct call look like one.
  for (const match of code.matchAll(/['"]aria-label['"]\s*,/g)) {
    regions.push([match.index, match.index + match[0].length]);
  }

  for (const [at, from] of regions) {
    const semicolon = code.indexOf(';', from);
    const region = code.slice(from, semicolon === -1 ? code.length : semicolon);
    if (region.includes('messageFor')) continue;

    const said = literalsIn(region).filter((one) => WORD.test(one) && !KEY.test(one));
    if (said.length > 0) found.push({ line: lineAt(at), said });
  }

  return found.sort((one, other) => one.line - other.line);
}
