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
} from '@leela/engine';
import { messageFor, planFor, rulesFor, resolveLanguage, type Language } from '@leela/content';

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
        playingButtons(room.language),
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
  return {
    room: next,
    replies: [
      say(messageFor(room.language, 'report.filed', { name: nameOf(next, byPlayerId) }), false),
    ],
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
  const chapters = rulesFor(language);
  const book = chapters.length > 0 ? chapters : rulesFor('en');

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
    // `hasWon`, not a fourth copy of its condition: this one had already lost
    // the check that the player is standing on the win square.
    const where = hasWon(player.state)
      ? messageFor(room.language, 'standings.done')
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
