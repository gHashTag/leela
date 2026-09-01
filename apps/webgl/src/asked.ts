import type { Language } from '@leela/content';

import type { Ask, Line, Rests } from './companion';
import { TIMEOUT_MS, historyFor, Refused, systemFor } from './ask';
import { answerIn } from './heard';

/**
 * Asking the app instead of a server.
 *
 * The board runs in two places and they can reach different things. In a
 * browser it is served over http and a route beside it holds the key. Inside
 * the app it is loaded from the phone's own filesystem, and there is no route
 * beside it at all - so it asks its host, which has the key and can make the
 * call itself.
 *
 * **No second server, and nothing to deploy.** That is the point: the game is
 * one thing the player installs, and a companion that stops working because
 * somebody's laptop is shut is not a companion. The cost is that the key ships
 * inside the app, where a determined person can extract it. That is a decision
 * about this product, not a defect of this file.
 *
 * The prompt is built here, exactly as the http transport builds it - the plan
 * text, the rules, the language of the question - so the two paths ask the same
 * question and only the delivery differs.
 */

/** What the host is told, and what it sends back. */
interface Told {
  readonly what: 'ask';
  readonly id: string;
  readonly system: string;
  readonly question: string;
}

/** One piece of an answer, as the host delivers it. */
export interface Part {
  readonly id?: string;
  readonly thinking?: string;
  readonly text?: string;
  readonly error?: string;
  readonly done?: boolean;
}

/** The host, when there is one that can carry a message. */
const poster = (): { postMessage: (data: string) => void } | null => {
  const host = (globalThis as { ReactNativeWebView?: { postMessage?: unknown } })
    .ReactNativeWebView;
  return typeof host?.postMessage === 'function'
    ? (host as { postMessage: (data: string) => void })
    : null;
};

/** Whether this board is inside something that can answer a question. */
export const hostCanAnswer = (): boolean => poster() !== null;

/**
 * Every question in flight, by id.
 *
 * A map rather than one pending question: the player can send a second before
 * the first finishes, and a single slot would deliver the first answer's chunks
 * into the second answer's bubble.
 */
const waiting = new Map<string, (part: Part) => void>();

/**
 * The one function the host calls.
 *
 * Installed on the page rather than dispatched as an event, because the host
 * injects plain JavaScript and calling a function is the least it can do. It is
 * defined once, on load, so a chunk arriving before any question - which should
 * not happen, and did, when a reload left the app mid-answer - is dropped
 * quietly rather than throwing inside the host's injected script.
 */
(globalThis as { __leelaAskEvent?: (part: Part) => void }).__leelaAskEvent = (
  part: Part,
): void => {
  if (!part || typeof part !== 'object') return;
  const deliver = part.id ? waiting.get(part.id) : undefined;
  deliver?.(part);
};

/** Ids that do not repeat within a session, without needing randomness. */
let counter = 0;
const nextId = (): string => {
  counter += 1;
  return `ask-${counter}`;
};

/**
 * @param textFor the plan's canonical text, so the answer rests on the board
 *   rather than on whatever the model remembers about Leela.
 */
export const askOverHost =
  (language: string, textFor: (plan: number) => string): Ask =>
  async (
    question: string,
    rests: Rests,
    said: readonly Line[] = [],
    onChunk?: (part: { text?: string; thinking?: string }) => void,
  ): Promise<string> => {
    const host = poster();
    if (!host) throw new Refused();

    const id = nextId();
    const told: Told = {
      what: 'ask',
      id,
      // The language of the question, not of the interface: a player typing
      // «Как играть?» on an English board is answered in Russian.
      system: systemFor(
        rests,
        answerIn(question, language as Language),
        textFor(rests.plan),
      ),
      // The thread travels the same way it does over HTTP: a host companion
      // without it answers every message as if it were the first.
      question: historyFor(said)
        ? `${historyFor(said)}\n\nPlayer now says: ${question}`
        : question,
    };

    return new Promise<string>((resolve, reject) => {
      let answer = '';

      const finish = (): void => {
        waiting.delete(id);
        clearTimeout(timer);
      };

      const timer = setTimeout(() => {
        finish();
        reject(new Refused());
      }, TIMEOUT_MS);

      waiting.set(id, (part) => {
        if (part.thinking) onChunk?.({ thinking: part.thinking });
        if (part.text) {
          answer += part.text;
          onChunk?.({ text: part.text });
        }
        if (part.error) {
          finish();
          reject(new Refused());
          return;
        }
        if (part.done) {
          finish();
          // An empty completion is not an answer; the companion has a fallback
          // for exactly this and should be allowed to use it.
          if (!answer.trim()) reject(new Refused());
          else resolve(answer);
        }
      });

      host.postMessage(JSON.stringify(told));
    });
  };
