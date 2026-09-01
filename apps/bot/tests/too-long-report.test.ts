import { describe, expect, it } from 'vitest';
import { MAX_REPORT_CHARS, parseDocument, toDocument } from '@leela/journal';
import { CLASSIC } from '@leela/engine';
import { messageFor } from '@leela/content';
import * as commands from '../src/commands';

/**
 * A report longer than a path can keep.
 *
 * Telegram carries 4096 characters and `MAX_REPORT_CHARS` is 4000, so a report
 * written in a chat can be longer than the format holds. This bot filed the
 * whole of it and said *P has reported* — and the tail was cut later, by
 * `parseDocument`, when the path was carried to a phone. Ninety characters of
 * somebody's writing disappeared on the way, on the far side of a file, where
 * nobody was watching it happen.
 *
 * The other two surfaces cap the box a player types in. A chat has no box.
 *
 * Found by sending the longest thing Telegram will carry and reading what came
 * out of the store, and then what came out of the format.
 */

const SEAT = 'p1';

/** A room with one player standing on a square and owing an account of it. */
function owing() {
  const room = commands.openRoom('chat', { id: SEAT, name: 'P' }, 1, {}).room!;
  const started = commands.start(room, SEAT).room!;

  // Thrown until they are on the board and owe a report for where they stand.
  let playing = started;
  for (let turn = 0; turn < 60; turn += 1) {
    const rolled = commands.roll(playing, SEAT, 1_700_000_000_000, { intention: 'to see' });
    playing = rolled.room ?? playing;
    if (commands.report(playing, SEAT, 'x'.repeat(10), 1_700_000_000_000).effects?.length) {
      return playing;
    }
  }

  throw new Error('never came to owe an account');
}

const filedText = (result: commands.CommandResult) =>
  result.effects?.find((effect) => effect.kind === 'report')?.text ?? '';

describe('what the bot keeps of a very long report', () => {
  it('keeps what the format can hold and no more', () => {
    const room = owing();
    const long = 'a'.repeat(MAX_REPORT_CHARS + 90);

    expect(filedText(commands.report(room, SEAT, long, 1)).length).toBe(MAX_REPORT_CHARS);
  });

  it('survives the round trip it used not to', () => {
    /**
     * The shape of the defect: what is filed and what comes back out of a file
     * must be the same text. It was not — the store held 4,090 characters and
     * the format handed back 4,000 — so a player who wrote in a chat and read
     * on a phone lost the end of it.
     */
    const room = owing();
    const long = 'a'.repeat(MAX_REPORT_CHARS + 90);
    const kept = filedText(commands.report(room, SEAT, long, 1));

    const file = JSON.stringify(toDocument([{ plan: 6, text: kept, at: 1 }]));
    expect(parseDocument(file)?.entries[0]?.text).toBe(kept);
  });

  it('says what did not fit, and how much', () => {
    const room = owing();
    const long = 'a'.repeat(MAX_REPORT_CHARS + 90);
    const said = commands.report(room, SEAT, long, 1).replies.map((reply) => reply.text).join(' ');

    expect(said).toContain(
      messageFor('en', 'report.clipped', { count: 90, max: MAX_REPORT_CHARS }),
    );
  });

  it('says nothing about it when everything fitted', () => {
    // A sentence about a bound is furniture on every ordinary report, and this
    // bound is met by almost nobody.
    const room = owing();
    const said = commands
      .report(room, SEAT, 'an ordinary account of this square', 1)
      .replies.map((reply) => reply.text)
      .join(' ');

    expect(said).not.toContain('did not fit');
  });

  it('files a report at the bound whole, without a word', () => {
    // The boundary itself: exactly as long as the format holds is not too long.
    const room = owing();
    const exact = 'a'.repeat(MAX_REPORT_CHARS);
    const result = commands.report(room, SEAT, exact, 1);

    expect(filedText(result).length).toBe(MAX_REPORT_CHARS);
    expect(result.replies.map((reply) => reply.text).join(' ')).not.toContain('did not fit');
  });

  it('still refuses what the variant calls too short, at either end', () => {
    // The other bound, unchanged: clamping the top must not open the bottom.
    const room = owing();
    expect(CLASSIC.minReportChars).toBe(0);
    expect(commands.report(room, SEAT, '   ', 1).effects ?? []).toHaveLength(0);
  });
});
