import { describe, expect, it } from 'vitest';
import { MAX_HISTORY } from '@leela/ai';
import { Conversations, KEEP_MESSAGES } from '../src/conversation';

/**
 * What the companion has been asked, and what it said.
 *
 * `Guide` has taken a `history` since it was written and `answer()` had never
 * been called by anything: the conversational half of the companion existed
 * and no surface could reach it.
 *
 * The published app has that half and replays it wrongly. `ChatScreen` keeps
 * two lists — the last five questions and the last five answers — and sends
 * all the questions followed by all the answers, so the model sees five
 * questions in a row and then five answers, with nothing saying which answered
 * which. Keeping the order costs nothing and is the only reason to send a
 * history at all.
 */

describe('the order a conversation is replayed in', () => {
  it('is the order it happened in', () => {
    // The defect in the app, stated as the rule it breaks.
    const talk = new Conversations();
    talk.add('a', 'first question', 'first answer');
    talk.add('a', 'second question', 'second answer');

    expect(talk.of('a')).toEqual([
      { role: 'user', content: 'first question' },
      { role: 'assistant', content: 'first answer' },
      { role: 'user', content: 'second question' },
      { role: 'assistant', content: 'second answer' },
    ]);
  });

  it('never carries a question without the answer it produced', () => {
    // The pairing is the whole point: an odd number of messages means one of
    // them is unanswered, and the model is being asked to guess which.
    const talk = new Conversations();
    for (let turn = 0; turn < 12; turn += 1) {
      talk.add('a', `q${turn}`, `a${turn}`);

      const kept = talk.of('a');
      expect(kept.length % 2, `after ${turn + 1} exchanges`).toBe(0);
      for (let i = 0; i < kept.length; i += 2) {
        expect(kept[i]?.role).toBe('user');
        expect(kept[i + 1]?.role).toBe('assistant');
      }
    }
  });

  it('keeps the most recent exchanges and drops the oldest', () => {
    const talk = new Conversations();
    for (let turn = 0; turn < 10; turn += 1) talk.add('a', `q${turn}`, `a${turn}`);

    const kept = talk.of('a');
    expect(kept).toHaveLength(KEEP_MESSAGES);
    expect(kept.at(-2)?.content).toBe('q9');
    expect(kept.at(0)?.content).not.toBe('q0');
  });

  it('carries no more than the prompt will use', () => {
    // Sending more than `recentHistory` keeps is paying for tokens that are
    // dropped on arrival.
    expect(KEEP_MESSAGES).toBeLessThanOrEqual(MAX_HISTORY);
  });

  it('is one conversation per player', () => {
    // A chat has several people in it, and one player's questions are not
    // context for another's.
    const talk = new Conversations();
    talk.add('a', 'mine', 'yours');

    expect(talk.of('b')).toEqual([]);
  });

  it('is nothing for a player who has not asked', () => {
    expect(new Conversations().of('nobody')).toEqual([]);
  });

  it('can be forgotten, because a new game is a new conversation', () => {
    const talk = new Conversations();
    talk.add('a', 'q', 'a');
    talk.clear('a');

    expect(talk.of('a')).toEqual([]);
  });
});
