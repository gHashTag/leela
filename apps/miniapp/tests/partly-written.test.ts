// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/**
 * This package's root, taken from this file's own location rather than from the
 * working directory. This is the long version; the other six anchored files
 * point here.
 *
 * A test that reads its own package's files through `process.cwd()` passes
 * while Vitest was started in that directory and throws ENOENT the moment the
 * same suite is collected from anywhere else. Seven suites in this directory
 * did that. It never showed in `bun run test`, because that runs each
 * workspace's own script with that workspace as the working directory, and it
 * never showed in CI for the same reason — so the reads looked correct for as
 * long as nobody ran them from outside.
 *
 * MEASURED, 2026-08-06, `npx vitest run --root apps/miniapp` from
 * `/Users/playra/leela` — `--root` moves Vitest's root and does *not* move
 * `process.cwd()`, which is the whole of it:
 *
 *     Test Files  7 failed | 33 passed (40)
 *          Tests  28 failed | 464 passed (492)
 *
 *     ENOENT: no such file or directory, open '/Users/playra/leela/src/state.ts'
 *     ENOENT: no such file or directory, open '/Users/playra/leela/src/style.css'
 *     ENOENT: no such file or directory, open '/Users/playra/leela/src/board-light.webp'
 *     ENOENT: no such file or directory, open 'src/main.ts'
 *     ENOENT: no such file or directory, open 'index.html'
 *
 * The important half is what that is *not*. Twenty-eight of those failures are
 * this file's thirteen and `assembled.test.ts`'s fourteen, which read inside a
 * helper and so at least became cases and then failed. The other five read at
 * module scope, and a module that throws while it is being evaluated contributes
 * no cases at all — the reporter's line for one of them was
 * `tests/paint.test.ts (0 test)`. **They did not fail. They failed to be
 * collected**, which from a summary line is indistinguishable from a suite that
 * ran and was fine. That is a green suite with a hole in it, and it is the
 * reason this is anchored rather than left alone: the repository now wants one
 * Vitest instance over all ten workspaces, for coverage that per-package
 * scoping reports wrongly, and every one of these seven would have gone quiet
 * in it.
 *
 * The guard is at the bottom of the first case below rather than in a case of
 * its own — a new `it` would move this package's count and `audit-claims`
 * holds README's table to that number.
 */
const PACKAGE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * What survives when a browser stops halfway.
 *
 * The mini app keeps six kinds of key — the table, a journal per seat, a
 * question per seat, a draft per seat, the die's last face, and a game from
 * before there were seats. Every test until now handed it a storage that either
 * worked or refused everything. A browser does neither: it fills up, it is
 * cleared by a setting, a tab is closed mid-write, and what is left is *some* of
 * the keys.
 *
 * The first partial state tried found the worst defect available. A storage that
 * takes the table and refuses the journal — which is what a full quota looks
 * like, since the table is small and the journal grows — answered **"Written.
 * You may throw."**, opened the gate, and lost the account. On the next load
 * there was no record of it and no obligation to write it again: the record the
 * game exists to produce, dropped under a sentence saying it had been kept.
 *
 * The game still goes on — it is in hand for the session either way — but a
 * player whose browser will not keep their writing is owed that while their
 * words are still on the screen.
 */

/** A storage that takes some keys and refuses others. */
function partial(refuse: RegExp, seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));

  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (refuse.test(key)) throw new DOMException('quota', 'QuotaExceededError');
      map.set(key, value);
    },
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
    kept: () => Object.fromEntries(map),
  } as unknown as Storage & { kept(): Record<string, string> };
}

async function play(storage: Storage): Promise<string[]> {
  vi.resetModules();

  const html = readFileSync(resolve(PACKAGE, 'index.html'), 'utf8');
  document.body.innerHTML = html
    .slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');

  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });

  const broke: string[] = [];
  window.addEventListener('error', (event) => broke.push(String((event as ErrorEvent).message)));

  await import('../src/main');
  await new Promise((resolve) => setTimeout(resolve, 60));

  return broke;
}

const el = (id: string) =>
  document.getElementById(id) as HTMLElement & { disabled?: boolean; value?: string };

const onFortyOne = {
  loka: 41,
  previous_loka: 35,
  direction: 'step 🚶🏼',
  consecutive_sixes: 0,
  position_before_three_sixes: 0,
  is_finished: false,
};

const seated = (reportSubmitted: boolean) =>
  JSON.stringify({
    turnIndex: 0,
    players: [{ id: 'p1', state: onFortyOne, reportSubmitted }],
  });

/**
 * Every filesystem read in this directory, and whether it is anchored.
 *
 * Written as a parse rather than a line search, and that is not fastidiousness.
 * The string `process.cwd()` appears in prose in three doc-comments in these
 * suites — including the retracted note in `paint.test.ts` that argued for it —
 * and a grep would name all three. A check that cries wolf on a comment is one
 * somebody deletes rather than obeys, so this reads the syntax tree and looks
 * only at the first argument of an actual call.
 *
 * A read is ANCHORED when its path starts from something this file cannot
 * evaluate but can see is not the working directory: a variable, `__dirname`,
 * or any call other than `process.cwd()` — `dirname(fileURLToPath(...))`,
 * `tmpdir()`. It is UNANCHORED when the path is a bare string literal, or when
 * it is a `resolve`/`join` whose first segment is one of those. Identifiers
 * declared in the same file are followed to their initialiser, so
 * `const HERE = resolve(process.cwd(), '..')` is caught one hop away; an
 * identifier from outside the file is taken on trust, which is a stated hole
 * and not a covered one.
 *
 * The question asked is the shape — *no unanchored read anywhere under
 * `tests/`* — not the seven files that were wrong on the day it was written.
 * The eighth suite to read `index.html` off the working directory fails here on
 * the day it is added, which is the only day the answer is cheap.
 */
const TESTS = join(PACKAGE, 'tests');

type Read = { file: string; line: number; text: string; unanchored: string | null };

function readsIn(file: string): Read[] {
  const text = readFileSync(join(TESTS, file), 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

  /** Every `const x = ...` in the file, so an identifier can be followed once. */
  const bound = new Map<string, ts.Expression>();
  const bind = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      bound.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, bind);
  };
  bind(source);

  const called = (node: ts.CallExpression): string => {
    if (ts.isIdentifier(node.expression)) return node.expression.text;
    if (ts.isPropertyAccessExpression(node.expression)) return node.expression.name.text;
    return '';
  };

  /** The reason a path is unanchored, or `null` if it is anchored. */
  const why = (node: ts.Node, seen: Set<string>): string | null => {
    if (ts.isParenthesizedExpression(node) || ts.isAwaitExpression(node)) {
      return why(node.expression, seen);
    }
    if (ts.isAsExpression(node)) return why(node.expression, seen);
    if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) {
      return 'a bare string literal, so it means whatever the working directory is';
    }
    if (ts.isCallExpression(node)) {
      const name = called(node);
      if (name === 'cwd') return 'rooted at process.cwd()';
      if (name === 'resolve' || name === 'join') {
        const first = node.arguments[0];
        return first ? why(first, seen) : 'a resolve() with nothing to resolve from';
      }
      return null;
    }
    if (ts.isIdentifier(node)) {
      if (seen.has(node.text)) return null;
      const init = bound.get(node.text);
      return init ? why(init, new Set([...seen, node.text])) : null;
    }
    return null;
  };

  const found: Read[] = [];
  const walk = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ['readFileSync', 'readdirSync'].includes(called(node))) {
      const first = node.arguments[0];
      found.push({
        file,
        line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        text: node.getText(source).split('\n')[0] ?? '',
        unanchored: first ? why(first, new Set()) : null,
      });
    }
    ts.forEachChild(node, walk);
  };
  walk(source);

  return found;
}

describe('a browser that keeps some of it', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('never says an account was kept when it was refused', async () => {
    // The defect this file was written for. The sentence and the storage were
    // saying different things, and only one of them was true.
    const storage = partial(/^leela\.reports/, {
      'leela.intention.v1': 'to see it through',
      'leela.seats.v1': seated(false),
    });

    await play(storage);

    (el('writer-text') as HTMLTextAreaElement).value = 'The account I would have lost.';
    el('writer-text').dispatchEvent(new Event('input', { bubbles: true }));
    el('writer-save').click();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(el('say').textContent).toMatch(/will not keep/i);
    expect(el('say').textContent).not.toMatch(/^Written\. You may throw\.$/);
    expect(storage.kept()['leela.reports.v1'], 'and it really was not kept').toBeUndefined();

    // And, in the same case rather than a new one, the reason the read three
    // lines into `play` is written the way it is. See `readsIn` above: this is
    // the shape of the defect, over every suite in this directory, not a list
    // of the seven that carried it.
    const files = readdirSync(TESTS).filter((name) => name.endsWith('.test.ts'));
    const reads = files.flatMap(readsIn);

    // An empty loop is a passing loop, so say out loud what was looked at. The
    // second one is the sharper of the two: it proves the walker descends into
    // a file and recognises a call, rather than merely opening forty of them.
    expect(files.length, 'there are suites in this directory to look at').toBeGreaterThan(0);
    expect(
      reads.filter(({ file }) => file === 'partly-written.test.ts').length,
      "and this file's own read is one of the reads it found",
    ).toBeGreaterThan(0);

    expect(
      reads.filter((read) => read.unanchored).map((read) => `${read.file}:${read.line} ${read.text}`),
      'a suite that reads its own package through the working directory is collected only from that directory',
    ).toEqual([]);
  });

  it('goes on with the game, because the account is in hand either way', async () => {
    // Refusing to open the gate would be the other lie: the player has written
    // it, and a game that stops because a browser is full is a game lost to a
    // setting.
    const storage = partial(/^leela\.reports/, {
      'leela.intention.v1': 'to see it through',
      'leela.seats.v1': seated(false),
    });

    await play(storage);

    (el('writer-text') as HTMLTextAreaElement).value = 'Something worth writing.';
    el('writer-text').dispatchEvent(new Event('input', { bubbles: true }));
    el('writer-save').click();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(el('roll').disabled, 'the die opens').toBe(false);
    expect(el('report').disabled, 'and nothing more is owed').toBe(true);
  });

  it('says it plainly when the writing did land', async () => {
    const storage = partial(/^never$/, {
      'leela.intention.v1': 'to see it through',
      'leela.seats.v1': seated(false),
    });

    await play(storage);

    (el('writer-text') as HTMLTextAreaElement).value = 'Something worth writing.';
    el('writer-text').dispatchEvent(new Event('input', { bubbles: true }));
    el('writer-save').click();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(el('say').textContent).not.toMatch(/will not keep/i);
    expect(storage.kept()['leela.reports.v1']).toContain('Something worth writing.');
  });

  it('opens on a journal whose table was lost', async () => {
    // The other half of a half-written storage: the writing survived and the
    // board did not. A year of somebody's path is not thrown away because the
    // position it was written at has gone.
    const storage = partial(/^never$/, {
      'leela.reports.v1': JSON.stringify({
        reported: true,
        entries: [{ plan: 41, text: 'From a table that is gone.', at: 1 }],
      }),
    });

    expect(await play(storage)).toEqual([]);

    el('path').click();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(document.getElementById('reader-body')?.textContent).toContain(
      'From a table that is gone.',
    );
  });

  it('starts again on a table that was written halfway', async () => {
    // A tab closed mid-write leaves the first half of a JSON document. It is
    // not a game, it is not readable, and the writing beside it is untouched.
    const storage = partial(/^never$/, {
      'leela.seats.v1': '{"turnIndex":0,"players":[{"id":"p1","sta',
      'leela.reports.v1': JSON.stringify({
        reported: true,
        entries: [{ plan: 41, text: 'Older than the broken table.', at: 1 }],
      }),
    });

    expect(await play(storage)).toEqual([]);
    expect(document.querySelectorAll('#board .cell')).toHaveLength(72);

    el('path').click();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(document.getElementById('reader-body')?.textContent).toContain('Older than the broken');
  });
});

describe('a browser that keeps none of the game', () => {
  /**
   * The other thing a full quota takes. The journal was hardened first, and the
   * table beside it went on being swallowed on the stated grounds that
   * *forgetting is a lost game, not an error to show*.
   *
   * Half right: a private window should still play. The other half was that the
   * app kept describing a game it was not keeping — "a snake at 44 takes you to
   * 9", with the stored board still reading 41 — so a player could build a month
   * of play in a window holding none of it and be told at no point.
   *
   * Said once. A window that refuses one write refuses them all, and the notice
   * repeated under every throw would bury the sentence about the throw.
   */
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const playing = (storage: Storage) => ({
    said: () => el('say').textContent ?? '',
    throwOnce: async () => {
      // Long enough for the die to finish turning. The board only moves when it
      // stops, and an assertion made while it spins is an assertion about a
      // player who has not thrown yet — which is how this test first read.
      el('roll').click();
      for (let waited = 0; waited < 40; waited += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (/threw/i.test(el('say').textContent ?? '')) return;
      }
      throw new Error('the die never landed');
    },
    stored: () => storage.kept()['leela.seats.v1'] ?? null,
  });

  const refusingTheTable = () =>
    partial(/^leela\.seats/, {
      'leela.intention.v1': 'to see it through',
      'leela.seats.v1': seated(true),
    });

  it('says the game is not being kept, beside the move it is not keeping', async () => {
    const storage = refusingTheTable();
    expect(await play(storage)).toEqual([]);
    const game = playing(storage);

    await game.throwOnce();

    expect(game.said(), 'the throw is still described').toMatch(/threw/i);
    expect(game.said(), 'and so is the fact that it is going nowhere').toMatch(/will not keep/i);
    expect(game.stored(), 'which is true: the board is as it was').toContain('"loka":41');
  });

  it('says it once, and not again under the next thing said', async () => {
    // A throw, then the account it asks for — two different lines, and a
    // browser that refuses one write refuses both. The second one carries no
    // notice: repeated, it would become the wallpaper a player reads past.
    const storage = refusingTheTable();
    await play(storage);
    const game = playing(storage);

    await game.throwOnce();
    expect(game.said(), 'said the first time').toMatch(/will not keep/i);

    el('report').click();
    await new Promise((resolve) => setTimeout(resolve, 60));
    (el('writer-text') as HTMLTextAreaElement).value = 'What that square asked of me.';
    el('writer-text').dispatchEvent(new Event('input', { bubbles: true }));
    el('writer-save').click();
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(game.said(), 'the writing is confirmed').toMatch(/written/i);
    expect(game.said(), 'and not re-announced').not.toMatch(/will not keep/i);
  });

  it('says nothing at all when the browser is keeping it', async () => {
    // The case that must stay quiet, and the one a notice bolted to `announce`
    // would break first.
    const storage = partial(/^never$/, {
      'leela.intention.v1': 'to see it through',
      'leela.seats.v1': seated(true),
    });
    await play(storage);
    const game = playing(storage);

    await game.throwOnce();

    expect(game.said()).toMatch(/threw/i);
    expect(game.said()).not.toMatch(/will not keep/i);
    expect(game.stored(), 'and the board moved').not.toContain('"loka":41');
  });
});

describe('a question the browser will not keep', () => {
  /**
   * The intention dialog is the one the game will not start without, and its
   * writer was the odd one out: `saveIntention` returned `true` for "worth
   * keeping" rather than "kept", so one word answered two questions and the
   * caller could not tell which. Over a store that refuses, the player was told
   * **"Two characters at least — say something you mean."** about a sentence
   * that was long enough — a browser's failure reported as their mistake, in
   * the one place they cannot go around.
   *
   * Two facts, two sentences now: whether the words are a question worth
   * playing for, and whether this browser is keeping anything.
   */
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const answering = async (text: string, refuse: RegExp) => {
    const storage = partial(refuse);
    await play(storage);

    (el('intention-text') as HTMLTextAreaElement).value = text;
    el('intention-save').click();
    await new Promise((resolve) => setTimeout(resolve, 80));

    return { hint: el('intention-hint').textContent ?? '', said: el('say').textContent ?? '' };
  };

  it('does not call a long enough question too short', async () => {
    const { hint, said } = await answering('To see what I keep avoiding.', /^leela\.intention/);

    expect(hint, 'nothing wrong with what they wrote').not.toMatch(/two characters/i);
    expect(said, 'and the browser is what is wrong').toMatch(/will not keep/i);
  });

  it('still calls a short one short', async () => {
    // The message has a cause of its own, and it has to keep it.
    const { hint } = await answering('x', /^never$/);

    expect(hint).toMatch(/two characters/i);
  });

  it('plays on with the question held for the session', async () => {
    const storage = partial(/^leela\.intention/);
    await play(storage);

    (el('intention-text') as HTMLTextAreaElement).value = 'To see what I keep avoiding.';
    el('intention-save').click();
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect((el('intention') as HTMLDialogElement).open, 'the dialog lets them through').toBe(false);
    expect(el('roll').disabled, 'and the die turns').toBe(false);
  });
});

describe('half an account, in a browser keeping nothing', () => {
  /**
   * The draft is the earliest write of a session — before a throw, before an
   * account is filed — so it is the first moment the app can know that this
   * browser is keeping nothing. It used to be the one write that could not say
   * so: `saveDraft` returned nothing, under a comment observing that a player
   * "simply has to finish in one sitting". That is exactly the thing to tell
   * somebody *before* they walk away from half a page, and it was being said
   * only in the source.
   *
   * Only the draft key is refused here. A quota refuses everything and the
   * notice would fire from the first write of any kind, which would prove
   * nothing about this one.
   */
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('says so while the half is still on the screen', async () => {
    const storage = partial(/^leela\.draft/, {
      'leela.intention.v1': 'to see it through',
      'leela.seats.v1': seated(false),
    });
    await play(storage);

    el('report').click();
    await new Promise((resolve) => setTimeout(resolve, 60));
    (el('writer-text') as HTMLTextAreaElement).value = 'What I have got so far';
    el('writer-text').dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(el('say').textContent, 'before anything else has been written').toMatch(
      /will not keep/i,
    );
  });

  it('says nothing when the draft is being kept', async () => {
    const storage = partial(/^never$/, {
      'leela.intention.v1': 'to see it through',
      'leela.seats.v1': seated(false),
    });
    await play(storage);

    el('report').click();
    await new Promise((resolve) => setTimeout(resolve, 60));
    (el('writer-text') as HTMLTextAreaElement).value = 'What I have got so far';
    el('writer-text').dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(el('say').textContent).not.toMatch(/will not keep/i);
    expect(storage.kept()['leela.draft.v1'], 'and it really is kept').toContain('got so far');
  });
});
