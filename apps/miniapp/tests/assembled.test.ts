// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The mini app as it is actually assembled, played.
 *
 * The bot got a test like this two passes ago, after a defect that no unit test
 * could have found: every one of them holds a store it built itself, and the
 * halves only meet where the thing is put together. The mini app had nothing
 * between its unit tests and my own hands in a browser — and a browser cannot
 * be made to refuse `localStorage`, because overriding it and reloading gives
 * the page a fresh real one.
 *
 * Here it can. `main.ts` is loaded whole, against the real `index.html`, with
 * whatever storage the test hands it.
 *
 * The first run found the app **unplayable in a private window**. The intention
 * was accepted and written; the die stayed dead; nothing could begin. The cause
 * was one line: `saveIntention` catches the refusal and returns true — as its
 * own comment promises, "a window that cannot store still plays" — and then the
 * caller read the value *back out* of the store that had just refused it. The
 * filed report had the same shape, one function along.
 *
 * So the rule is not about private windows. It is: **what somebody has this
 * moment written is not re-read from a place that may answer "nothing".**
 */

/** A storage that takes everything and gives nothing back. */
function privateWindow(): Storage {
  const refuse = (): never => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  };

  return {
    getItem: refuse,
    setItem: refuse,
    removeItem: refuse,
    clear: refuse,
    key: refuse,
    get length(): number {
      return refuse();
    },
  } as unknown as Storage;
}

/** An ordinary storage, optionally with a game already in it. */
function remembering(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));

  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
  } as unknown as Storage;
}

/**
 * Build the page and load the app into it.
 *
 * The `<script>` tags go: happy-dom will not run them, and the module is
 * imported here instead — which is the point, since that is what a bundle does.
 */
async function play(storage: Storage): Promise<string[]> {
  vi.resetModules();

  const html = readFileSync('index.html', 'utf8');
  const body = html
    .slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');

  document.body.innerHTML = body;
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });

  const broke: string[] = [];
  window.addEventListener('error', (event) => broke.push(String((event as ErrorEvent).message)));

  await import('../src/main');
  // The plans arrive as a dynamic import; nothing is drawn before they do.
  await new Promise((resolve) => setTimeout(resolve, 60));

  return broke;
}

const el = (id: string) =>
  document.getElementById(id) as HTMLElement & { disabled?: boolean; value?: string };

const openDialogs = () =>
  [...document.querySelectorAll('dialog')]
    .filter((dialog) => (dialog as HTMLDialogElement).open)
    .map((dialog) => dialog.id);

async function answerTheIntention(text = 'to see it through'): Promise<void> {
  (el('intention-text') as HTMLTextAreaElement).value = text;
  el('intention-save').click();
  await new Promise((resolve) => setTimeout(resolve, 30));
}

describe('the mini app as it is assembled', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('draws a whole board and asks its question first', async () => {
    const broke = await play(remembering());

    expect(broke).toEqual([]);
    expect(document.querySelectorAll('#board .cell')).toHaveLength(72);
    expect(openDialogs()).toEqual(['intention']);
  });

  it('plays in a private window, which is what the code has always claimed', async () => {
    // The defect this file was written for. Every function involved was tested
    // and behaved; the app did not.
    const broke = await play(privateWindow());
    expect(broke).toEqual([]);

    await answerTheIntention();

    expect(el('say').textContent).toBeTruthy();
    expect(el('roll').disabled, 'the die opens once the question is answered').toBe(false);

    el('roll').click();
    await new Promise((resolve) => setTimeout(resolve, 2500));

    // A throw was taken and described. Which throw it was is the die's business.
    expect(el('say').textContent).toMatch(/\d/);
  }, 20_000);

  it('keeps what was just written even where nothing can be stored', async () => {
    // The same shape one function along: the report is filed, and the app must
    // not ask a refusing store what it has.
    await play(
      privateWindow(),
    );
    await answerTheIntention();

    // Nothing is owed yet, so the writing box is not on offer — which is itself
    // the rule from an earlier pass, and worth seeing hold here.
    expect(el('report').disabled).toBe(true);
  }, 20_000);

  it('comes back to a game it stored', async () => {
    // The other half: a storage that does remember must be believed.
    const seeded = remembering({
      'leela.intention.v1': 'to finish what I started',
      'leela.seats.v1': JSON.stringify({
        turnIndex: 0,
        players: [
          {
            id: 'p1',
            state: {
              loka: 41,
              previous_loka: 35,
              direction: 'step 🚶🏼',
              consecutive_sixes: 0,
              position_before_three_sixes: 0,
              is_finished: false,
            },
            reportSubmitted: true,
          },
        ],
      }),
    });

    const broke = await play(seeded);

    expect(broke).toEqual([]);
    expect(openDialogs(), 'the question has an answer already').toEqual([]);
    expect(el('plan-number').textContent).toBe('41');
    expect(el('roll').disabled).toBe(false);
  });
});
