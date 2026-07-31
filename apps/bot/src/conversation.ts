/**
 * What the companion has been asked, and what it said.
 *
 * `Guide` has taken a `history` since it was written and `answer()` has never
 * been called: the whole conversational half of the companion existed and no
 * surface could reach it. A player could write a report and be answered; they
 * could not ask anything.
 *
 * The published app has that half — `ChatScreen` keeps the last five messages
 * from each side and replays them. It replays them **wrongly**: two lists, all
 * the questions and then all the answers, so the model sees five questions in a
 * row followed by five answers and no pairing between them. This keeps the
 * conversation in the order it happened, which costs nothing and is the whole
 * point of sending it.
 *
 * In memory, per player, and lost on restart — as it is in the app, where the
 * context lives in component state. A conversation is not a report: the report
 * is the record the game exists to produce and is stored; a question asked in
 * passing is not.
 */

import type { Message } from '@leela/ai';

/** How many messages to carry. Six is three exchanges, which is `MAX_HISTORY`. */
export const KEEP_MESSAGES = 6;

/**
 * How many players' conversations to hold at once.
 *
 * Each one was bounded and the number of them was not, so a process that is
 * never restarted holds one for every player who has ever asked anything — and
 * this repository has already measured that argument and found it false once:
 * *a bot that is never restarted is not accumulating tables either*, said about
 * the finished games that had piled up for twelve weeks. Conversations pile up
 * the same way, for the same reason, and nothing forgets them.
 *
 * Ten thousand is about twelve megabytes of six short messages each, and a
 * player evicted from it loses what a restart would have taken anyway. The
 * least recently spoken to goes first.
 */
export const MAX_CONVERSATIONS = 10_000;

export class Conversations {
  private readonly byPlayer = new Map<string, Message[]>();

  /** What to send with the next question. Oldest first. */
  of(playerId: string): Message[] {
    return this.byPlayer.get(playerId) ?? [];
  }

  /**
   * Remember one exchange.
   *
   * Both halves at once, so a question can never be stored without the answer
   * it produced — the pairing is the only thing history is for.
   */
  add(playerId: string, question: string, answer: string): void {
    const kept = [
      ...this.of(playerId),
      { role: 'user' as const, content: question },
      { role: 'assistant' as const, content: answer },
    ];

    // Deleted before it is set, so the map's own insertion order becomes an
    // order of last speaking — which is what makes the eviction below the
    // *least recently* spoken to rather than the first one ever seen.
    this.byPlayer.delete(playerId);
    this.byPlayer.set(playerId, kept.slice(-KEEP_MESSAGES));

    while (this.byPlayer.size > MAX_CONVERSATIONS) {
      const oldest = this.byPlayer.keys().next();
      if (oldest.done) break;
      this.byPlayer.delete(oldest.value);
    }
  }

  /** How many conversations are being held. */
  get size(): number {
    return this.byPlayer.size;
  }

  /** Forget a player's conversation. A new game is a new conversation. */
  clear(playerId: string): void {
    this.byPlayer.delete(playerId);
  }
}
