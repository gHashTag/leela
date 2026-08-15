/**
 * A handler for an update nothing could send.
 *
 * `bot.ts` registers `bot.on('message:web_app_data')`, and behind it sit
 * `decideSquare`, square-keeping, intention adoption and the companion's
 * reflection — the single bridge between the mini app and the only surface
 * holding a model key. Nothing in this repository could cause that update to
 * arrive.
 *
 * **Measured**, before this test existed, by driving a real `createBot` through
 * eighteen commands in a group and in a private chat with an api-transformer
 * capturing every outgoing call: 37 API calls, 4 carrying `reply_markup`, all
 * four `inline_keyboard`, **zero reply keyboards and zero `web_app` buttons**.
 * Telegram delivers `web_app_data` only from a Web App launched by a
 * *reply-keyboard* button, so the handler and everything behind it were
 * unreachable code that twelve test files nevertheless exercised — by
 * synthesising the update by hand, which proves the handler works and can never
 * prove that it can be reached.
 *
 * **An inline `web_app` button does not count, and that is the trap.** grammY
 * 1.45 has `.webApp()` on both `Keyboard` and `InlineKeyboard`, so nothing in
 * the type system distinguishes them; the difference is one sentence in
 * `Keyboard.webApp`'s doc-comment — *the Web App will be able to send a
 * "web_app_data" service message* — which `InlineKeyboard.webApp`'s does not
 * have. The donor bot fell into exactly this: `leela-chakra-bot`'s step and
 * report handlers both carry `{ text: 'Gameboard', web_app: … }` inside an
 * `inline_keyboard`, which opens the board and can never answer with anything.
 * So the predicate below asks for the `keyboard` form specifically, and the
 * first test here proves it refuses the inline one.
 *
 * The rule this file asserts is a shape rather than a list: **for every inbound
 * update kind `bot.ts` registers that can only arise from markup the bot itself
 * sent, the bot must actually send markup that can produce it.** Two such kinds
 * exist today — `callback_query:data`, which needs an `inline_keyboard` with
 * `callback_data`, and `message:web_app_data`, which needs a reply `keyboard`
 * with `web_app`. The first passed before this change and the second did not,
 * which is what makes the passing one evidence rather than decoration.
 *
 * Written this way it also fails on the *next* handler registered for an update
 * no surface can send, and on a new `bot.on` filter nobody has classified —
 * see `PLAYER_BORNE`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import type { Chat, Update, UserFromGetMe } from 'grammy/types';
import { DEFAULT_MINI_APP_URL, createBot, miniAppUrl } from '../src/bot';
import { MemoryReportSink } from '../src/store';

const BOT_SOURCE = fileURLToPath(new URL('../src/bot.ts', import.meta.url));

/** A Telegram `reply_markup`, as it goes on the wire. */
interface Markup {
  inline_keyboard?: Array<Array<Record<string, unknown>>>;
  keyboard?: Array<Array<Record<string, unknown>>>;
  resize_keyboard?: boolean;
}

/** Every button in a markup, whichever kind of keyboard it is. */
function buttonsOf(markup: Markup): Array<Record<string, unknown>> {
  return [...(markup.inline_keyboard ?? []), ...(markup.keyboard ?? [])].flat();
}

/**
 * The inbound update kinds that only the bot's own markup can produce, and what
 * has to be sent for each to be possible.
 *
 * Keyed by the filter string `bot.ts` registers, so a route that is renamed
 * stops matching and is caught by `PLAYER_BORNE` below rather than silently
 * excused.
 */
const MARKUP_BORNE: Record<string, { needs: string; sent(markup: Markup): boolean }> = {
  'callback_query:data': {
    needs: 'an inline_keyboard button carrying callback_data',
    sent: (markup) =>
      (markup.inline_keyboard ?? []).flat().some((button) => 'callback_data' in button),
  },
  'message:web_app_data': {
    needs: 'a reply keyboard button carrying web_app — an inline one cannot sendData',
    sent: (markup) => (markup.keyboard ?? []).flat().some((button) => 'web_app' in button),
  },
};

/**
 * The update kinds a player can produce unaided — by typing, by sending a file,
 * by Telegram itself upgrading a group.
 *
 * Here so that a `bot.on` filter belonging to neither table fails this test
 * instead of passing it. A new inbound surface is exactly the moment somebody
 * has to answer *and what causes one of these to arrive*, and this repository
 * has now watched that question go unasked once.
 */
const PLAYER_BORNE = new Set([
  'message::bot_command',
  'message:caption',
  'message:document',
  'message:text',
  'message:migrate_from_chat_id',
  'message:migrate_to_chat_id',
]);

/**
 * Every `bot.on(...)` filter registered in `bot.ts`, read from the file.
 *
 * Parsed rather than grepped for the reason `conversation.test.ts` gives about
 * the same file: this test's own prose says `message:web_app_data` a dozen
 * times, and a line search would name innocents. `bot.command` is deliberately
 * not collected — a command is produced by typing, and the question here is
 * only about updates that need a surface.
 */
function registeredUpdateKinds(): string[] {
  const tree = ts.createSourceFile(
    BOT_SOURCE,
    readFileSync(BOT_SOURCE, 'utf8'),
    ts.ScriptTarget.ES2022,
    true,
  );

  const kinds: string[] = [];
  const walk = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'bot' &&
      ['on', 'callbackQuery'].includes(node.expression.name.text)
    ) {
      const first = node.arguments[0];
      if (first && ts.isStringLiteral(first)) kinds.push(first.text);
    }
    ts.forEachChild(node, walk);
  };
  walk(tree);

  return kinds;
}

const BOT_INFO: UserFromGetMe = {
  id: 1,
  is_bot: true,
  first_name: 'Leela',
  username: 'leela_probe_bot',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
  can_manage_bots: false,
  supports_join_request_queries: false,
};

const GROUP: Chat = { id: -100, type: 'group', title: 'A table' };
const PRIVATE: Chat = { id: 777, type: 'private', first_name: 'P' };

/**
 * Drive the whole command surface and keep every outgoing call.
 *
 * A real `createBot` with a real `handleUpdate`, not a stub: the thing under
 * test is what this bot *sends*, and a fake transport that answered questions
 * about keyboards would be answering them about itself. The api-transformer is
 * the last thing before the network, so what it sees is what Telegram would
 * have seen.
 */
async function surfaceOffered(): Promise<{
  markups: Markup[];
  calls: number;
  unhandled: string[];
}> {
  const sent: Array<{ method: string; payload: Record<string, unknown> }> = [];
  const unhandled: string[] = [];

  const bot = createBot({
    token: '1:TEST',
    botInfo: BOT_INFO,
    reports: new MemoryReportSink(),
    now: () => 1_700_000_000_000,
    readFile: async () => '',
    log: (message) => {
      if (message.startsWith('[bot] unhandled:')) unhandled.push(message);
    },
  });

  bot.api.config.use(async (_prev, method, payload) => {
    sent.push({ method, payload: payload as Record<string, unknown> });
    return { ok: true, result: { message_id: sent.length } } as never;
  });

  let id = 0;
  const typed = (chat: Chat, from: number, text: string): Update => {
    id += 1;
    return {
      update_id: id,
      message: {
        message_id: id,
        date: 0,
        chat,
        from: { id: from, is_bot: false, first_name: `P${from}` },
        text,
        entities: text.startsWith('/')
          ? [{ type: 'bot_command' as const, offset: 0, length: text.split(' ')[0].length }]
          : undefined,
      },
    } as Update;
  };

  const script = [
    '/start',
    '/help',
    '/new',
    '/join',
    '/intention I am playing to see this through',
    '/start',
    '/roll',
    '/roll',
    `/report ${'x'.repeat(120)}`,
    '/board',
    '/plan',
    '/path',
    '/returns',
    '/ask what is this square',
    '/save',
    '/rules',
    '/take',
    '/end',
  ];

  for (const line of script) {
    for (const chat of [GROUP, PRIVATE]) {
      await bot.handleUpdate(typed(chat, 100, line));
    }
  }

  // A second player at the table, so the group's turn-taking is exercised
  // rather than one seat rolling against itself.
  for (const line of ['/join', '/roll', `/report ${'y'.repeat(120)}`]) {
    await bot.handleUpdate(typed(GROUP, 101, line));
  }

  const markups = sent
    .map((call) => call.payload.reply_markup as Markup | undefined)
    .filter((markup): markup is Markup => Boolean(markup));

  return { markups, calls: sent.length, unhandled };
}

describe('a launch that can answer', () => {
  it('does not accept an inline web_app button as a launch that can answer', () => {
    const inline: Markup = {
      inline_keyboard: [[{ text: '🗺 Board', web_app: { url: DEFAULT_MINI_APP_URL } }]],
    };
    const reply: Markup = {
      keyboard: [[{ text: '🗺 Board', web_app: { url: DEFAULT_MINI_APP_URL } }]],
      resize_keyboard: true,
    };

    const predicate = MARKUP_BORNE['message:web_app_data'];

    // The donor's own markup, which opens the board and can never answer.
    expect(predicate.sent(inline)).toBe(false);
    expect(predicate.sent(reply)).toBe(true);
  });

  it('sends markup that can produce every inbound kind only markup can produce', async () => {
    const kinds = registeredUpdateKinds();

    // The scan read the file at all. `bot.ts` registers eight `bot.on` filters;
    // a scanner that went blind mid-file would otherwise report an all-clear,
    // which is a fault this repository has had twice.
    expect(kinds.length, 'the scan found bot.on registrations').toBeGreaterThanOrEqual(6);

    const borne = kinds.filter((kind) => kind in MARKUP_BORNE);
    expect(borne, 'there is something to check').not.toHaveLength(0);

    const { markups, calls, unhandled } = await surfaceOffered();

    // The drive happened, and did not fall through an error boundary into a
    // handful of "something went wrong" replies that carry no markup at all.
    expect(calls, 'the command surface was driven').toBeGreaterThan(30);
    expect(unhandled, 'nothing failed on the way through').toEqual([]);

    for (const kind of borne) {
      const { needs, sent } = MARKUP_BORNE[kind];
      expect(
        markups.some(sent),
        `${kind} can only arrive from markup this bot sends, and nothing it sent could produce it — it needs ${needs}`,
      ).toBe(true);
    }
  });

  it('has an answer for every inbound kind it registers', () => {
    for (const kind of registeredUpdateKinds()) {
      expect(
        PLAYER_BORNE.has(kind) || kind in MARKUP_BORNE,
        `bot.ts registers ${kind} and nothing here says what makes one arrive — ` +
          'add it to PLAYER_BORNE if a player can send it unaided, or to MARKUP_BORNE ' +
          'with the markup that produces it',
      ).toBe(true);
    }
  });

  it('offers the launch as a resized reply keyboard, over https', async () => {
    const { markups } = await surfaceOffered();

    const launches = markups.filter((markup) =>
      (markup.keyboard ?? []).flat().some((button) => 'web_app' in button),
    );

    expect(launches.length, 'the board was offered').toBeGreaterThan(0);

    for (const markup of launches) {
      // Full height for one button is half a phone screen.
      expect(markup.resize_keyboard).toBe(true);

      for (const button of buttonsOf(markup)) {
        const url = (button.web_app as { url?: string } | undefined)?.url;

        // Telegram refuses a non-https Web App URL by failing the whole
        // sendMessage, so this is the difference between a dead button and a
        // bot that stops answering.
        expect(url?.startsWith('https://'), `${String(url)} is not https`).toBe(true);

        // Labelled in the table's language, like every other button.
        expect(String(button.text ?? '')).not.toBe('');
      }
    }
  });

  it('takes the launch URL from the environment, and refuses one Telegram would', () => {
    expect(miniAppUrl({})).toBe(DEFAULT_MINI_APP_URL);
    expect(miniAppUrl({ LEELA_MINIAPP_URL: 'https://staging.example/leela/' })).toBe(
      'https://staging.example/leela/',
    );

    // Not a dead button: a `web_app` with an http URL fails the send.
    expect(miniAppUrl({ LEELA_MINIAPP_URL: 'http://staging.example/leela/' })).toBe(
      DEFAULT_MINI_APP_URL,
    );
    expect(miniAppUrl({ LEELA_MINIAPP_URL: '   ' })).toBe(DEFAULT_MINI_APP_URL);
  });
});
