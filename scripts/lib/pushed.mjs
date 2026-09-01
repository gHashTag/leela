/**
 * Did the daily push actually go out, and only when it should have?
 *
 * `ai.t27.leela.dailyquote` fires at 06:00 +07 and pushes to every subscriber.
 * `audit-quotes` reads what it WOULD send; nothing read whether it sent. On
 * 2026-08-31 the difference cost a day: there is no 06:00 line in the log at
 * all, and every previous day has one. A laptop asleep at six is a push that
 * never happened, and the only record is a file nobody opens.
 *
 * **It also has to catch a send that was not the schedule.** The same log shows
 * `16:58:35 SENT`, hours off the hour, because I ran the sender by hand while
 * working on the quote file — a message to every subscriber that no shipped
 * feature asked for. A guard that only counts sends would have called that day
 * a success. Counting is not enough; the HOUR is part of the claim.
 *
 * Reads the log rather than the schedule. `launchctl` says a job is loaded,
 * which is a fact about a plist; the log says a person's phone lit up.
 */

/** How far from 06:00 a send may be and still be the schedule's. */
export const ON_TIME_MINUTES = 30;

/** One line of the log, or null when it is not one. */
export function entryIn(line) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):\d{2}[+-]\d{4}\s+(\w+)\s+(\d{4}-\d{2}-\d{2})\s+(\S+)/.exec(
    String(line ?? '').trim(),
  );
  if (match === null) return null;

  const [, at, hour, minute, kind, forDay, quote] = match;
  return {
    /** When the line was written. */
    at,
    minutes: Number(hour) * 60 + Number(minute),
    /** SENT, SKIP, DRY, ERROR. */
    kind,
    /** The day the send was FOR, which a catch-up run makes different from `at`. */
    forDay,
    quote,
  };
}

/** Every readable line, oldest first. */
export const entriesIn = (log) =>
  String(log ?? '')
    .split('\n')
    .map(entryIn)
    .filter((one) => one !== null);

/**
 * What the log says about one day.
 *
 * Three answers, and the third is not a courtesy: a day before the log begins
 * is not a day the push was missed. A guard that called every date it had no
 * record of a failure would report a hundred missed days on its first run and
 * be switched off the same morning.
 */
export function dayOf(entries, day, expectedMinutes = 6 * 60) {
  const forDay = entries.filter((one) => one.forDay === day);
  const sent = forDay.filter((one) => one.kind === 'SENT');

  if (entries.length === 0) return { state: 'unknown', why: 'the log is empty, so nothing is known about any day' };

  const first = entries[0].forDay;
  if (day < first) {
    return { state: 'unknown', why: `the log starts at ${first}, so ${day} is before anything it records` };
  }

  if (sent.length === 0) {
    const tried = forDay.some((one) => one.kind === 'ERROR');
    return {
      state: 'missed',
      why: tried
        ? `${day}: the send was attempted and failed`
        : `${day}: no push went out, and nothing said so`,
    };
  }

  // A send is the schedule's when it lands near the hour the plist asks for.
  // Off the hour it is somebody's hand, and every subscriber's phone lit up
  // for it — which is a thing to be told about, not a thing to count.
  const late = sent.filter((one) => Math.abs(one.minutes - expectedMinutes) > ON_TIME_MINUTES);
  if (late.length === sent.length) {
    const when = late.map((one) => `${String(Math.floor(one.minutes / 60)).padStart(2, '0')}:${String(one.minutes % 60).padStart(2, '0')}`);
    return {
      state: 'unscheduled',
      why: `${day}: sent at ${when.join(', ')}, not the ${String(Math.floor(expectedMinutes / 60)).padStart(2, '0')}:00 the schedule asks for`,
    };
  }

  return { state: 'sent', why: `${day}: ${sent[0].quote} went out` };
}

/** The exit code for a verdict. 1 is *it did not happen*, 2 is *no answer*. */
export function exitCodeFor(state) {
  if (state === 'sent') return 0;
  if (state === 'unknown') return 2;
  return 1;
}
