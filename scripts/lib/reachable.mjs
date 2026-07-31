/**
 * Words a type declares that nothing ever says.
 *
 * `TurnBlockedReason` listed `finished` and `canRoll` returned it from nowhere:
 * the only mention of that word in the file was the type itself. So every
 * surface wrote the check by hand — the bot inline, the mini app in its own
 * `canRoll`, the phone through `isSessionOver`, which asks a different question
 * — and one of the three got it wrong.
 *
 * A vocabulary with an unreachable word in it is worse than a shorter one. It
 * reads as though the question is answered here, and the answers get written
 * somewhere else, once per surface.
 *
 * The check is *produced*, not *handled*: a value that appears only in a
 * `switch` arm or a comparison is being received rather than made, and that is
 * a different thing — see `RECEIVED` in the audit for the one case of it here.
 */

/** Comments removed, so that a word quoted in prose is not a use of it. */
export function codeIn(source) {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return withoutBlocks
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

/** `type X = 'a' | 'b';` and `kind: 'a' | 'b';` — every string union declared. */
export function unionsIn(source, file) {
  const found = [];

  const alias = /(?:export\s+)?type\s+(\w+)\s*=\s*((?:\s*\|?\s*'[^']+')+)\s*;/g;
  for (const match of source.matchAll(alias)) {
    const members = [...match[2].matchAll(/'([^']+)'/g)].map((one) => one[1]);
    if (members.length > 1) {
      found.push({ name: match[1], members, file, at: [match.index, match.index + match[0].length] });
    }
  }

  const field = /^\s*(?:readonly\s+)?(\w+)\??:\s*((?:'[^']+'\s*\|\s*)+'[^']+')\s*;/gm;
  for (const match of source.matchAll(field)) {
    const members = [...match[2].matchAll(/'([^']+)'/g)].map((one) => one[1]);
    if (members.length > 1) {
      found.push({ name: match[1], members, file, at: [match.index, match.index + match[0].length] });
    }
  }

  return found;
}

/** The workspace a file belongs to: `apps/bot/src/x.ts` -> `apps/bot`. */
function packageOf(file) {
  return file.split('/').slice(0, 2).join('/');
}

/**
 * Members of a union that nothing in its own package says out loud.
 *
 * The declaration itself is cut out first, or every union would prove itself.
 *
 * **Its own package, and only that.** The first version of this looked
 * everywhere, and both attempts to make it fail passed: `'finished'` is said by
 * the bot's `{ say: 'finished' }`, and `'path'` by a command, a message key and
 * a filename. A word common enough to appear somewhere is a word this check can
 * never see missing — which is exactly the blind spot `audit-unread` had, where
 * one live caller of a name covered a dead export of the same name next door.
 *
 * A union's producer is in the package that declares it: the engine makes the
 * directions, the mini app makes its own reader kinds. A consumer elsewhere
 * proves nothing about whether anybody makes them.
 */
export function unsaidIn(union, sources) {
  const own = packageOf(union.file);

  return union.members.filter((member) => {
    const quoted = `'${member}'`;

    return !sources.some(({ file, code }) => {
      if (packageOf(file) !== own) return false;
      const body =
        file === union.file ? code.slice(0, union.at[0]) + code.slice(union.at[1]) : code;
      return body.includes(quoted);
    });
  });
}
