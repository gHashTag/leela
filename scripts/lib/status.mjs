/**
 * The parts of `scripts/status.mjs` that can be held still and asked.
 *
 * The script itself is probes: it fetches a live site, shells out to `railway`
 * and to App Store Connect. None of that can be tested without the world.
 * What can — how a line is judged, how the report reads, and every one of the
 * small parsers that turn another tool's output into a fact — is here, because
 * it is where the failures actually were.
 *
 * The first version of that script decided a line was a failure by testing its
 * text against `/^[A-Z ]+$/`, which caught `UNREACHABLE` and equally caught
 * `NOT ASKED`, so on any machine without the railway CLI it reported a failure
 * where there was none. It lived an hour and was found by hand. The parsers
 * below are the same shape of risk and quieter: a banner regex that stops
 * matching does not throw, it reports the wrong release for ever.
 */

/**
 * What a report says about itself: what is wrong, what was never asked, and
 * the exit code that follows.
 *
 * `unasked` is deliberately not a failure. A machine without an App Store
 * Connect key has not found a problem, and a status tool that cries wolf is a
 * status tool nobody runs.
 */
export function verdict(findings) {
  const wrong = findings.filter((line) => line.kind === 'wrong');
  const unasked = findings.filter((line) => line.kind === 'unasked');

  return { wrong, unasked, code: wrong.length > 0 ? 1 : 0 };
}

/** The report, as the lines a person reads. Grouped by surface, in order. */
export function describe(findings, stamp) {
  const lines = [`Leela, measured ${stamp} UTC`, ''];

  let surface = '';
  for (const line of findings) {
    if (line.surface !== surface) {
      surface = line.surface;
      lines.push(`  ${surface}`);
    }
    lines.push(`    ${line.name.padEnd(26)} ${line.value}${line.note ? `   (${line.note})` : ''}`);
  }

  const { wrong, unasked } = verdict(findings);
  lines.push(
    '',
    wrong.length === 0
      ? 'Everything asked is well.'
      : `${wrong.length} wrong: ${wrong.map((one) => one.name).join(', ')}`,
  );

  // Said separately and on purpose: what was not measured is not a verdict,
  // and the reader deserves to know which of the lines above are silence.
  if (unasked.length > 0) {
    lines.push(`Not asked here: ${unasked.map((one) => one.name).join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * The entry the page names, out of the emitted HTML.
 *
 * Since the per-language split this is the only file the page names, and
 * everything heavy hangs off it, so a parser that quietly stops matching would
 * take the whole weight report with it.
 */
export function entryFrom(html) {
  return /src="\.\/(assets\/[A-Za-z0-9._-]+\.js)"/.exec(html)?.[1] ?? null;
}

/**
 * Which release the bot is running, from the one line only new code prints.
 *
 * `Plan text: all 22 languages are in memory.` is printed by releases from
 * 2026-08-23 onward and by none before, so its absence dates the code as much
 * as its presence does. Null means the line was not there — which is a fact
 * about the release, not a failure of this function.
 */
export function releaseFrom(logText) {
  const said = /Plan text: ([^\n]*)/.exec(logText)?.[1];
  return said === undefined ? null : said.replace(/\.$/, '');
}

/** Whether that log also shows the bot listening, which is a separate claim. */
export function listeningIn(logText) {
  return logText.includes('Listening as @leela_chakra_ai_bot');
}

/** The newest TestFlight build, from `asc-state.mjs`'s own printed shape. */
export function testFlightFrom(ascText) {
  const found = /build (\d+): (\w+)/.exec(ascText);
  return found === null ? null : { build: found[1], state: found[2] };
}

/**
 * The version waiting for a human, if any.
 *
 * `PREPARE_FOR_SUBMISSION` is the state that means nobody has pressed Add for
 * Review, and it is the one thing no other surface can tell apart from a
 * version that shipped.
 */
export function stagedFrom(ascText) {
  return /^\s+([\d.]+): PREPARE_FOR_SUBMISSION/m.exec(ascText)?.[1] ?? null;
}

/** The newest deployment, from `railway deployment list`'s table. */
export function deployFrom(listText) {
  const row = listText.split('\n').find((line) => line.includes('|'));
  if (row === undefined) return null;

  const [id, state, when] = row.split('|').map((part) => part.trim());
  return { id: (id ?? '').slice(0, 8), state: state ?? '?', when: when ?? '' };
}
