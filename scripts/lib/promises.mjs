/**
 * Every dependency this monorepo lets a caller supply, against the test that
 * supplies the worst one its type allows.
 *
 * Four consecutive passes found one defect each, and all four were the same
 * defect. A `LanguageModel` that never returned. A `readFile` that never
 * returned. A `RoomStore.save` that threw. A `ReportSink.record` that threw,
 * and then a `history` that threw. Every one of them is behaviour the *type*
 * permits and the code assumed away, and every one was found by going looking
 * rather than by anything failing.
 *
 * An injected dependency is a promise the caller makes and the type does not
 * hold them to. The only way to know what happens when they break it is to
 * break it on purpose, so the rule is: **every injection point has a test that
 * hands it the worst implementation its type allows.** Throwing, and — where a
 * promise is involved — never settling at all, which is the one an error path
 * cannot catch.
 *
 * This finds the injection points by reading the source rather than by keeping
 * a list beside it, because a list beside it is the fourth thing in this
 * repository to go out of date.
 */

/** A property that is a function, or a named dependency shape. */
const DEPENDENCY = /^\s*(?:readonly\s+)?(\w+)\??:\s*(.+?);?\s*$/;

/**
 * Types that are somebody else's implementation rather than data.
 *
 * A `number` cannot misbehave. A store, a sink, a model, a storage and any
 * function can, in ways nothing here compels them not to.
 */
const SHAPES = /Store|Sink|Model|Storage|Queries|=>/;

/** Options-shaped interfaces: what a caller hands in when building a thing. */
export function optionsIn(source) {
  const found = [];
  const pattern = /(?:export\s+)?interface\s+(\w*Options|\w*Sink|\w*Store|\w*Model|GameStorage)\b[^{]*\{/g;

  for (const match of source.matchAll(pattern)) {
    const opens = source.indexOf('{', match.index);
    let depth = 0;
    let index = opens;
    for (; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1;
      if (source[index] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    found.push({ name: match[1], body: source.slice(opens + 1, index) });
  }

  return found;
}

/** The members of those interfaces that somebody else implements. */
export function injectionPoints(source, file) {
  const points = [];

  for (const { name, body } of optionsIn(source)) {
    const code = body
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''))
      .join('\n');

    // A member ends at the line that closes it; a multi-line type is joined so
    // that `record(step: {` and its closing brace read as one declaration.
    for (const line of flatten(code)) {
      const member = line.match(DEPENDENCY);
      if (!member) continue;
      const [, property, type] = member;
      if (!SHAPES.test(type) && !/^\w+\(/.test(line.trim())) continue;
      points.push({ file, owner: name, property });
    }

    for (const method of code.matchAll(/^\s*(\w+)\s*\(/gm)) {
      points.push({ file, owner: name, property: method[1] });
    }
  }

  return dedupe(points);
}

/** One line per member, with nested type bodies folded away. */
function flatten(code) {
  const lines = [];
  let depth = 0;
  let held = '';

  for (const line of code.split('\n')) {
    held += (held ? ' ' : '') + line.trim();
    depth += (line.match(/[{(]/g) ?? []).length - (line.match(/[})]/g) ?? []).length;
    if (depth <= 0) {
      lines.push(held);
      held = '';
      depth = 0;
    }
  }

  if (held) lines.push(held);
  return lines;
}

function dedupe(points) {
  const seen = new Set();
  return points.filter((point) => {
    const key = `${point.owner}.${point.property}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Whether some test hands this member an implementation that misbehaves.
 *
 * Near it, not merely in the same file. A file-wide check said yes to
 * `LanguageModel.complete` on the strength of a hostile `readFile` three
 * hundred lines away — which is how a tool comes to report that everything is
 * covered. The window is the size of a small test body: a member is broken
 * where its name and the breakage are written together.
 *
 * `store.save = async () => { throw`, `record: no`, `complete: () => new
 * Promise(() => {})` — the spellings vary, the proximity does not.
 */
const NEARBY = 400;

export function brokenSomewhere(point, tests, hostileShapes) {
  const named = new RegExp(`\\b${point.property}\\b`, 'g');

  return tests.some((test) => {
    for (const shape of hostileShapes) {
      for (const broken of test.source.matchAll(new RegExp(shape.source, 'g'))) {
        const from = Math.max(0, (broken.index ?? 0) - NEARBY);
        const window = test.source.slice(from, (broken.index ?? 0) + NEARBY);
        named.lastIndex = 0;
        if (named.test(window)) return true;
      }
    }
    return false;
  });
}
