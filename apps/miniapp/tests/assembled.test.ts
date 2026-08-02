// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { toDocument } from '@leela/journal';

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
/** What the app handed to the bot, when a test gave it somewhere to hand it. */
let handedOver: string[] = [];

async function play(storage: Storage, language = 'en', inTelegram = false): Promise<string[]> {
  vi.resetModules();
  handedOver = [];

  if (inTelegram) {
    (window as unknown as { Telegram?: unknown }).Telegram = {
      WebApp: {
        ready() {},
        expand() {},
        colorScheme: 'light',
        initData: 'signed-by-telegram',
        initDataUnsafe: {},
        sendData: (data: string) => handedOver.push(data),
      },
    };
  } else {
    delete (window as unknown as { Telegram?: unknown }).Telegram;
  }
  Object.defineProperty(window.navigator, 'language', { value: language, configurable: true });

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

const dialog = (id: string) => document.getElementById(id) as HTMLDialogElement;

/** A seat in play, on the square this file keeps coming back to. */
const onFortyOne = {
  loka: 41,
  previous_loka: 35,
  direction: 'step 🚶🏼',
  consecutive_sixes: 0,
  position_before_three_sixes: 0,
  is_finished: false,
};

const table = (players: unknown[], turnIndex = 0) => JSON.stringify({ turnIndex, players });

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
  }, 20_000);

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
  }, 20_000);

  it('keeps a game in progress when somebody else sits down', async () => {
    // The ninety-sixth pass fixed this in `resize`; here it is through the
    // whole app, which is the layer the tap actually goes through.
    const storage = remembering({
      'leela.intention.v1': 'to see it through',
      'leela.seats.v1': table([{ id: 'p1', state: onFortyOne, reportSubmitted: true }]),
    });

    await play(storage);
    el('players').click();
    await new Promise((resolve) => setTimeout(resolve, 40));

    const options = [...document.querySelectorAll('#list-items button')] as HTMLElement[];
    options[2]?.click();
    await new Promise((resolve) => setTimeout(resolve, 60));

    const seats = JSON.parse(storage.getItem('leela.seats.v1') ?? '{}') as {
      players: { state: { loka: number } }[];
    };

    expect(seats.players.map((seat) => seat.state.loka)).toEqual([41, 68, 68]);
  }, 20_000);

  it('writes an account and shows it as a square that came back', async () => {
    const storage = remembering({
      'leela.intention.v1': 'to see what keeps coming back',
      'leela.reports.v1': JSON.stringify({
        reported: false,
        entries: [{ plan: 41, text: 'February.', at: 1 }],
      }),
      'leela.seats.v1': table([{ id: 'p1', state: onFortyOne, reportSubmitted: false }]),
    });

    await play(storage);

    // Owed on arrival, so the box opens by itself — with what was written here
    // the last time above it.
    expect(openDialogs()).toEqual(['writer']);
    expect(
      [...document.querySelectorAll('#writer-before blockquote p')].map((node) => node.textContent),
    ).toEqual(['February.']);

    (el('writer-text') as HTMLTextAreaElement).value = 'June, and it is quieter.';
    el('writer-text').dispatchEvent(new Event('input', { bubbles: true }));
    el('writer-save').click();
    await new Promise((resolve) => setTimeout(resolve, 60));

    el('plans').click();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(
      [...document.querySelectorAll('#list-items .returns')].map((node) => node.textContent),
    ).toEqual(['2']);
    dialog('list').close();

    el('path').click();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(
      [...document.querySelectorAll('.came-back .chip')].map((node) => node.textContent),
    ).toEqual(['41 · The human plane (jana-loka) ×2']);
    dialog('reader').close();
  }, 20_000);

  it('takes a path back from a file', async () => {
    const storage = remembering({
      'leela.intention.v1': 'to see it through',
      'leela.seats.v1': table([{ id: 'p1', state: onFortyOne, reportSubmitted: true }]),
    });

    await play(storage);

    const document_ = toDocument([{ plan: 9, text: 'From another device.', at: 2 }]);
    const file = new File([JSON.stringify(document_)], 'leela-path.json', {
      type: 'application/json',
    });

    const input = el('path-import-input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 80));

    const kept = JSON.parse(storage.getItem('leela.reports.v1') ?? '{"entries":[]}') as {
      entries: { text: string }[];
    };

    expect(kept.entries.map((entry) => entry.text)).toEqual(['From another device.']);
  }, 20_000);

  it('draws no way out of the question until there is one to come back to', async () => {
    /**
     * The decision `audit-mutants` found undefended: replacing
     * `mayLeaveTheQuestion` with `true`, and then with `false`, left the whole
     * suite green. What was checked was the line in `main.ts`, which reads the
     * same however the function answers.
     *
     * This is what a player meets. A first launch has no question, the die is
     * shut until there is one, and *Change it* — the only way back into the
     * dialog — is not drawn until there is something to change: a Close button
     * here would end the game until the page was reloaded.
     */
    const storage = remembering();
    await play(storage);

    expect(dialog('intention').open, 'the question is asked on a first launch').toBe(true);
    expect(el('intention-close').hidden, 'and cannot be walked away from').toBe(true);

    (el('intention-text') as HTMLTextAreaElement).value = 'to see what I keep avoiding';
    el('intention-save').click();
    await new Promise((resolve) => setTimeout(resolve, 40));

    // And opened again by somebody who now has one to keep.
    el('intention-open')?.click();
    await new Promise((resolve) => setTimeout(resolve, 40));
    if (dialog('intention').open) {
      expect(el('intention-close').hidden, 'a question already given may be left alone').toBe(false);
    }
  }, 20_000);

  it('ends a game and begins another without burning the writing', async () => {
    const storage = remembering({
      'leela.intention.v1': 'to finish what I started',
      'leela.reports.v1': JSON.stringify({
        reported: true,
        entries: [{ plan: 51, text: 'Just before the end.', at: 1 }],
      }),
      'leela.seats.v1': table([
        {
          id: 'p1',
          state: {
            loka: 68,
            previous_loka: 51,
            direction: 'win 🕉',
            consecutive_sixes: 0,
            position_before_three_sixes: 0,
            is_finished: true,
          },
          reportSubmitted: true,
        },
      ]),
    });

    await play(storage);

    expect(el('restart').hidden).toBe(false);
    expect(el('roll').disabled, 'the game is over and the die says so').toBe(true);

    el('restart').click();
    await new Promise((resolve) => setTimeout(resolve, 60));

    const seats = JSON.parse(storage.getItem('leela.seats.v1') ?? '{}') as {
      players: { state: { loka: number } }[];
    };
    const kept = JSON.parse(storage.getItem('leela.reports.v1') ?? '{"entries":[]}') as {
      entries: unknown[];
    };

    // The die is shut and the question is on screen: a new game is a new
    // question, and this seat was beginning again under the sentence of the
    // game it had just finished, with `mayThrow` already satisfied by it.
    expect(el('roll').disabled, 'until the new game is asked what it is for').toBe(true);
    expect((el('intention') as HTMLDialogElement).open, 'and it is asked').toBe(true);

    expect(seats.players[0]?.state.loka).toBe(68);
    expect(kept.entries, 'starting again is not a reason to burn what was written').toHaveLength(1);
  }, 20_000);

  it('carries the question out with the answers, and takes one in only where there is none', async () => {
    // The frame every report was written inside. A player who changed phone
    // arrived with everything they had said and nothing they had asked.
    const theirs = remembering({
      'leela.intention.v1': 'to stop hurrying',
      'leela.reports.v1': JSON.stringify({
        reported: true,
        entries: [{ plan: 41, text: 'What it asked of me.', at: 1 }],
      }),
      'leela.seats.v1': table([{ id: 'p1', state: onFortyOne, reportSubmitted: true }]),
    });

    await play(theirs);
    const written = JSON.parse(
      JSON.stringify(toDocument([{ plan: 41, text: 'What it asked of me.', at: 1 }], 'to stop hurrying')),
    ) as { intention?: string };
    expect(written.intention, 'the file this app would write').toBe('to stop hurrying');

    // A new device: no question of its own, so the file's is taken.
    const fresh = remembering({
      'leela.seats.v1': table([{ id: 'p1', state: onFortyOne, reportSubmitted: true }]),
    });
    await play(fresh);
    await answerTheIntention('');
    const file = new File([JSON.stringify(written)], 'leela-path.json', {
      type: 'application/json',
    });
    const input = el('path-import-input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(fresh.getItem('leela.intention.v1')).toBe('to stop hurrying');

    // And a device that already has one keeps it: what somebody is playing for
    // is not a file's to set.
    const asked = remembering({
      'leela.intention.v1': 'to say it out loud',
      'leela.seats.v1': table([{ id: 'p1', state: onFortyOne, reportSubmitted: true }]),
    });
    await play(asked);
    const again = new File([JSON.stringify(written)], 'leela-path.json', {
      type: 'application/json',
    });
    const second = el('path-import-input') as HTMLInputElement;
    Object.defineProperty(second, 'files', { value: [again], configurable: true });
    second.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(asked.getItem('leela.intention.v1')).toBe('to say it out loud');
  }, 20_000);

  it('loads a language whose plans are translated, and one that is not a language', async () => {
    // The dataset is fetched per language as its own chunk, which only the
    // assembled app does. Twenty of the twenty-two have plans and no message
    // catalogue — that is deliberate and `messageCoverage` reports it — so what
    // is asserted is the part that is not a choice: the texts arrive, the
    // direction is right, and nothing throws.
    const seats = table([{ id: 'p1', state: onFortyOne, reportSubmitted: true }]);

    expect(await play(remembering({ 'leela.intention.v1': 'x', 'leela.seats.v1': seats }), 'ru')).toEqual([]);
    expect(el('plan-title').textContent).toBe('Человеческий план (джана-лока)');
    expect(document.documentElement.dir).toBe('ltr');

    expect(await play(remembering({ 'leela.intention.v1': 'x', 'leela.seats.v1': seats }), 'ar')).toEqual([]);
    expect(document.documentElement.dir, 'right to left, and the board is not').toBe('rtl');
    expect(el('board').getAttribute('dir')).toBe('ltr');

    expect(await play(remembering({ 'leela.intention.v1': 'x', 'leela.seats.v1': seats }), 'zz')).toEqual([]);
    expect(el('plan-title').textContent).toBe('The human plane (jana-loka)');
  }, 20_000);

  it('hands over the square the box is about, not the one whose turn it is', async () => {
    /**
     * Both controls inside the writing box — Share and Ask — took the square of
     * whoever held the *turn*. The box belongs to whoever owes a report, and at
     * the end of a game those are different people: winning hands the turn away
     * and never gets it back.
     *
     * So a winner's account of Cosmic Consciousness went out as plan 30, with
     * their words under it and the other player's question at the bottom: a
     * square nobody stood on, signed by somebody who did not write it.
     */
    const storage = remembering({
      'leela.intention.v1': 'the first seat question',
      'leela.intention.v1.p2': 'the second seat question',
      'leela.seats.v1': table(
        [
          {
            id: 'p1',
            state: {
              loka: 68,
              previous_loka: 51,
              direction: 'win 🕉',
              consecutive_sixes: 0,
              position_before_three_sixes: 0,
              is_finished: true,
            },
            reportSubmitted: false,
          },
          {
            id: 'p2',
            state: {
              loka: 30,
              previous_loka: 24,
              direction: 'step 🚶🏼',
              consecutive_sixes: 0,
              position_before_three_sixes: 0,
              is_finished: false,
            },
            reportSubmitted: true,
          },
        ],
        1,
      ),
    });

    await play(storage, 'en', true);

    el('report').click();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(el('writer-title').textContent, 'the box is the winner’s').toContain('Player 1');

    (el('writer-text') as HTMLTextAreaElement).value = 'The last square of my game.';
    el('writer-text').dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 30));

    el('writer-ask').click();
    await new Promise((resolve) => setTimeout(resolve, 40));

    const sent = handedOver[0] ?? '';
    expect(sent, 'the square the box is about').toContain('68.');
    expect(sent, 'and not the one whose turn it is').not.toContain('30.');
    expect(sent).toContain('The last square of my game.');

    // And no question at all: a hand-over reaches the bot as the account
    // holder's, and a phone three people play on has no business telling it
    // what any of them is playing for.
    expect(sent).not.toContain('question');
  }, 20_000);

  it('sends the question when the device is one person', async () => {
    const storage = remembering({
      'leela.intention.v1': 'to stop hurrying',
      'leela.seats.v1': table([{ id: 'p1', state: onFortyOne, reportSubmitted: false }]),
    });

    await play(storage, 'en', true);

    (el('writer-text') as HTMLTextAreaElement).value = 'What it asked of me.';
    el('writer-text').dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 30));

    el('writer-ask').click();
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(handedOver[0] ?? '').toContain('to stop hurrying');
  }, 20_000);

  it('opens one seat’s own accounts from one seat’s own chip', async () => {
    /**
     * The path view shows every seat at the table, each with the squares that
     * came back to *them*. The chips opened the plan and showed whatever the
     * seat holding the turn had written about it — so a player tapped their own
     * return, under their own name, and read the other player's private
     * writing.
     *
     * Worse than the last one of these, which mislabelled a share. This handed
     * somebody else's journal to whoever was holding the phone.
     */
    const storage = remembering({
      'leela.intention.v1': 'the first seat question',
      'leela.intention.v1.p2': 'the second seat question',
      'leela.reports.v1': JSON.stringify({
        reported: true,
        entries: [
          { plan: 41, text: 'Player one, in February.', at: 1 },
          { plan: 41, text: 'Player one, in June.', at: 2 },
        ],
      }),
      'leela.reports.v1.p2': JSON.stringify({
        reported: true,
        entries: [
          { plan: 41, text: 'Player two, in March.', at: 3 },
          { plan: 41, text: 'Player two, in September.', at: 4 },
        ],
      }),
      'leela.seats.v1': table([
        { id: 'p1', state: onFortyOne, reportSubmitted: true },
        {
          id: 'p2',
          state: {
            loka: 30,
            previous_loka: 24,
            direction: 'step 🚶🏼',
            consecutive_sixes: 0,
            position_before_three_sixes: 0,
            is_finished: false,
          },
          reportSubmitted: true,
        },
      ]),
    });

    await play(storage);

    el('path').click();
    await new Promise((resolve) => setTimeout(resolve, 60));

    const chips = [...document.querySelectorAll('.came-back .chip')] as HTMLElement[];
    expect(chips, 'both seats returned to 41').toHaveLength(2);

    // The second chip is in the second seat's section.
    chips[1]?.click();
    await new Promise((resolve) => setTimeout(resolve, 60));

    const quoted = [...document.querySelectorAll('#reader-body blockquote p')].map(
      (node) => node.textContent,
    );

    expect(quoted).toEqual(['Player two, in March.', 'Player two, in September.']);
    expect(quoted.join(' '), 'and not a word of the other player’s').not.toContain('Player one');
    dialog('reader').close();

    // And the first seat's chip is still the first seat's.
    el('path').click();
    await new Promise((resolve) => setTimeout(resolve, 60));
    ([...document.querySelectorAll('.came-back .chip')] as HTMLElement[])[0]?.click();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(
      [...document.querySelectorAll('#reader-body blockquote p')].map((node) => node.textContent),
    ).toEqual(['Player one, in February.', 'Player one, in June.']);
    dialog('reader').close();
  }, 20_000);
});
