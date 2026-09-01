import { describe, expect, it } from 'vitest';
import { squareText } from '@leela/journal';
import { createBot } from '../src/bot';
import { MemoryReportSink } from '../src/store';

/**
 * What one surface writes, another reads.
 *
 * Both halves of each format were tested and neither crossing was. `/save`
 * sends a document and `message:document` reads one — each driven, never the
 * same bytes through both. The mini app builds a square with `squareText` and
 * hands it to the bot, and the bot's reader was only ever given text written by
 * hand in a test file.
 *
 * *A format written on one surface and parsed on another is exactly what this
 * package exists to prevent*, says `@leela/journal` about itself. That is the
 * crossing, and nothing had made it.
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

/** What Telegram delivers when a mini app calls `sendData`. */
const handedOver = (data: string) => ({
  update_id: (updateId += 1),
  message: {
    message_id: updateId,
    date: 0,
    chat: { ...PRIVATE },
    from: { id: 100, is_bot: false, first_name: 'P' },
    web_app_data: { data, button_text: 'Leela' },
  },
});

const asDocument = (bytes: number) => ({
  update_id: (updateId += 1),
  message: {
    message_id: updateId,
    date: 0,
    chat: { ...PRIVATE },
    from: { id: 100, is_bot: false, first_name: 'P' },
    document: {
      file_id: 'f1',
      file_unique_id: 'u1',
      file_name: 'leela-path.json',
      file_size: bytes,
    },
  },
});

interface Wired {
  bot: ReturnType<typeof createBot>;
  sent: Array<{ method: string; payload: Record<string, unknown> }>;
  reports: MemoryReportSink;
  /** What the injected reader will hand back, set when a file is carried. */
  carry: (text: string) => void;
  said: () => string;
}

/** A bot whose file reader is this test rather than the network. */
function wired(): Wired {
  const sent: Array<{ method: string; payload: Record<string, unknown> }> = [];
  const reports = new MemoryReportSink();
  let carried = '';

  const bot = createBot({
    token: '1:TEST',
    botInfo: BOT_INFO,
    log: () => undefined,
    reports,
    now: () => 1_700_000_000_000,
    readFile: async () => carried,
  });

  bot.api.config.use(async (_prev, method, payload) => {
    sent.push({ method, payload: payload as Record<string, unknown> });
    if (method === 'getFile') {
      return {
        ok: true,
        result: { file_id: 'f1', file_unique_id: 'u1', file_path: 'documents/p.json' },
      } as never;
    }
    return { ok: true, result: { message_id: 1 } } as never;
  });

  return {
    bot,
    sent,
    reports,
    carry: (text: string) => {
      carried = text;
    },
    said: () =>
      sent
        .filter((call) => call.method === 'sendMessage')
        .map((call) => String(call.payload.text))
        .join(' '),
  };
}

/** The bytes of the document the bot sent, whatever grammY wrapped them in. */
async function bytesOf(sent: Wired['sent']): Promise<string> {
  const file = sent.filter((call) => call.method === 'sendDocument').at(-1);
  const input = file?.payload.document as { fileData?: unknown } | undefined;
  const data = input?.fileData;

  if (typeof data === 'string') return data;
  if (data instanceof Uint8Array) return new TextDecoder().decode(data);

  throw new Error('the document carried no bytes this test knows how to read');
}

/**
 * Play, writing an account wherever the gate asks for one.
 *
 * Each account says something different, and that is not decoration: two
 * entries with the same plan, the same words and the same moment are **one
 * entry** to this format — `keyOf` is all three — and the clock here is fixed.
 * The first version of this wrote the same sentence every time and then found
 * one account missing after a round trip, which was the format doing exactly
 * what it says and the test not saying anything real.
 */
async function playAndWrite(bot: Wired['bot'], sent: Wired['sent'], turns = 40) {
  await bot.handleUpdate(message('/new') as never);
  await bot.handleUpdate(message('/start') as never);
  await bot.handleUpdate(message('/intention to see what I keep avoiding') as never);

  for (let turn = 0; turn < turns; turn += 1) {
    await bot.handleUpdate(message('/roll') as never);
    if (String(sent.at(-1)?.payload.text ?? '').includes('before you move on')) {
      await bot.handleUpdate(
        message(`/report the account written on turn ${turn}, long enough to count as one`) as never,
      );
    }
  }
}

describe('the file the bot writes is the file the bot reads', () => {
  it('takes back exactly what it saved, and says nothing is new', async () => {
    /**
     * The crossing. `/save` writes a document and `message:document` reads one;
     * this is the same bytes through both, which is the only way to find out
     * that they agree. A path saved on a phone and carried to a chat is the
     * same act with one more surface in it.
     */
    const { bot, sent, reports, carry, said } = wired();
    await playAndWrite(bot, sent);

    const written = reports.reports.length;
    expect(written, 'the game produced a path to save').toBeGreaterThan(0);

    await bot.handleUpdate(message('/save') as never);
    carry(await bytesOf(sent));

    sent.length = 0;
    await bot.handleUpdate(asDocument(400) as never);

    expect(said(), 'its own file is a path').not.toMatch(/not a path/i);
    expect(said()).toMatch(/nothing/i);
    expect(reports.reports, 'and nothing was added twice').toHaveLength(written);
  });

  it('is a path somebody else can bring in, entry for entry', async () => {
    // The other half: the file is worth writing because a second player — or
    // the same player on another device — can read it.
    const mine = wired();
    await playAndWrite(mine.bot, mine.sent);
    await mine.bot.handleUpdate(message('/save') as never);
    const file = await bytesOf(mine.sent);

    const theirs = wired();
    theirs.carry(file);
    await theirs.bot.handleUpdate(asDocument(file.length) as never);

    // As a set, not as a sequence: the clock is fixed here, so every entry
    // carries the same moment and `order` has nothing to sort them by. Which
    // order a store hands them back in is its own business; that all of them
    // arrived is the crossing.
    const words = (sink: MemoryReportSink) => sink.reports.map((entry) => entry.text).sort();

    expect(words(theirs.reports), 'every account crossed').toEqual(words(mine.reports));
  });
});

describe('the square the mini app hands over is the square the bot takes in', () => {
  const HANDED = squareText(
    41,
    'The human plane (jana-loka)',
    'What it asked of me, at some length so that it counts as an account.',
    'to see what I keep avoiding',
  );

  it('lands on the plan it names, with the words it carried', async () => {
    // `squareText` is what the mini app sends: `journal-file.ts` re-exports it
    // as `shareTextFor` and `sendData` carries the result.
    const { bot, reports } = wired();
    await bot.handleUpdate(handedOver(HANDED) as never);

    expect(reports.reports).toHaveLength(1);
    expect(reports.reports[0]?.plan).toBe(41);
    expect(reports.reports[0]?.text).toContain('What it asked of me');
  });

  it('takes the question it carried, where the player has none', async () => {
    const { bot, reports } = wired();
    await bot.handleUpdate(handedOver(HANDED) as never);

    expect(await reports.intention('100')).toBe('to see what I keep avoiding');
  });

  it('never replaces a question the player has already given', async () => {
    /**
     * The rule every surface states and each had to be held to separately:
     * what somebody is playing for is not somebody else's to set. A square
     * pasted from a friend carries *their* question at the bottom.
     */
    const { bot, reports } = wired();
    await bot.handleUpdate(message('/intention to finish what I started long ago') as never);
    await bot.handleUpdate(handedOver(HANDED) as never);

    expect(await reports.intention('100')).toBe('to finish what I started long ago');
  });

  it('reads the same square pasted after /take, not only handed over', async () => {
    // Two doors into one format. The mini app can hand a square over inside
    // Telegram and a player can paste the same text anywhere.
    const { bot, reports } = wired();
    await bot.handleUpdate(message(`/take ${HANDED}`) as never);

    expect(reports.reports[0]?.plan).toBe(41);
  });

  it('refuses what is not a square, by either door', async () => {
    // The guard against a reader that takes anything: both doors must refuse
    // the same text, or one of them is a way in the other closed.
    const handed = wired();
    await handed.bot.handleUpdate(handedOver('just a sentence somebody typed') as never);
    expect(handed.reports.reports).toHaveLength(0);

    const pasted = wired();
    await pasted.bot.handleUpdate(message('/take just a sentence somebody typed') as never);
    expect(pasted.reports.reports).toHaveLength(0);
  });
});
