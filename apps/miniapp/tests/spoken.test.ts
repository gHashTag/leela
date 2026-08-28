import { describe as group, expect, it } from 'vitest';

import type { Finding } from '../../../scripts/lib/spoken.d.mts';
import { literalsIn, unspokenIn, withoutComments } from '../../../scripts/lib/spoken.mjs';

/**
 * The audit that stops an English sentence being typed into the source.
 *
 * `audit-spoken.mjs` reads other people's code and says something about it, so
 * it gets the companion the third principle asks for: fed something bad, it has
 * to complain, and fed something good it has to stay quiet. Every case below is
 * either the defect it was written for or a false positive it actually produced
 * on its first run — all three of those were the checker's fault, not the
 * code's, and each one is now a test.
 */
const said = (source: string): string[] =>
  unspokenIn(source).flatMap((one: Finding) => one.said);

group('a sentence typed into the source', () => {
  it('catches the one that shipped, on the face of a button', () => {
    // The real line, from `apps/webgl/src/main.ts` on 2026-08-28. An English
    // word on a control, on all twenty-two boards.
    expect(said("el.look.textContent = nextLook === 'light' ? 'Light' : 'Dark';")).toEqual([
      'light',
      'Light',
      'Dark',
    ]);
  });

  it('catches a leading word in a template, which is where the other two were', () => {
    // Trailing double space: the `${…}` hole becomes one, which is the point —
    // the words are what the author typed and the hole is somebody else's.
    expect(said('el.tongue.setAttribute(\'aria-label\', `Language: ${LABELS[next]}`);')).toEqual([
      'Language:  ',
    ]);
  });

  it('reports the line the defect is on, not the line comments shifted it to', () => {
    // The first falsified run said 196 for a defect at 273, because a stripped
    // doc comment took forty lines with it. A finding an operator cannot go and
    // look at is barely a finding.
    const source = ['/**', ...Array.from({ length: 8 }, () => ' * padding'), ' */', "x.textContent = 'Dark';"].join(
      '\n',
    );

    expect(unspokenIn(source)[0]?.line).toBe(11);
  });
});

group('what it must not call a sentence', () => {
  it('says nothing about a value that goes through the catalogue', () => {
    expect(said("el.owed.textContent = messageFor(language, 'app.owed');")).toEqual([]);
  });

  it('says nothing about a helper it has never heard of, if it is handed a key', () => {
    // `apps/miniapp` speaks through a local `said(el, key)`. Naming the helpers
    // would be a list that rots; a key-shaped literal is read as a key, so any
    // helper taking one is speaking properly whatever it is called.
    expect(said("close.textContent = said(close, 'app.close');")).toEqual([]);
    expect(said("board.setAttribute('aria-label', said(board, 'app.boardLabel'));")).toEqual([]);
  });

  it('says nothing about interpolated data, which is not a sentence', () => {
    expect(said('button.textContent = String(many);')).toEqual([]);
    expect(said('sanskrit.textContent = each.sanskrit;')).toEqual([]);
    expect(said('el.planHeading.textContent = `${plan} · ${text.title}`;')).toEqual([]);
    expect(said('mark.textContent = `×${times}`;')).toEqual([]);
    expect(said('el.progress.setAttribute(\'aria-label\', `0 / ${WIN_LOKA}`);')).toEqual([]);
  });

  it('does not report the comment that explains it', () => {
    // Its own first finding was the paragraph written to document it, which
    // quotes the strings it is about. A checker that reports the prose about a
    // defect has found the prose.
    const source = ["/* This read `x.textContent = 'Light'` and was wrong. */", 'const a = 1;'].join('\n');

    expect(unspokenIn(source)).toEqual([]);
  });

  it('does not pair quotes across the attribute name it was standing on', () => {
    // Its offset was one token short, so the region began mid-argument and
    // `', said(board, '` came back as an English sentence.
    expect(said("board.setAttribute('aria-label', said(board, 'app.boardLabel'));")).not.toContain(
      ', said(board, ',
    );
  });
});

group('the two readers underneath', () => {
  it('drops the holes from a template before reading it', () => {
    expect(literalsIn('`Language: ${LABELS[next]}`')).toEqual(['Language:  ']);
  });

  it('blanks a comment without moving the lines after it', () => {
    const blanked = withoutComments('a\n/* two\n   three */\nb');

    expect(blanked.split('\n')).toHaveLength(4);
    expect(blanked.split('\n')[3]).toBe('b');
  });
});
