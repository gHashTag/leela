import { describe, expect, it } from 'vitest';
import { Guide, fixedModel } from '@leela/ai';
import { createBot } from '../src/bot';
import { MAX_MESSAGE_CHARS, intoMessages } from '../src/render';
import { MemoryReportSink } from '../src/store';

/**
 * An answer too long to be sent is an answer thrown away.
 *
 * The companion's reply went to Telegram whole. The prompt asks it to be brief
 * and it usually is — but *usually* is not a limit, and a message over the
 * transport's cap is refused. A refused reply reaches the player as *something
 * went wrong, try again in a moment*: an error about an answer that was written
 * and then dropped, and the retry writes it again.
 *
 * Found by handing a stub model a nine-thousand-character answer and watching
 * what the transport was asked to send.
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
    entities: text.startsWith('/')
      ? [{ type: 'bot_command' as const, offset: 0, length: text.split(' ')[0].length }]
      : undefined,
  },
});

describe('cutting a text into messages', () => {
  /**
   * The shape, over texts built to be awkward, rather than over one long
   * string: whatever goes in, every piece fits and nothing is lost.
   */
  const awkward = [
    ['paragraphs', Array.from({ length: 60 }, (_, i) => `Paragraph ${i}. `.repeat(20)).join('\n\n')],
    ['lines with no blank between', Array.from({ length: 900 }, (_, i) => `line ${i}`).join('\n')],
    ['one wall of words', 'word '.repeat(3000)],
    ['no break anywhere at all', 'x'.repeat(9000)],
    ['exactly the limit', 'y'.repeat(MAX_MESSAGE_CHARS)],
    ['one over the limit', 'z'.repeat(MAX_MESSAGE_CHARS + 1)],
  ] as const;

  it.each(awkward)('%s: every piece fits', (_name, text) => {
    for (const piece of intoMessages(text)) {
      expect(piece.length, 'a piece the transport would refuse').toBeLessThanOrEqual(
        MAX_MESSAGE_CHARS,
      );
    }
  });

  it.each(awkward)('%s: nothing is lost', (_name, text) => {
    // Compared without whitespace at all: a break is where a message ends, so
    // which side of it a newline lands on is not the question. Losing a
    // paragraph would be worse than the defect this fixes.
    const together = intoMessages(text).join('').replace(/\s/g, '');
    expect(together).toBe(text.replace(/\s/g, ''));
  });

  it('always makes progress, however unbreakable the text', () => {
    // The loop this could have been: a break found at position zero cuts
    // nothing off and leaves the rest exactly as long as it was.
    const pieces = intoMessages(`\n\n${'x'.repeat(9000)}`);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.every((piece) => piece.length > 0)).toBe(true);
  });

  it('leaves a short text alone, and says nothing about nothing', () => {
    expect(intoMessages('a short answer')).toEqual(['a short answer']);
    expect(intoMessages('')).toEqual([]);
  });

  it('breaks at a paragraph when there is one in reach', () => {
    // Long enough that the whole does not fit, or there is nothing to break.
    const first = 'a'.repeat(MAX_MESSAGE_CHARS - 5);
    const pieces = intoMessages(`${first}\n\nthe second paragraph`);

    expect(pieces[0]).toBe(first);
    expect(pieces[1]).toBe('the second paragraph');
  });
});

describe('what the transport is asked to send', () => {
  it('sends a long answer as messages that fit, not as one that does not', async () => {
    const sent: Array<{ method: string; payload: Record<string, unknown> }> = [];
    const guide = new Guide({ model: fixedModel('x'.repeat(9000)), log: () => undefined });
    const bot = createBot({
      token: '1:TEST',
      botInfo: BOT_INFO,
      log: () => undefined,
      guide,
      reports: new MemoryReportSink(),
      now: () => 1_700_000_000_000,
    });

    bot.api.config.use(async (_prev, method, payload) => {
      sent.push({ method, payload: payload as Record<string, unknown> });
      return { ok: true, result: { message_id: 1 } } as never;
    });

    await bot.handleUpdate(message('/new') as never);
    await bot.handleUpdate(message('/start') as never);
    await bot.handleUpdate(message('/intention to see what I keep avoiding') as never);

    // On the board, so the question is about a square they are standing on.
    for (let roll = 0; roll < 20; roll += 1) {
      await bot.handleUpdate(message('/roll') as never);
      const said = String(sent.at(-1)?.payload.text ?? '');
      if (said.includes('before you move on')) break;
    }

    await bot.handleUpdate(message('/ask what does this ask of me') as never);

    const long = sent.filter(
      (call) => call.method === 'sendMessage' && String(call.payload.text ?? '').startsWith('xxx'),
    );

    expect(long.length, 'the answer arrived at all').toBeGreaterThan(1);
    for (const call of long) {
      expect(String(call.payload.text).length).toBeLessThanOrEqual(MAX_MESSAGE_CHARS);
    }
  });

  it('puts the buttons under the end of a reply, not under every piece of it', async () => {
    const sent: Array<{ method: string; payload: Record<string, unknown> }> = [];
    const bot = createBot({
      token: '1:TEST',
      botInfo: BOT_INFO,
      log: () => undefined,
      reports: new MemoryReportSink(),
      now: () => 1_700_000_000_000,
    });

    bot.api.config.use(async (_prev, method, payload) => {
      sent.push({ method, payload: payload as Record<string, unknown> });
      return { ok: true, result: { message_id: 1 } } as never;
    });

    await bot.handleUpdate(message('/new') as never);

    // Every reply the bot sends: a keyboard repeated across the pieces of one
    // reply would be three keyboards in the chat.
    const withButtons = sent.filter((call) => call.payload.reply_markup !== undefined);
    expect(withButtons.length).toBeLessThanOrEqual(sent.length);
  });
});
