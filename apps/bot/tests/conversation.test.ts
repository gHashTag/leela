import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
  Guide,
  MAX_HISTORY,
  recordingModel,
  type AskOptions,
  type Message,
  type Reflection,
} from '@leela/ai';
import { MAX_CONVERSATIONS, Conversations, KEEP_MESSAGES } from '../src/conversation';
import { createBot } from '../src/bot';
import { openStorage } from '../src/storage';

/**
 * What the companion has been asked, and what it said.
 *
 * `Guide` has taken a `history` since it was written and `answer()` had never
 * been called by anything: the conversational half of the companion existed
 * and no surface could reach it.
 *
 * The published app has that half and — this was written here as a fact and is
 * false — replays it as two unpaired lists. It does not. The measurement is in
 * the header of `src/conversation.ts`: `updateContextSummary` in the shipped
 * `ChatScreen` has one call site, on a message whose user is always the player,
 * so the branch that fills `contextSummary.assistant` never runs and the model
 * is sent the player's own last five utterances and nothing of its own. Keeping
 * the order paired is still the right decision; the app is a worse warning than
 * the one that used to be quoted here, not a better one.
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

/**
 * Whether the companion is ever told what it has already said.
 *
 * The store above is correct and, for most of this bot's life, nearly unused.
 * `conversations.add` had exactly **one** caller — `/ask`, at the bottom of an
 * optional command — while the route every player is forced down produced a
 * model-written reflection after every account and dropped it on the floor. A
 * player who never typed `/ask` was answered, turn after turn, by something
 * that had never been shown a word of its own; it could contradict what it had
 * told them a minute earlier and nothing in the process knew.
 *
 * So the property is not *`/ask` remembers* and not *these two routes
 * remember*. It is about the shape:
 *
 *   **for every call to the companion after the first, everything the
 *   companion has already said to that player and that the store still holds
 *   is in the history it is handed.**
 *
 * A route added tomorrow that answers a player and forgets it breaks that at
 * the *next* call, whichever route makes it, without being named here.
 *
 * The routes are not a hand-written list either. `companionRoutes` reads
 * `src/bot.ts` as a syntax tree, finds every `bot.command`/`bot.on`
 * registration, and follows the functions each handler calls until it finds
 * `guide.reflect`, `guide.answer` or `guide.about` — which matters, because
 * the reflection is three calls deep
 * (`bot.command('report')` -> `withRoom` -> `respondToReports`)
 * and two other surfaces reach the same place: plain words from a player who
 * owes an account, and the same words carried as a caption. A list written by
 * hand would have said *the report route and the hand-over*, and been wrong
 * about the file the day it was written. Parsed rather than grepped for the
 * usual reason: this file's own prose says `guide.reflect` several times, and a
 * line search would name innocents.
 */

/** A route this session drives, named as `bot.ts` registers it. */
type Route = string;

const BOT_SOURCE = fileURLToPath(new URL('../src/bot.ts', import.meta.url));

/**
 * Every route registered in `bot.ts`, and whether it can reach the companion.
 *
 * Reachability is computed over the call graph inside `createBot`: a function
 * reaches the companion if it calls `guide.reflect`/`guide.answer`/`guide.about`
 * itself or mentions the name of another function in the file that does. Mentioning is a
 * coarse over-approximation of calling — it counts a name passed as a value,
 * which is what `bot.on('message:document', takeInDocument)` does — and coarse
 * in the safe direction: it can only ever claim a route needs driving, never
 * quietly excuse one.
 */
function companionRoutes(): { registered: Route[]; reaching: Route[] } {
  const tree = ts.createSourceFile(
    BOT_SOURCE,
    readFileSync(BOT_SOURCE, 'utf8'),
    ts.ScriptTarget.ES2022,
    true,
  );

  const named = new Map<string, ts.Node>();
  const collect = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name) named.set(node.name.text, node);
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      named.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, collect);
  };
  collect(tree);

  /**
   * `guide.reflect(...)`, `guide.answer(...)` or `guide.about(...)`, anywhere
   * under this node. The whole surface of `Guide` that answers a player, so a
   * fourth verb added to the class without being added here would silently
   * shrink what this file forces — kept in step by the assertion below that
   * the scan still finds routes at all.
   */
  const asksTheCompanion = (node: ts.Node): boolean => {
    let found = false;
    const walk = (inner: ts.Node): void => {
      if (
        ts.isCallExpression(inner) &&
        ts.isPropertyAccessExpression(inner.expression) &&
        ts.isIdentifier(inner.expression.expression) &&
        inner.expression.expression.text === 'guide' &&
        ['reflect', 'answer', 'about'].includes(inner.expression.name.text)
      ) {
        found = true;
      }
      ts.forEachChild(inner, walk);
    };
    walk(node);
    return found;
  };

  const mentions = (node: ts.Node): Set<string> => {
    const names = new Set<string>();
    const walk = (inner: ts.Node): void => {
      if (ts.isIdentifier(inner)) names.add(inner.text);
      ts.forEachChild(inner, walk);
    };
    walk(node);
    return names;
  };

  const reaches = (name: string, seen = new Set<string>()): boolean => {
    if (seen.has(name)) return false;
    seen.add(name);

    const fn = named.get(name);
    if (!fn) return false;
    if (asksTheCompanion(fn)) return true;
    return [...mentions(fn)].some((next) => next !== name && reaches(next, seen));
  };

  const registered: Route[] = [];
  const reaching: Route[] = [];

  const walk = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'bot' &&
      ['command', 'on', 'hears', 'callbackQuery'].includes(node.expression.name.text)
    ) {
      const first = node.arguments[0];
      if (first && ts.isStringLiteral(first)) {
        const route = `${node.expression.name.text}:${first.text}`;
        registered.push(route);

        const handlers = node.arguments.slice(1);
        const hit =
          handlers.some((handler) => asksTheCompanion(handler)) ||
          handlers.some((handler) => [...mentions(handler)].some((name) => reaches(name)));
        if (hit) reaching.push(route);
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(tree);

  return { registered, reaching };
}

/**
 * A companion that answers instantly and remembers being asked.
 *
 * A subclass rather than an object literal because `BotOptions.guide` is typed
 * as the `Guide` class and the class has private state, so nothing else is
 * assignable to it — and a fake that had to be cast into place would stop
 * failing the day the real surface changed. The model handed to `super` is
 * never reached: both entry points are overridden.
 *
 * Every answer is unique, so *which* answer is missing from a history can be
 * named in the failure rather than described.
 */
class RecordingGuide extends Guide {
  readonly calls: Array<{
    kind: 'reflect' | 'answer';
    said: string;
    history: Message[];
    answer: string;
  }> = [];

  constructor() {
    super({ model: recordingModel('never asked'), log: () => undefined });
  }

  override async reflect(report: string, options: AskOptions): Promise<Reflection> {
    return this.remember('reflect', report, options);
  }

  override async answer(question: string, options: AskOptions): Promise<Reflection> {
    return this.remember('answer', question, options);
  }

  private remember(kind: 'reflect' | 'answer', said: string, options: AskOptions): Reflection {
    const answer = `the companion's answer number ${this.calls.length + 1}, and nothing else says so`;
    this.calls.push({ kind, said, history: [...(options.history ?? [])], answer });
    return { text: answer, fromModel: true };
  }
}

const BOT_INFO = {
  id: 1,
  is_bot: true,
  first_name: 'Leela',
  username: 'leela',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business_account: false,
  has_main_web_app: false,
} as never;

const PLAYER = { id: 4242, first_name: 'Ada', is_bot: false };

let sessionUpdate = 0;

/** One player at one table, and every route in the file driven at it. */
async function aSessionWithTheCompanion(chat: number) {
  const storage = openStorage({
    path: join(mkdtempSync(join(tmpdir(), 'leela-heard-')), 'leela.db'),
    log: () => undefined,
  });

  const guide = new RecordingGuide();
  const bot = createBot({
    token: '1:TEST',
    botInfo: BOT_INFO,
    log: () => undefined,
    store: storage.store,
    reports: storage.reports,
    steps: storage.steps,
    guide,
  });

  /** Everything the bot tried to send, so a fixture that stalls can say why. */
  const sent: string[] = [];

  bot.api.config.use(async (_next, method, payload) => {
    if (method === 'sendMessage') sent.push(String((payload as { text?: string }).text ?? ''));
    return { ok: true, result: { message_id: 1 } } as never;
  });

  const message = (body: Record<string, unknown>) => ({
    update_id: (sessionUpdate += 1),
    message: {
      message_id: sessionUpdate,
      date: 1_700_000_000,
      chat: { id: chat, type: 'group' as const, title: 'a table' },
      from: PLAYER,
      ...body,
    },
  });

  const command = (text: string) =>
    message({
      text,
      entities: [{ type: 'bot_command' as const, offset: 0, length: text.split(' ')[0]!.length }],
    });

  const words = (text: string) => message({ text });

  /** The same words a player types, carried under a photograph instead. */
  const caption = (text: string) =>
    message({ photo: [{ file_id: 'p', file_unique_id: 'p', width: 1, height: 1 }], caption: text });

  const handedOver = (data: string) => message({ web_app_data: { data, button_text: '.' } });

  const exercised = new Set<Route>();
  /** Which route produced each call, by call index. Only for failure messages. */
  const madeBy: Route[] = [];

  const tell = async (route: Route, update: unknown): Promise<void> => {
    exercised.add(route);
    const before = guide.calls.length;
    await bot.handleUpdate(update as never);
    for (let call = before; call < guide.calls.length; call += 1) madeBy[call] = route;
  };

  /**
   * Write, throwing until the gate takes it.
   *
   * A single throw is not enough and the die is the reason: a roll may leave
   * the player somewhere that owes no account, and `/report` then refuses. The
   * die is deterministic from the chat id, so this loop settles in the same
   * number of throws everywhere — but it is written as a loop rather than a
   * count because the seed is not this test's to know.
   */
  const untilAnswered = async (route: Route, write: () => unknown): Promise<void> => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const before = guide.calls.length;
      await tell(route, write());
      if (guide.calls.length > before) return;
      await tell('command:roll', command('/roll'));
    }
    throw new Error(
      `nothing this fixture wrote through ${route} was ever answered. ` +
        `The last thing the bot said: ${sent.slice(-4).join(' | ')}`,
    );
  };

  return {
    bot,
    guide,
    storage,
    exercised,
    madeBy,
    command,
    words,
    caption,
    handedOver,
    tell,
    untilAnswered,
  };
}

const ACCOUNT = 'the salt marsh at low tide, and what I would not look at';
const QUESTION = 'why do I keep arriving at the same shoreline';
const IN_WORDS = 'no command this time, only the thing I noticed on the way here';
const UNDER_A_PHOTO = 'the page I wrote it on, photographed because typing it twice is a chore';
const HANDED = ['41. Ignorance (avidya)', '', 'a square written in the app and sent over'].join('\n');

type Session = Awaited<ReturnType<typeof aSessionWithTheCompanion>>;

/**
 * The session the properties below are read from.
 *
 * Played once. Nothing after it writes, so sharing it costs a second rather
 * than a guarantee, and the alternative — replaying a hundred throws for each
 * assertion — is the slowest thing in this package by an order of magnitude.
 */
let played: Session;

beforeAll(async () => {
  played = await aSessionWithTheCompanion(-9001);

  await played.tell('command:new', played.command('/new'));
  await played.tell('command:join', played.command('/join'));
  await played.tell('command:start', played.command('/start'));
  await played.tell('command:intention', played.command(`/intention ${QUESTION}`));
  await played.tell('command:board', played.command('/board'));
  await played.tell('command:plan', played.command('/plan 2 2'));

  // Files an account, is answered, asks a question, files another — the second
  // one in plain words, because that is a route of its own.
  await played.untilAnswered('command:report', () => played.command(`/report ${ACCOUNT}`));
  await played.tell('command:ask', played.command(`/ask ${QUESTION}`));
  await played.untilAnswered('on:message:text', () => played.words(IN_WORDS));
  await played.untilAnswered('on:message:caption', () => played.caption(UNDER_A_PHOTO));
  await played.tell('on:message:web_app_data', played.handedOver(HANDED));

  played.storage.stopPruning?.();
}, 60_000);

describe('what the companion is told it has already said', () => {
  it('is driven through every route in the file that can reach it', () => {
    // The forcing function. A fourth surface that answers a player is red here
    // until somebody drives it, and red in the property below until it keeps
    // what it said.
    const { registered, reaching } = companionRoutes();

    // A scanner that matched nothing would pass the line below over an empty
    // list, which is the failure this repository has already met twice: a check
    // that went blind mid-file and reported an all-clear. `bot.ts` registers
    // two dozen routes; anything near zero means the parse, not the file.
    expect(registered.length, 'the scan read the file at all').toBeGreaterThan(15);
    expect(reaching.length, 'and found routes that reach the companion').toBeGreaterThan(2);
    expect(reaching.filter((route) => !played.exercised.has(route))).toEqual([]);
  });

  it('answers this player through more than one of them', () => {
    // Guards the property below against passing over a session where only
    // `/ask` ever reached the companion, which is the state this pass ends.
    const answered = new Set(played.madeBy.filter(Boolean));

    expect(played.guide.calls.length, 'the companion was asked several times').toBeGreaterThan(3);
    expect(answered.size, 'by more than one route').toBeGreaterThan(1);
    expect(
      [...answered].filter((route) => route !== 'command:ask').length,
      'and by routes a player cannot avoid',
    ).toBeGreaterThan(1);
  });

  it('carries every answer it has already given this player', () => {
    /**
     * The property, over the whole session rather than over two routes.
     *
     * Bounded by the store's own cap and not by a number written here: only
     * the last `KEEP_MESSAGES / 2` exchanges survive, and demanding an answer
     * the store has deliberately dropped would be asserting the opposite of
     * what `KEEP_MESSAGES` is for.
     */
    const kept = Math.floor(KEEP_MESSAGES / 2);

    for (let call = 1; call < played.guide.calls.length; call += 1) {
      const told = played.guide.calls[call]!.history.map((line) => line.content).join('\n');
      const spoken = played.guide.calls
        .slice(0, call)
        .map((earlier) => earlier.answer)
        .slice(-kept);

      for (const answer of spoken) {
        expect(
          told,
          `call ${call + 1} (${played.madeBy[call] ?? 'unknown route'}) was not told: ${answer}`,
        ).toContain(answer);
      }
    }
  });

  it('carries what the player said beside it, so no answer stands unattached', () => {
    // The store's pairing, asserted where it actually matters: on the wire out
    // of a played game rather than on a map filled in by hand.
    for (const call of played.guide.calls) {
      expect(call.history.length % 2, 'whole exchanges only').toBe(0);
      for (let at = 0; at < call.history.length; at += 2) {
        expect(call.history[at]?.role).toBe('user');
        expect(call.history[at + 1]?.role).toBe('assistant');
      }
    }
  });
});

describe('a new game is a new conversation, on every route and not only on /ask', () => {
  /**
   * `clear` is called when a table ends and when one is replaced. That mattered
   * for `/ask` alone while `/ask` was the only writer; now the compulsory route
   * writes too, so a player who ends a game and starts another would otherwise
   * have the companion answering their first account of the new game in the
   * light of the last one — which is the thing `clear`'s own comment forbids.
   */
  it('does not carry the last game’s answers into the next one', async () => {
    const table = await aSessionWithTheCompanion(-9002);

    await table.tell('command:new', table.command('/new'));
    await table.tell('command:start', table.command('/start'));
    await table.tell('command:intention', table.command(`/intention ${QUESTION}`));
    await table.untilAnswered('command:report', () => table.command(`/report ${ACCOUNT}`));

    const before = table.guide.calls.length;
    expect(before, 'something was said in the first game').toBeGreaterThan(0);

    await table.tell('command:end', table.command('/end'));
    await table.tell('command:new', table.command('/new'));
    await table.tell('command:start', table.command('/start'));

    // Asked again because ending a game let go of the answer as well as of the
    // conversation, and `/roll` will not throw for a player who has not said
    // what they are playing for. That refusal is how this test first failed,
    // and it is `letGoOfTheGame` doing exactly what it says.
    await table.tell('command:intention', table.command(`/intention ${QUESTION}`));
    await table.untilAnswered('command:report', () => table.command(`/report ${ACCOUNT} again`));

    table.storage.stopPruning?.();

    const first = table.guide.calls[before];
    expect(first, 'the new game asked the companion something').toBeDefined();
    expect(first!.history, 'and was told nothing of the game that ended').toEqual([]);
  }, 60_000);
});
