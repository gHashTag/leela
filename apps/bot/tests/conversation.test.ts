import { describe, expect, it } from 'vitest';
import { MAX_HISTORY } from '@leela/ai';
import { MAX_CONVERSATIONS, Conversations, KEEP_MESSAGES } from '../src/conversation';

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

describe('what a long-running process holds on to', () => {
  /**
   * Each conversation was bounded at six messages and the number of them was
   * not, so a process that is never restarted keeps one for every player who
   * has ever asked anything. This repository has already measured that argument
   * and found it false once — *a bot that is never restarted is not
   * accumulating tables either*, written above the finished games that had
   * piled up for twelve weeks before anybody looked.
   *
   * And `clear` had no caller. Its own comment says *a new game is a new
   * conversation*; nothing started one. So the map only ever grew, and a player
   * who ended a table and opened another was still answered in the light of the
   * last one.
   *
   * The assertions are about the shape rather than the number: whatever the cap
   * is, going past it leaves the most recent conversations and drops the
   * stalest, and nothing is lost that was spoken to since.
   */
  it('holds no more than it says it will', () => {
    const conversations = new Conversations();

    for (let player = 0; player < MAX_CONVERSATIONS + 500; player += 1) {
      conversations.add(`p${player}`, 'what does this square ask', 'it asks this');
    }

    expect(conversations.size).toBe(MAX_CONVERSATIONS);
  });

  it('drops the stalest rather than the newest', () => {
    const conversations = new Conversations();

    conversations.add('first', 'asked long ago', 'answered long ago');
    for (let player = 0; player < MAX_CONVERSATIONS; player += 1) {
      conversations.add(`p${player}`, 'later', 'later');
    }

    expect(conversations.of('first'), 'the oldest went').toEqual([]);
    expect(conversations.of(`p${MAX_CONVERSATIONS - 1}`).length, 'the newest stayed').toBe(2);
  });

  it('keeps a player who has spoken since, however early they arrived', () => {
    // Eviction by *last spoken to*, not by first seen. A player in a long game
    // is the one this must never drop.
    const conversations = new Conversations();

    conversations.add('early', 'first question', 'first answer');
    for (let player = 0; player < MAX_CONVERSATIONS - 1; player += 1) {
      conversations.add(`p${player}`, 'later', 'later');
    }
    conversations.add('early', 'still here', 'still answered');
    conversations.add('newcomer', 'and one more', 'pushing it over');

    expect(conversations.of('early').length, 'spoken to since, so kept').toBe(4);
  });
});
