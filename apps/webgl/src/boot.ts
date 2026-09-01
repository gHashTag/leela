/**
 * The board's first act: fetch the reader's language, then run the board.
 *
 * The board carried all twenty-two languages in its entry — 6,624,622 bytes
 * decoded, 1,790,216 on the wire, and almost every one of them text this
 * reader cannot read. They are separate chunks now, which means the plan text
 * has to arrive before anything renders, which means a wait.
 *
 * The wait is here rather than at the top of `main.ts` because a top-level
 * `await` is not available: Vite's target is es2020, and raising it is not on
 * offer either — the iOS app deploys to iOS 13, whose WebView has no top-level
 * await at all, and a board that is blank on a phone is worse than a board
 * that is heavy. A `.then` works everywhere `import()` does, which is every
 * runtime this game has ever run in.
 *
 * `main.ts` becomes a chunk of its own by being imported this way. That costs
 * one more request and is the reason the entry is small.
 */
import { loadLanguage } from '@leela/content';

import { boardLanguage } from './tongue';

/**
 * Run the board whatever happened to the fetch.
 *
 * English is in the entry — it is the catalogue's fallback and cannot be
 * lazy — so a language that failed to arrive is a board in English, not a
 * board with no words. `plansFor` says so in the console when it happens, so
 * the degradation is visible rather than silent, which is the failure this
 * project keeps having.
 */
const run = (): Promise<unknown> => import('./main');

void loadLanguage(boardLanguage()).then(run, (why: unknown) => {
  console.warn(`[board] could not load the plan text; running in English: ${String(why)}`);
  return run();
});
