/**
 * What the companion has been asked, and what it said.
 *
 * `Guide` has taken a `history` since it was written and `answer()` has never
 * been called: the whole conversational half of the companion existed and no
 * surface could reach it. A player could write a report and be answered; they
 * could not ask anything.
 *
 * **What the published app actually does, measured — and it is worse than what
 * this header used to claim.** The claim was that `ChatScreen` keeps the last
 * five messages from each side and replays them as two lists, all the questions
 * and then all the answers, unpaired. That cannot happen, and the file says so
 * in one call site: in
 * `leela-src/leela/src/screens/Tabs/ChatScreen/index.tsx`,
 * `updateContextSummary` branches on `message.user._id === 1` and is called from
 * exactly one place — line 78, on `newMessages[0]` out of GiftedChat's `onSend`,
 * whose `user` prop is `{_id: 1}`. Every message that reaches it is the
 * player's. The `else` branch that fills `contextSummary.assistant` is
 * unreachable, so that array is empty for the life of the screen, and
 * `...contextSummary.assistant.map(...)` in the request contributes nothing.
 * The model is sent the system prompt, the player's last five utterances, and
 * the new one: a monologue. It has never been shown a single reply of its own.
 * The assistant's answers are appended to `messages` for the screen to draw and
 * are never given to the summary.
 *
 * So the decision below — keep the conversation in the order it happened,
 * paired — is unchanged and still right. Only the evidence for it was wrong,
 * and in the direction that understated the defect: the app does not replay the
 * companion's words badly, it does not replay them at all.
 *
 * In memory, per player, and lost on restart — as it is in the app, where the
 * context lives in component state. A conversation is not a report: the report
 * is the record the game exists to produce and is stored; a question asked in
 * passing is not.
 *
 * **Deliberately not persisted, and that is a decision rather than an
 * oversight.** There is nowhere to put it that is not a new decision:
 * `sqlite.ts` keeps `reports (id, user_id, plan, text, created_at)` with no
 * column for an answer, and `Report` in `@leela/journal` has no field for one.
 * The donor did keep it — `leela-chakra-bot/src/core/supabase/game.ts` inserts
 * `ai_response` beside `content`, and NeuroLeelaExpo declares a whole
 * `chat_history` table with five indexes which `ChatBot.tsx` reads on open and
 * which **nothing anywhere writes**. That table came across into
 * `packages/db` intact, still with no writer. Starting to write it from here
 * would be inventing a schema decision inside a transport, so this store stays
 * in memory and bounded, and the persistence question stays open and named.
 *
 * **Every route that produces an answer feeds this, not only `/ask`.** For a
 * long time `conversations.add` had exactly one caller — `/ask`, which is
 * optional — while the report gate, which every player is forced down, produced
 * a model-written reflection and dropped it. A player who never typed `/ask`
 * was answered, every single turn, by something that had never heard itself.
 * The report gate and the handed-over square now keep theirs too, and
 * `tests/conversation.test.ts` derives the routes that can reach the companion
 * from `bot.ts` itself, so a fourth one that answers a player and forgets it
 * fails rather than passing unnoticed.
 *
 * The cost of that, stated rather than hidden: a report now reaches the model
 * twice on the next turn — once inside the journey summary the prompt builds
 * from the stored reports, and once as the player half of the exchange it
 * produced. Storing only the answer would avoid it and would reproduce the
 * exact defect this file exists to refuse, an assistant turn with nothing
 * saying what it answered. Both halves are clipped by `MAX_HISTORY_CHARS`, and
 * only the last `KEEP_MESSAGES` survive.
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
