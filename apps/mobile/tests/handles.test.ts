import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TOTAL_PLANS } from '@leela/engine';
import { HANDLE, squareHandle } from '../src/handles';

/**
 * Every control this app has, reachable by name.
 *
 * It had eleven and not one identifier — no `testID`, no
 * `accessibilityLabel` — so nothing outside the process could find the die, the
 * writing box, or the button that starts the game. A screen reader met the same
 * wall, and so did every attempt to test the app by using it.
 *
 * The check runs over `App.tsx` itself, because this is a fact about the screen
 * and no runtime assertion can see it: a control rendered without a name is
 * still rendered, still tappable by a person who can see it, and invisible to
 * everything else.
 *
 * **Both directions.** A control with no handle cannot be reached; a handle no
 * control carries is a suite reaching for something that is not there, which
 * fails with *not found* and reads exactly like the control being gone. The
 * second is the one that wastes an afternoon.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(HERE, '..', 'src', 'App.tsx'), 'utf8');

describe('every control carries a name', () => {
  it('has one for each interactive element on the screen', () => {
    // Counted rather than listed: a `<Pressable>` or `<TextInput>` added later
    // has to be named too, and a list here would simply not mention it.
    //
    // Inside each opening tag, not over the file. A total was tried first and
    // it broke the moment something that is *not* a control was named — the
    // square's title carries one so a test can ask whether the player is on the
    // board — which is a rule saying "only controls may be named", and that is
    // not the rule.
    const openings = [...APP.matchAll(/<(Pressable|TextInput)\b([\s\S]*?)(?=\/?>)/g)];
    const nameless = openings.filter(([, , attributes]) => !attributes.includes('testID={HANDLE.'));

    expect(openings.length, 'no controls found — the reader is wrong').toBeGreaterThan(0);
    expect(nameless.map(([, tag]) => tag), 'a control with no handle').toEqual([]);
  });

  it('uses every handle it declares', () => {
    // The other direction. A handle nothing carries is a promise to a test that
    // the screen does not keep.
    for (const [name, id] of Object.entries(HANDLE)) {
      expect(APP, `HANDLE.${name} (${id})`).toContain(`HANDLE.${name}`);
    }
  });

  it('declares each name once', () => {
    const ids = Object.values(HANDLE);
    expect(new Set(ids).size, 'two controls answering to one name').toBe(ids.length);
  });

  it('gives a button a role and a label as well as a handle', () => {
    // A `testID` is for a test. A person who cannot see the screen needs the
    // other two, and there is no reason for this app to answer only one of them.
    const buttons = (APP.match(/accessibilityRole="button"/g) ?? []).length;
    const pressables = (APP.match(/<Pressable\b/g) ?? []).length;

    expect(buttons).toBe(pressables);
    expect((APP.match(/accessibilityLabel=/g) ?? []).length).toBeGreaterThanOrEqual(pressables);
  });
});

describe('the board answers by square', () => {
  it('names a square after its number', () => {
    expect(squareHandle(1)).toBe('square-1');
    expect(squareHandle(TOTAL_PLANS)).toBe(`square-${TOTAL_PLANS}`);
  });

  it('is derived, not written out', () => {
    // Seventy-two constants here would be a second copy of `BOARD_ROWS`, which
    // is the defect this repository spent six passes removing from the rules.
    // The screen calls the function; nothing lists the squares twice.
    expect(APP).toContain('testID={squareHandle(square)}');
    expect(APP, 'a hand-written square name').not.toMatch(/testID=["']square-\d/);
  });

  it('says which square the piece is on, to a reader who cannot see it', () => {
    // The mark on the board is a colour. Colour is not a fact a screen reader
    // can relay, so the same fact is stated as selection.
    expect(APP).toContain('accessibilityState={{ selected: square === here }}');
  });

  it('names every square the board draws', () => {
    // `BOARD_ROWS` is the engine's, and the screen maps it whole — so the count
    // is the board's rather than this file's opinion of it.
    const rows = (APP.match(/BOARD_ROWS\.map/g) ?? []).length;
    expect(rows, 'the board is drawn from the engine').toBe(1);
  });
});
