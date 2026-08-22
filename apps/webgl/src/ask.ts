import { ARROWS, SNAKES, START_LOKA, TOTAL_PLANS, WIN_LOKA } from '@leela/engine';
import { LANGUAGE_NAMES, type Language } from '@leela/content';

import { messageFor } from './canon';

import { answerIn } from './heard';

import type { Ask, Line, Rests } from './companion';

/**
 * The companion's model, as this page can reach it.
 *
 * `/api/ask` is served by the dev server (see `vite.config.ts`), which holds
 * the key. Nothing secret is in this file and nothing secret can be: whatever
 * ships to a browser is readable by whoever opens it.
 *
 * **Where that route lives is not this file's business.** In a browser the page
 * and the route come from the same origin and a relative path is right. Inside
 * the app the page is loaded from the phone's own filesystem, where a relative
 * path resolves against `file://` and reaches nothing at all - so the host says
 * where to ask, the same way it says whether the player has paid.
 *
 * Three things go with every question, and each was missing at first:
 *
 *   - **The rules.** Without them the model answered about Leela in general
 *     rather than about this board, and could not know that a six is what
 *     enters, that 68 ends it, or where the snakes are.
 *   - **The thread.** Without it every message was answered as if it were the
 *     first, so "and what about that?" got a reply about nothing.
 *   - **What to do next.** A reflection that ends in silence leaves the player
 *     looking for a button. It ends by naming the next act, which is almost
 *     always: throw the die.
 *
 * Every failure resolves to an empty string rather than throwing. The companion
 * treats "no answer" as its offline mode and already has a sentence for it, so
 * a refused route, a missing key or a dropped network all end in the same
 * honest place: read the plan, the reflection is yours either way.
 */

/**
 * A refusal the route explained.
 *
 * Kept apart from every other failure because the companion writes whatever it
 * catches into `note`, which is the one diagnostic the screen offers. A route
 * answering 503 *no model configured* used to reach the player as *the model
 * answered with nothing* - the response was never sent, so the model had
 * answered nothing at all - and the note pointed at the model instead of at the
 * key that was missing.
 */
export class Refused extends Error {}

/*
 * Long, because the thinking is the point.
 *
 * 45 seconds cut a live stream off mid-thought: measured against this model, a
 * question about one plan took 111 seconds to reason and answer. The abort
 * arrived, `ask` resolved to nothing, and the companion reported *the model
 * answered with nothing* about a model that was still talking.
 *
 * A wait this long is only tolerable because it is visible: the reasoning
 * streams onto the screen from the first token, so the player is watching it
 * think rather than watching a spinner.
 */
/**
 * Where to send a question.
 *
 * Relative by default, which is right for a browser: the page and the route
 * share an origin. A host that loads this page from somewhere else - the app,
 * from the phone's own filesystem - sets `window.__leelaAsk` to the origin that
 * serves the route, and the path is appended to it.
 *
 * Read on every call rather than captured once, because the host injects it
 * around the time the document is created and the order is not ours to assume.
 * Anything that is not a string is ignored: a page is a thing other software
 * puts values into, and a bad one should leave the browser case working rather
 * than produce `undefined/api/ask`.
 */
export const askUrl = (): string => {
  const base = (globalThis as { __leelaAsk?: unknown }).__leelaAsk;
  return typeof base === 'string' && base !== ''
    ? `${base.replace(/\/+$/, '')}/api/ask`
    : '/api/ask';
};

const TIMEOUT_MS = 180_000;

/** How much of the plan's own text the model is given to rest on. */
const CANON_CHARS = 1200;

/** How many earlier lines travel with a question. */
const HISTORY_LINES = 10;

/** How much of any one earlier line, so a long plan text cannot crowd the rest. */
const HISTORY_CHARS = 400;

const listOf = (jumps: Readonly<Record<number, number>>): string =>
  Object.entries(jumps)
    .map(([from, to]) => `${from}->${to}`)
    .join(', ');

/** The board this game is actually played on, read from the engine. */
export const rulesText = (): string =>
  [
    `The board has ${TOTAL_PLANS} plans.`,
    `A player is off the board until they throw a six, which places them on plan ${START_LOKA}.`,
    'A six earns another throw; three sixes in a row send the player back to where that run began.',
    `Arrows lift: ${listOf(ARROWS)}.`,
    `Snakes drop: ${listOf(SNAKES)}.`,
    `A throw that would pass plan ${TOTAL_PLANS} does not move the player at all.`,
    `Reaching plan ${WIN_LOKA} completes the game; plan 54 leads straight to it.`,
    'After every landing the player writes what they meet there, and the die stays closed until they do.',
  ].join(' ');

/** What the model is told it is doing, before the player's words. */
/**
 * The sources this game rests on, named rather than gestured at.
 *
 * The line here read *answer from this board and the Vedic sources it rests
 * on*, which asks a model to remember that Leela has sources without telling it
 * which. Leela is Vaishnava in origin and its seventy-two plans are a map of
 * the same ground these texts describe; naming them is the difference between
 * an answer grounded in a tradition and an answer that sounds like one.
 *
 * The instruction to *say which* matters as much as the list. A reflection that
 * names its source can be followed up and argued with; one that does not is
 * indistinguishable from invention, and this game is played on the strength of
 * what the plans mean.
 */
export const SCRIPTURES = [
  'the Bhagavad Gita',
  'the Upanishads',
  'the Vedas',
  'the Puranas, especially the Bhagavata Purana',
  'the Yoga Sutras of Patanjali',
  'the Ramayana and the Mahabharata',
].join(', ');

/** The catalogue's word for a throw, without the die in front of it. */
const throwing = (language: Language): string =>
  messageFor(language, 'button.roll').replace(/^[^\p{L}]+/u, '');

export const systemFor = (
  rests: Rests,
  language: string,
  canon: string,
): string => {
  // Named, not `ru`/`en`. This line read `Reply in ${russian ? 'Russian' :
  // 'English'}` — two of the twenty-two the catalogue carries — so a Ukrainian
  // or Hindi player was answered in English by instruction, whatever the rest
  // of the app had worked out about them.
  const named = LANGUAGE_NAMES[language as Language] ?? 'English';

  return [
    'You are a companion in Leela, the game of self-knowledge.',
    `THE RULES OF THIS BOARD: ${rulesText()}`,
    `The player stands on plan ${rests.plan}${rests.title ? `, ${rests.title}` : ''}.`,
    canon ? `The text of this plan says: ${canon.slice(0, CANON_CHARS)}` : '',
    // The board first, then the tradition behind it: a plan's own text is what
    // the player is standing on, and a scripture that contradicts it is being
    // applied to the wrong square.
    'Ground your answer in this plan, and then in the sacred texts of Hinduism:',
    `${SCRIPTURES}.`,
    'Where a teaching, a verse or a story bears on this plan, bring it and say which text it comes from.',
    'Never invent a citation: if you are unsure of the source, say the teaching without naming a chapter or verse.',
    // Both halves. The second is not decoration: reasoning is spent from the
    // same token budget as the answer, and a model that thinks for twenty
    // thousand characters is cut off before it speaks.
    'Think briefly. Be brief - a short paragraph. Ask nothing back.',
    'Offer one practical step the player can take today.',
    // The player has just been told the die is closed until they write. Ending
    // on the next act is what closes that loop.
    // The catalogue's own word for a throw, in whichever of the twenty-two this
    // is. Two literals used to stand here — «Бросайте кубик» and "Throw the
    // die" — the phrase every other surface already holds, written out twice
    // more and only for two readers.
    //
    // `button.roll` is the bot's own control and carries an emoji: *🎲 Бросок*.
    // The die is not part of the instruction, so everything before the first
    // letter goes.
    `End with one short line naming the next act in the game - usually "${throwing(
      language as Language,
    )}".`,
    // The tag as well as the endonym. `LANGUAGE_NAMES` holds what a language
    // calls itself, and *Reply in Русский* inside an English instruction asks a
    // model to recognise a name written in the script it is being asked to
    // produce - worse still in Devanagari or Arabic. The tag is unambiguous and
    // needs no second table.
    `Reply in ${named} (${language}).`,
  ]
    .filter(Boolean)
    .join(' ');
};

/** The thread so far, as plain lines the model can follow. */
export const historyFor = (said: readonly Line[]): string =>
  said
    .slice(-HISTORY_LINES)
    .map((line) => {
      const who = line.who === 'player' ? 'Player' : 'Companion';
      return `${who} (plan ${line.plan}): ${line.text.slice(0, HISTORY_CHARS)}`;
    })
    .join('\n');

/**
 * @param textFor the plan's canonical text, so the answer rests on the board
 *   rather than on whatever the model remembers about Leela.
 */
export const askOverHttp =
  (language: string, textFor: (plan: number) => string): Ask =>
  async (
    question: string,
    rests: Rests,
    said: readonly Line[] = [],
    onChunk?: (part: { text?: string; thinking?: string }) => void,
  ): Promise<string> => {
    // Abort rather than hang: a companion that never answers leaves the thread
    // showing its thinking dots for as long as the tab is open.
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), TIMEOUT_MS);

    try {
      const thread = historyFor(said);
      const response = await fetch(askUrl(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          // The language of the question, not of the interface. A player
          // typing «Как играть?» on an English board was answered in English,
          // because the model had been told to reply in the language the page
          // was labelled in. See `heard.ts`.
          system: systemFor(rests, answerIn(question, language as Language), textFor(rests.plan)),
          question: thread ? `${thread}\n\nPlayer now says: ${question}` : question,
        }),
        signal: stop.signal,
      });

      if (!response.ok) {
        // The route says why in its body; it is the only side that knows.
        const said = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Refused(said?.error ?? `the route answered ${response.status}`);
      }
      if (!response.body) throw new Refused('the route answered with no body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let answer = '';

      // Read frame by frame. The offset and the buffer are kept apart on
      // purpose: consuming a frame shortens the buffer, so using its length as
      // the read offset re-reads text already parsed - the defect the phone
      // app shipped, which duplicated the reasoning and broke the JSON behind
      // it.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let cut = buffer.indexOf('\n\n');
        while (cut !== -1) {
          const frame = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          cut = buffer.indexOf('\n\n');

          const data = frame
            .split('\n')
            .filter((row) => row.startsWith('data:'))
            .map((row) => row.slice(5).trim())
            .join('');
          if (!data) continue;

          try {
            const event = JSON.parse(data) as {
              text?: string;
              thinking?: string;
              error?: string;
              done?: boolean;
            };
            if (event.error) throw new Refused(event.error);
            if (event.thinking) onChunk?.({ thinking: event.thinking });
            if (event.text) {
              answer += event.text;
              onChunk?.({ text: event.text });
            }
          } catch {
            // A half-delivered frame is not an error; the next read completes it.
          }
        }
      }

      return answer.trim();
    } catch (error) {
      // A refusal the route explained travels; everything else - a dropped
      // network, an abort at the timeout - is the companion's supported
      // offline mode and resolves to no answer.
      if (error instanceof Refused) throw error;
      return '';
    } finally {
      clearTimeout(timer);
    }
  };
