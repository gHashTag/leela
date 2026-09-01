import { describe, expect, it } from 'vitest';
import { MAX_INTENTION_CHARS, MIN_INTENTION_CHARS, isIntention } from '@leela/journal';
import { messageFor } from '@leela/content';
import { createBot } from '../src/bot';
import { MemoryReportSink } from '../src/store';

/**
 * Which end of the rule was broken.
 *
 * `isIntention` refuses a question shorter than two characters and one longer
 * than eight hundred, and this bot answered every refusal with *a little more
 * than that — two characters at least*. So somebody who had just written a
 * considered question of nine hundred characters was told to write more: the
 * wrong cause, in the one dialog the game will not start without.
 *
 * The same shape as the over-long report one field along. The mini app's box is
 * `maxlength="800"` and the phone's is `maxLength={MAX_INTENTION_CHARS}`, so on
 * those two the boundary is met while typing rather than discovered. A chat has
 * no box to stop.
 *
 * Found by sending one and reading the answer.
 */

const BOT_INFO = {
  id: 1,
  is_bot: true as const,
  first_name: 'Leela',
  username: 'leela_test_bot',
  can_join_groups: true as const,
  can_read_all_group_messages: false as const,
  supports_inline_queries: false as const,
  can_connect_to_business: false as const,
  has_main_web_app: false as const,
  has_topics_enabled: false as const,
  allows_users_to_create_topics: false as const,
  can_manage_bots: false as const,
  supports_join_request_queries: false as const,
};

const PRIVATE = { id: 777, type: 'private' as const };
let updateId = 0;

const message = (text: string) => ({
  update_id: (updateId += 1),
  message: {
    message_id: updateId,
    date: 0,
    chat: { ...PRIVATE },
    from: { id: 100, is_bot: false, first_name: 'P' },
    text,
    entities: [{ type: 'bot_command' as const, offset: 0, length: text.split(' ')[0].length }],
  },
});

/** What the bot says to one `/intention`, and what it holds afterwards. */
async function asking(text: string) {
  const sent: Array<Record<string, unknown>> = [];
  const reports = new MemoryReportSink();
  const bot = createBot({
    token: '1:TEST',
    botInfo: BOT_INFO,
    log: () => undefined,
    reports,
    now: () => 1_700_000_000_000,
  });

  bot.api.config.use(async (_prev, method, payload) => {
    if (method === 'sendMessage') sent.push(payload as Record<string, unknown>);
    return { ok: true, result: { message_id: 1 } } as never;
  });

  await bot.handleUpdate(message('/new') as never);
  await bot.handleUpdate(message('/start') as never);
  sent.length = 0;
  await bot.handleUpdate(message(`/intention ${text}`) as never);

  return { said: sent.map((payload) => String(payload.text)).join(' '), reports };
}

describe('a question the game cannot hold', () => {
  it('says it is too long, and by how much, rather than too short', async () => {
    const over = 137;
    const { said, reports } = await asking('я хочу понять '.repeat(1).padEnd(MAX_INTENTION_CHARS + over, 'я'));

    expect(said).toContain(
      messageFor('en', 'intention.tooLong', { count: over, max: MAX_INTENTION_CHARS }),
    );
    expect(said, 'and not the opposite').not.toContain(messageFor('en', 'intention.tooShort'));
    expect(await reports.intention('100'), 'nothing is held').toBeNull();
  });

  it('still says too short at the other end', async () => {
    // The half that was right. Naming one bound must not un-name the other.
    const { said } = await asking('x');

    expect(said).toContain(messageFor('en', 'intention.tooShort'));
    expect(said).not.toContain('over');
  });

  it('holds a question at either bound exactly', async () => {
    /**
     * The boundaries themselves, which is where a rule written twice comes
     * apart: `isIntention` is the one reading, and the sentence chosen here
     * must agree with it about what it refused.
     */
    for (const length of [MIN_INTENTION_CHARS, MAX_INTENTION_CHARS]) {
      const text = 'x'.repeat(length);
      expect(isIntention(text), `${length}`).toBe(true);

      const { reports } = await asking(text);
      expect(await reports.intention('100'), `${length}`).toBe(text);
    }
  });

  it('names the end it refused, whatever the length', async () => {
    // The shape rather than two examples: every refusal names the bound it
    // broke, and only that one.
    for (const length of [1, MAX_INTENTION_CHARS + 1, MAX_INTENTION_CHARS + 500]) {
      const { said } = await asking('x'.repeat(length));
      const tooLong = length > MAX_INTENTION_CHARS;

      expect(
        said.includes(
          messageFor('en', 'intention.tooLong', {
            count: length - MAX_INTENTION_CHARS,
            max: MAX_INTENTION_CHARS,
          }),
        ),
        `${length} long`,
      ).toBe(tooLong);
      expect(said.includes(messageFor('en', 'intention.tooShort')), `${length} short`).toBe(!tooLong);
    }
  });

  it('refuses rather than cutting it, unlike a report', async () => {
    /**
     * The format keeps an over-long report by cutting the end off it and drops
     * an over-long question **whole** — so a question is refused at the door.
     * A question cut mid-word is a different question, and this one is the
     * frame every report is written inside.
     */
    const { reports } = await asking('x'.repeat(MAX_INTENTION_CHARS + 50));
    expect(await reports.intention('100')).toBeNull();
  });
});
