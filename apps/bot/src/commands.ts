/**
 * What the bot does, with no Telegram in sight.
 *
 * Every command is a pure function from (state, input) to (state, replies).
 * Nothing here reads a socket, a database or a clock — those are passed in.
 * That is what makes a group game testable without a bot token.
 *
 * The transport layer in `bot.ts` is thin on purpose: it turns a Telegram
 * update into a call here, and the replies back into messages.
 */

import {
  MAX_SEATS,
  SessionError,
  WIN_LOKA,
  advance,
  canCurrentPlayerRoll,
  createSession,
  currentPlayer,
  formatWait,
  hasWon,
  isReport,
  isSessionOver,
  needsSixToEnter,
  rollerFor,
  ruleSetById,
  seededRoller,
  standings,
  submitReport,
  type MoveEvent,
  type RuleSet,
  type Session,
  isWaitingToEnter,
  owesReport,
} from '@leela/engine';
import { revisited } from '@leela/journal';
import { bookFor, messageFor, planFor, resolveLanguage, type Language } from '@leela/content';

/** A table, plus the bits the bot needs that the engine does not care about. */
export interface Room {
  /** Telegram chat id, as a string. */
  chatId: string;
  session: Session;
  /** Seed the room's die was created with, so a game can be replayed. */
  seed: number;
  /** Rolls already taken, used to advance the deterministic die. */
  rollsTaken: number;
  /** Language the room is played in. */
  language: Language;
  /** True once the host has closed the table and play has begun. */
  started: boolean;
  /** Display names by player id, for messages. */
  names: Record<string, string>;
}

/**
 * A button under a message.
 *
 * Described as data, not as a Telegram keyboard, so the command layer stays
 * transport-free and a button can be asserted in a test.
 */
export interface Button {
  label: string;
  /** The command this button stands for, without its slash. */
  action: 'roll' | 'board' | 'plan' | 'join' | 'start' | 'help' | 'new';
}

export interface Reply {
  /** What to send. */
  text: string;
  /**
   * Whether this is addressed to the whole room. The transport may use it to
   * decide between a group message and a direct one.
   */
  broadcast: boolean;
  /** Buttons to offer alongside. Absent when there are none. */
  buttons?: Button[];
  /**
   * True when `text` is already HTML and must be sent as-is.
   *
   * Everything else is escaped by the transport. Without this distinction a
   * help line reading `/report <text>` is parsed as a tag and the message
   * fails to send — which is exactly what happened.
   */
  html?: boolean;
}

/**
 * Something the world outside has to do.
 *
 * Commands stay pure by describing the write rather than performing it. The
 * transport applies effects after the room is saved, so a failure to record a
 * report cannot leave the board ahead of the writing.
 */
export type Effect =
  | {
      kind: 'report';
      userId: string;
      /** The plan the report is about — the one the player is standing on. */
      plan: number;
      text: string;
    }
  | {
      /**
       * A move, for the log.
       *
       * `game_steps` and `gameStepRow` both existed and nothing wrote a row:
       * the schema promised a readable history and never kept one.
       */
      kind: 'move';
      userId: string;
      event: MoveEvent;
      ruleset: RuleSet;
    };

export interface CommandResult {
  room: Room | null;
  replies: Reply[];
  /** Writes for the transport to apply. Absent when there are none. */
  effects?: Effect[];
}

function say(text: string, broadcast = true, buttons?: Button[]): Reply {
  return buttons?.length ? { text, broadcast, buttons } : { text, broadcast };
}

/**
 * The buttons that make sense while a game is running.
 *
 * A function of the language rather than a constant: a button is a sentence
 * too, and a Russian table with an English `🎲 Roll` under it is the same
 * defect as an English reply, only harder to notice.
 */
export function playingButtons(language: Language): Button[] {
  return [
    { label: messageFor(language, 'button.roll'), action: 'roll' },
    { label: messageFor(language, 'button.plan'), action: 'plan' },
    { label: messageFor(language, 'button.board'), action: 'board' },
  ];
}

/** The buttons that make sense while a table is filling up. */
export function waitingButtons(language: Language): Button[] {
  return [
    { label: messageFor(language, 'button.join'), action: 'join' },
    { label: messageFor(language, 'button.start'), action: 'start' },
  ];
}

/**
 * The buttons this table would actually accept right now.
 *
 * A keyboard is the bot's drawing of a control, and the mini app spent three
 * passes learning what a drawing is worth: a control offered where the act
 * refuses is a promise the game does not keep. Offering `🎲 Roll` while a
 * report is owed is the same sentence as a disabled button that still works,
 * read backwards — the tap is taken and answered with a no.
 *
 * What is left in its place is what the player needs in order to say yes:
 * the plan they are standing on, which is the thing they have to write about.
 *
 * A keyboard belongs to a message and everybody in the chat sees the same one,
 * so it is drawn for the seat holding the turn — which is who the message
 * announcing that turn is about.
 */
export function buttonsFor(room: Room): Button[] {
  if (!room.started) return waitingButtons(room.language);

  const holder = currentPlayer(room.session);
  const owes = owesReport(holder.state, room.session.rules) && !holder.reportSubmitted;

  return playingButtons(room.language).filter((button) => button.action !== 'roll' || !owes);
}

/** Whoever is being addressed, by name where we have one. */
function nameOf(room: Room, id: string): string {
  return room.names[id] ?? id;
}

// --- opening a table ---------------------------------------------------------

/**
 * `/new` — open a table.
 *
 * @param seed  The die's seed. Passed in rather than generated so a room is
 *              reproducible and tests are deterministic.
 */
export function openRoom(
  chatId: string,
  host: { id: string; name: string },
  seed: number,
  options: { language?: string; ruleset?: RuleSet['id'] } = {},
): CommandResult {
  const rules = ruleSetById(options.ruleset ?? 'classic');
  const language = resolveLanguage(options.language);

  const room: Room = {
    chatId,
    session: createSession(chatId, [{ id: host.id, name: host.name }], rules),
    seed,
    rollsTaken: 0,
    language,
    started: false,
    names: { [host.id]: host.name },
  };

  return {
    room,
    replies: [
      say(
        messageFor(language, 'table.opened', { host: host.name, seats: MAX_SEATS }),
        true,
        waitingButtons(language),
      ),
    ],
  };
}

/** `/join` — take a seat, until the table is full or play has begun. */
export function join(room: Room, player: { id: string; name: string }): CommandResult {
  if (room.started) {
    return { room, replies: [say(messageFor(room.language, 'join.started'), false)] };
  }

  if (room.session.players.some((p) => p.id === player.id)) {
    return { room, replies: [say(messageFor(room.language, 'join.already'), false)] };
  }

  if (room.session.players.length >= MAX_SEATS) {
    return {
      room,
      replies: [say(messageFor(room.language, 'join.full', { seats: MAX_SEATS }), false)],
    };
  }

  const seated = [
    ...room.session.players.map((p) => ({ id: p.id, name: p.name })),
    { id: player.id, name: player.name },
  ];

  const next: Room = {
    ...room,
    session: createSession(room.chatId, seated, room.session.rules),
    names: { ...room.names, [player.id]: player.name },
  };

  return {
    room: next,
    replies: [
      say(
        messageFor(room.language, 'join.took', { name: player.name, count: seated.length }),
        true,
        waitingButtons(room.language),
      ),
    ],
  };
}

/** `/start` — close the table and begin. Only the host may. */
export function start(room: Room, byPlayerId: string): CommandResult {
  if (room.started) {
    return { room, replies: [say(messageFor(room.language, 'start.already'), false)] };
  }

  // Seat zero opened the table. A table with nobody in it is not one this
  // player may start either, so the two answers are the same.
  if (room.session.players[0]?.id !== byPlayerId) {
    return { room, replies: [say(messageFor(room.language, 'start.hostOnly'), false)] };
  }

  const next: Room = { ...room, started: true };
  const first = currentPlayer(next.session);

  return {
    room: next,
    replies: [
      say(
        messageFor(room.language, 'start.begins', { name: nameOf(next, first.id) }),
        true,
        buttonsFor(next),
      ),
    ],
  };
}

// --- playing ------------------------------------------------------------------

/**
 * `/roll` — take a turn.
 *
 * The die is derived from the room's seed and the number of rolls already
 * taken, so the whole game can be replayed from `(seed, rollsTaken)` and no
 * player has to take another's word for a roll.
 */
export function roll(room: Room, byPlayerId: string, now: number): CommandResult {
  if (!room.started) {
    return { room, replies: [say(messageFor(room.language, 'roll.notStarted'), false)] };
  }

  if (isSessionOver(room.session)) {
    // Saying only "this game is over" leaves a player at a dead end with no
    // hint that another table is a command away.
    return {
      room,
      replies: [say(messageFor(room.language, 'roll.over'), false)],
    };
  }

  const holder = currentPlayer(room.session);
  if (holder.id !== byPlayerId) {
    return {
      room,
      replies: [
        say(messageFor(room.language, 'roll.notYourTurn', { name: nameOf(room, holder.id) }), false),
      ],
    };
  }

  const verdict = canCurrentPlayerRoll(room.session, now);
  if (!verdict.allowed) {
    if (verdict.reason === 'report-required') {
      const plan = planFor(room.language, holder.state.loka);
      return {
        room,
        replies: [
          say(
            messageFor(room.language, 'roll.reportRequired', {
              plan: holder.state.loka,
              title: plan.title,
            }),
            false,
          ),
        ],
      };
    }
    return {
      room,
      replies: [
        say(messageFor(room.language, 'roll.cooldown', { wait: formatWait(verdict.waitMs) }), false),
      ],
    };
  }

  // Advance the die to this room's next value.
  //
  // Through `rollerFor`, so the variant's own die is used: `legacy-mobile` and
  // `online` re-roll a repeated value, and reading the flag at each call site
  // is how it came to be read at none of them.
  const die = rollerFor(room.session.rules, seededRoller(room.seed));
  for (let i = 0; i < room.rollsTaken; i++) die();
  const value = die();

  let move;
  try {
    move = advance(room.session, value, now);
  } catch (error) {
    if (error instanceof SessionError) {
      return { room, replies: [say(error.message, false)] };
    }
    throw error;
  }

  const next: Room = { ...room, session: move.session, rollsTaken: room.rollsTaken + 1 };
  const replies = [say(describeMove(next, move.playerId, value, move.event))];
  const effects: Effect[] = [
    { kind: 'move', userId: move.playerId, event: move.event, ruleset: room.session.rules },
  ];

  if (move.event.isGameFinished && !move.event.isBlocked) {
    replies.push(
      say(messageFor(room.language, 'roll.reached', { name: nameOf(next, move.playerId) })),
    );
  }

  if (isSessionOver(next.session)) {
    replies.push(say(describeStandings(next)));
    replies.push(say(messageFor(room.language, 'roll.ended')));
  } else if (move.keepsTurn) {
    // The extra turn, which is the engine's answer and not a guess from who
    // holds the turn next. Read the other way round — "the same player throws
    // next" — a solo table announced every throw as a six, including a one,
    // in the same breath as saying it takes a six to enter.
    replies.push(say(messageFor(room.language, 'roll.again')));
  } else if (currentPlayer(next.session).id !== move.playerId) {
    // Not when the turn comes straight back: a solo table said "X is next"
    // after every throw, to X, which is half of everything the bot said. And
    // nothing at all when it comes back without a six — a player alone at a
    // table can see whose turn it is.
    replies.push(
      say(
        messageFor(room.language, 'roll.next', {
          name: nameOf(next, currentPlayer(next.session).id),
        }),
      ),
    );
  }

  // The keyboard rides the last reply, which is what the transport attaches it
  // to. Until now a throw carried none at all, so whatever was last drawn stayed
  // on screen — including `🎲 Roll` while the game was waiting for an account of
  // where the player had landed.
  const last = replies[replies.length - 1];
  if (last && !isSessionOver(next.session)) last.buttons = buttonsFor(next);

  return { room: next, replies, effects };
}

/** A move, in words, with the plan the player landed on. */
function describeMove(
  room: Room,
  playerId: string,
  value: number,
  event: {
    from: number;
    to: number;
    direction: string;
    isGameStart: boolean;
    isBlocked: boolean;
    isThreeSixesReset: boolean;
    jumpedFrom: number | null;
    /** Thrown by somebody who had already finished. See `needsSixToEnter`. */
    wasComplete: boolean;
  },
): string {
  const who = nameOf(room, playerId);

  // A player waiting to enter is not short of room, and did not come from 68.
  // Both surfaces had written this condition out by hand, and the bot spent a
  // while telling people about a rule they were not under yet before copying
  // the mini app's fix. It is the engine's question now.
  if (needsSixToEnter(event)) {
    return messageFor(room.language, 'move.needSix', { name: who, value });
  }

  if (event.isBlocked && event.from === event.to) {
    return messageFor(room.language, 'move.refused', { name: who, value });
  }

  const plan = planFor(room.language, event.to);

  if (event.isGameStart) {
    return messageFor(room.language, 'move.enter', {
      name: who,
      to: event.to,
      title: plan.title,
    });
  }
  const common = { name: who, value, to: event.to, title: plan.title };

  if (event.isThreeSixesReset) {
    return messageFor(room.language, 'move.threeSixes', common);
  }

  if (event.jumpedFrom !== null) {
    const key = event.direction.startsWith('snake') ? 'move.snake' : 'move.arrow';
    return messageFor(room.language, key, { ...common, from: event.jumpedFrom });
  }

  return messageFor(room.language, 'move.step', { ...common, from: event.from });
}

/** `/report <text>` — file the report the game is played for. */
/**
 * What is true of a player the moment their report is filed.
 *
 * The reply used to be one sentence — *"{name} has reported. You may throw."* —
 * said whatever the state was. Found by playing a whole game through these
 * functions: a player who had just reached Cosmic Consciousness was told they
 * may throw, one line after the bot announced the game was over. At a table of
 * two it was wrong far more often than that, because a player reports when they
 * owe a report and the turn has usually moved on.
 *
 * Ordered the way the player experiences it: their own game ending outranks
 * whose turn it is, and whose turn it is outranks a cooldown they are not yet
 * waiting on. The engine answers the last one — `canCurrentPlayerRoll` knows
 * about `turnCooldownMs`, which is a day under the published app's rules — so
 * this decides nothing the rules already decide.
 */
export type AfterReport =
  | { say: 'may-roll' }
  | { say: 'finished' }
  | { say: 'not-your-turn'; holder: string }
  | { say: 'wait'; waitMs: number };

export function afterReport(session: Session, playerId: string, now: number): AfterReport {
  const player = session.players.find((seated) => seated.id === playerId);
  if (!player) return { say: 'may-roll' };

  if (hasWon(player.state)) return { say: 'finished' };

  const holder = currentPlayer(session);
  if (holder.id !== playerId) return { say: 'not-your-turn', holder: holder.id };

  // A report has just been filed, so the gate cannot still be asking for one:
  // the only refusal left is a cooldown, and that is the one with a wait to
  // name. `waitMs > 0` rather than `!allowed` because a sentence saying "in ."
  // would be worse than the one this replaced.
  const verdict = canCurrentPlayerRoll(session, now);
  if (!verdict.allowed && verdict.waitMs > 0) return { say: 'wait', waitMs: verdict.waitMs };

  return { say: 'may-roll' };
}

export function report(
  room: Room,
  byPlayerId: string,
  text: string,
  now: number = Date.now(),
): CommandResult {
  const seated = room.session.players.find((p) => p.id === byPlayerId);
  if (!seated) {
    return { room, replies: [say(messageFor(room.language, 'report.notSeated'), false)] };
  }

  // A report is about the square you are standing on, and a player waiting to
  // enter is not standing on one. The bot took the report anyway and filed it
  // against `state.loka` — which for a waiting player is 68, the winning
  // square. So somebody who had never thrown a six could put an account of
  // Cosmic Consciousness into their own path, and `/returns` would later count
  // it as a square that came back.
  //
  // The engine says so too and nothing was asking: `owesReport` is false for a
  // waiting player, because there is no plan to reflect on until they are on
  // the board.
  if (isWaitingToEnter(seated.state)) {
    return { room, replies: [say(messageFor(room.language, 'report.notOnBoard'), false)] };
  }

  // One account per arrival.
  //
  // The bot took a second, a third, an unlimited number about the same visit,
  // and each one was filed. `/returns` counts a square as returned to when more
  // than one thing was written about it — so `/report` twice without moving was
  // enough to make the game claim a return that never happened, in the one
  // record it exists to produce.
  //
  // The condition is the engine's, not this file's: `owesReport` knows about
  // the winning square, about a six that keeps the turn, and about the snake at
  // 12 that puts a player back where they started. The mini app has gated on it
  // since seats arrived; the bot never has.
  if (!owesReport(seated.state, room.session.rules) || seated.reportSubmitted) {
    return {
      room,
      replies: [
        say(messageFor(room.language, 'report.already', { plan: seated.state.loka }), false),
      ],
    };
  }

  // What counts as a report is the variant's, not this file's: the published
  // app refuses fewer than a hundred characters, and `classic` asks only that
  // something was written.
  if (!isReport(text, room.session.rules)) {
    const shortest = room.session.rules.minReportChars;
    return {
      room,
      replies: [
        say(
          shortest > 0
            ? messageFor(room.language, 'report.tooShort', { count: shortest })
            : messageFor(room.language, 'report.empty'),
          false,
        ),
      ],
    };
  }

  // The moment matters: the published app starts the wait between rolls when
  // the report is written, not when the die was thrown, and a variant that
  // says so needs the time recorded rather than inferred.
  const next: Room = { ...room, session: submitReport(room.session, byPlayerId, now) };
  const after = afterReport(next.session, byPlayerId, now);
  const name = nameOf(next, byPlayerId);

  const filed =
    after.say === 'finished'
      ? messageFor(room.language, 'report.filedDone', { name })
      : after.say === 'not-your-turn'
        ? messageFor(room.language, 'report.filedTurn', {
            name,
            holder: nameOf(next, after.holder),
          })
        : after.say === 'wait'
          ? messageFor(room.language, 'report.filedWait', {
              name,
              wait: formatWait(after.waitMs),
            })
          : messageFor(room.language, 'report.filed', { name });

  return {
    room: next,
    replies: [say(filed, false)],
    // The report is what the game is played for; keeping it is the point.
    effects: [
      { kind: 'report', userId: byPlayerId, plan: seated.state.loka, text: text.trim() },
    ],
  };
}

/** `/plan [n]` — read a plan; defaults to the one the asker stands on. */
export function plan(room: Room, byPlayerId: string, requested?: number): CommandResult {
  const seated = room.session.players.find((p) => p.id === byPlayerId);
  const number = requested ?? seated?.state.loka;

  if (number === undefined) {
    return { room, replies: [say(messageFor(room.language, 'plan.which'), false)] };
  }

  if (!Number.isInteger(number) || number < 1 || number > 72) {
    return { room, replies: [say(messageFor(room.language, 'plan.range'), false)] };
  }

  const found = planFor(room.language, number);
  return {
    room,
    replies: [say(`${number}. ${found.title}\n\n${found.body}`, false)],
  };
}

/**
 * The rules book, in a chat.
 *
 * `@leela/content` has carried it in 22 languages since the third pass, the
 * docs site serves it and the mini app opens it. The bot — which is where
 * people actually play — had eleven commands and none of them was this one. A
 * player in Telegram could not read how the game works.
 *
 * Falls back to English as a whole book rather than chapter by chapter, for the
 * same reason the mini app does: half in one language and half in another is
 * worse than one a reader can at least read.
 */
export function rules(language: Language = 'en', requested?: number): CommandResult {
  const book = bookFor(language);

  if (book.length === 0) {
    return { room: null, replies: [say(messageFor(language, 'rules.none'), false)] };
  }

  if (requested === undefined) {
    const list = book
      .map((chapter, index) => `${index + 1}. ${chapter.title ?? chapter.slug}`)
      .join('\n');

    return {
      room: null,
      replies: [say(`${messageFor(language, 'rules.title')}\n\n${list}`, false)],
    };
  }

  const chapter = book[requested - 1];
  if (!Number.isInteger(requested) || !chapter) {
    return {
      room: null,
      replies: [say(messageFor(language, 'rules.which', { count: book.length }), false)],
    };
  }

  return {
    room: null,
    replies: [say(`${requested}. ${chapter.title ?? chapter.slug}\n\n${chapter.body}`, false)],
  };
}

/** One thing a player wrote, on the plan they wrote it about. */
export interface PathEntry {
  plan: number;
  text: string;
  createdAt: Date;
}

/**
 * `/path` — what a player has written, and where.
 *
 * The reports were being kept and never shown. This is the point of keeping
 * them: a player's own account of the squares they have stood on is the record
 * the game is played to produce.
 *
 * Takes a language rather than a room, because a path belongs to the player
 * and not to the table. Requiring a table meant that clearing one, or walking
 * into a different chat, hid everything a player had ever written.
 *
 * @param entries  Order is not assumed — they are sorted here, so a store that
 *                 returns newest-first is fine. Pass null when the store
 *                 cannot read them back at all.
 */
export function pathFor(
  language: Language,
  entries: PathEntry[] | null,
): Reply[] {
  if (entries === null) {
    return [say(messageFor(language, 'path.absent'), false)];
  }

  if (entries.length === 0) {
    return [say(messageFor(language, 'path.empty'), false)];
  }

  const ordered = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const entriesText = ordered.map((entry) => {
    const title = planFor(language, entry.plan).title;
    return `${entry.plan}. ${title}\n${entry.text}`;
  });

  const heading = messageFor(language, 'path.heading', { count: ordered.length });

  return paginate([heading, ...entriesText]).map((page) => say(page, false));
}

/**
 * `/returns` — the squares that came back, and what was written each time.
 *
 * `/path` is everything, oldest first, and it answers "what have I written".
 * It cannot answer the question the game is actually about: *what keeps coming
 * back*. A player forty entries in has the material for that answer and no way
 * to ask for it — the two accounts of plan 41 are a year apart in one long
 * scroll.
 *
 * `revisited` is `@leela/journal`'s, not this file's. The mini app worked this
 * out first, and a second surface working it out again is two surfaces
 * describing one thing differently — which is the whole reason that package
 * exists.
 *
 * Same three answers as `/path`, and for the same reasons: a store that keeps
 * nothing says so rather than returning an empty list, because "you have not
 * written anything" and "this bot is not keeping reports" are different
 * statements.
 */
export function returnsFor(language: Language, entries: PathEntry[] | null): Reply[] {
  if (entries === null) {
    return [say(messageFor(language, 'path.absent'), false)];
  }

  const coming = revisited(entries);
  if (coming.length === 0) {
    return [say(messageFor(language, 'returns.none'), false)];
  }

  const blocks = coming.map((visit) => {
    const heading = messageFor(language, 'returns.times', {
      plan: visit.plan,
      title: planFor(language, visit.plan).title,
      count: visit.times,
    });

    // Oldest first inside a square, which is the only order in which a return
    // says anything: the first account is what the later ones are measured
    // against.
    const written = entries
      .filter((entry) => entry.plan === visit.plan)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((entry) => entry.text);

    return [heading, ...written].join('\n');
  });

  const heading = messageFor(language, 'returns.heading', { count: coming.length });

  return paginate([heading, ...blocks]).map((page) => say(page, false));
}

/** `/returns` at a table, which is where the room's language comes from. */
export function returns(
  room: Room,
  byPlayerId: string,
  entries: PathEntry[] | null,
): CommandResult {
  // A path belongs to the player and not to the table, and so does what came
  // back to them.
  void byPlayerId;
  return { room, replies: returnsFor(room.language, entries) };
}

/** `/path` at a table, which is where the room's language comes from. */
export function path(
  room: Room,
  byPlayerId: string,
  entries: PathEntry[] | null,
): CommandResult {
  // No check that the player is seated: their reports are theirs whether or
  // not they are at this table.
  void byPlayerId;
  return { room, replies: pathFor(room.language, entries) };
}

/**
 * Telegram refuses a message over 4096 characters outright.
 *
 * A player twenty plans into a game writes more than that, and the reply would
 * simply fail to send — the failure being a rejected API call, not a truncated
 * message, so they would see nothing at all. `renderPlan` already accounted for
 * this; `/path` did not.
 */
export const MAX_MESSAGE_CHARS = 3500;

/** Marks an entry that is too long to send even on its own. */
const TRUNCATED = '\n…';

/**
 * Pack blocks into as few messages as fit, without splitting a block.
 *
 * A report cut across two messages reads as two half-thoughts, which is worse
 * than an extra message. A single block longer than the limit is truncated —
 * there is nowhere else for it to go.
 */
export function paginate(blocks: string[], limit = MAX_MESSAGE_CHARS): string[] {
  const separator = '\n\n';
  const pages: string[] = [];
  let current = '';

  for (const block of blocks) {
    const fits = block.length <= limit;
    const piece = fits ? block : `${block.slice(0, limit - TRUNCATED.length)}${TRUNCATED}`;

    if (current.length === 0) {
      current = piece;
      continue;
    }

    if (current.length + separator.length + piece.length <= limit) {
      current += separator + piece;
    } else {
      pages.push(current);
      current = piece;
    }
  }

  if (current.length > 0) pages.push(current);
  return pages;
}

/** `/board` — where everyone stands. */
export function board(room: Room): CommandResult {
  return { room, replies: [say(describeStandings(room))] };
}

function describeStandings(room: Room): string {
  const lines = standings(room.session).map((player) => {
    // Three states, not two. This had `hasWon` and a raw square number, so a
    // player who had never thrown a six was listed as standing on 68 — the
    // winning square — because that is where a waiting player sits in this
    // shape. `render.ts` knew; this did not; the difference is the sixth time
    // that ambiguity has cost something.
    const where = hasWon(player.state)
      ? messageFor(room.language, 'standings.done')
      : isWaitingToEnter(player.state)
        ? messageFor(room.language, 'standings.waiting')
        : `${player.state.loka}`;
    const owed = player.reportSubmitted
      ? ''
      : ` — ${messageFor(room.language, 'standings.owes')}`;
    return `${nameOf(room, player.id)}: ${where}${owed}`;
  });

  return lines.join('\n');
}

/**
 * `/help` — the whole surface, in one message.
 *
 * Takes a language because help is the one message a player reads when they do
 * not yet understand the game, which is the worst moment to be handed a
 * language they do not read.
 */
export function help(language: Language = 'en'): CommandResult {
  return { room: null, replies: [say(messageFor(language, 'help'), false)] };
}
