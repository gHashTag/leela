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
/**
 * The unit is a `describe` block, not a count of characters.
 *
 * A window of four hundred characters was the first attempt and it was
 * arbitrary in both directions: it called `LanguageModel.complete` covered
 * because a hostile `readFile` sat three hundred lines away, and then, once
 * tightened, it called `ReportSink.record` unanswered because the hostile sink
 * is built in a helper at the top of the block and the assertion is two tests
 * below it. Both are the same mistake — measuring in bytes something that is
 * organised in blocks.
 *
 * A `describe` is what a person writes around one subject. If the breakage and
 * the assertion are in it, they are about each other.
 */
export function blocksIn(source) {
  const blocks = [];

  for (const match of source.matchAll(/^describe(?:\.\w+)?\(/gm)) {
    const opens = source.indexOf('{', match.index ?? 0);
    if (opens < 0) continue;

    let depth = 0;
    let index = opens;
    for (; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1;
      if (source[index] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    blocks.push(source.slice(match.index ?? 0, index + 1));
  }

  return blocks.length > 0 ? blocks : [source];
}

/** The stretches of test source where this member is handed a broken one. */
export function windowsBreaking(point, tests, hostileShapes) {
  const named = new RegExp(`\\b${point.property}\\b`);
  const found = [];

  for (const test of tests) {
    for (const block of blocksIn(test.source)) {
      const hostile = hostileShapes.some((shape) => shape.test(block));
      if (hostile && named.test(block)) found.push({ path: test.path, window: block });
    }
  }

  return found;
}

/**
 * Whether anything near the breakage says what the person on the other end is
 * told.
 *
 * The second question, and the one every defect of this family failed. All four
 * were caught somewhere — a `catch` logging to the console, a `try` around a
 * write, a swallowed refusal with a comment explaining why — and in every case
 * the person using the thing was told nothing. A test that breaks a dependency
 * and then asserts only that nothing exploded reproduces exactly that: it
 * proves the code survived, which was never in doubt.
 *
 * So an assertion has to be about what was **said**: the replies sent, the line
 * on screen, the log an operator reads. `expect(storage.durable).toBe(false)`
 * is a fact about the machine; `expect(said).toMatch(/could not keep/)` is the
 * thing a person finds out.
 */
/**
 * The vocabulary of an answer.
 *
 * `expect(() => save(hostile)).not.toThrow()` says a failure was caught. Every
 * defect of this family was caught — that is what made them invisible. The
 * question none of them answered is what the other end is *told*, and there are
 * two ways to tell: a sentence a person reads, or a value handed back to the
 * caller so that it can decide.
 *
 * `saveJournal` is both halves of that history in one function. It used to
 * swallow a refusal and return nothing, its test asserted that it did not
 * throw, and behind that assertion the mini app answered "Written. You may
 * throw." while the writing was gone. It returns a boolean now. A test that
 * still ignores it is the same test it was.
 *
 * The list is a vocabulary rather than a rule, and it grows when a real answer
 * turns out not to be in it. That is a smaller risk than the alternative, which
 * is a check that says yes to everything.
 */
const SPOKEN =
  /\b(said|says|texts|sent|reply|replies|say|logged|lines|log|message|announce|textContent|failure|reason|kept|saved|stored|durable|migrated|failures)\b/i;

/**
 * The argument of every `expect(...)` in a stretch of source.
 *
 * Read by matching brackets rather than by counting characters. A regexp with a
 * generous lookahead was the second wrong answer here: it ran past the end of
 * one assertion into the next line, so a block whose every spoken assertion had
 * been deleted still passed — the check said yes to everything, which reads
 * exactly like a check that is satisfied.
 */
export function expectations(source) {
  const found = [];

  for (const match of source.matchAll(/\bexpect\(/g)) {
    let depth = 0;
    let index = (match.index ?? 0) + 'expect'.length;
    const from = index + 1;

    for (; index < source.length; index += 1) {
      if (source[index] === '(') depth += 1;
      if (source[index] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    found.push(source.slice(from, index));
  }

  return found;
}

export function answeredIn(windows) {
  return windows.some(({ window }) =>
    expectations(window).some((argument) => SPOKEN.test(argument)),
  );
}
