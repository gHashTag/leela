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
  advance,
  canCurrentPlayerRoll,
  createSession,
  currentPlayer,
  hasWon,
  countsAsReport,
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
import { MAX_REPORT_CHARS, revisited } from '@leela/journal';
import { MAX_MESSAGE_CHARS } from './render';
import { bookFor, formatWait, messageFor, planFor, resolveLanguage, type Language,
  type MessageKey,
} from '@leela/content';

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
/**
 * The commands this bot answers, and what each is for.
 *
 * Telegram shows a menu behind the `/` button, built from `setMyCommands`, and
 * this bot registered nothing. Sixteen commands and no way to find any of them:
 * a player had to know `/help` existed in order to be told the other fifteen,
 * and `/help` was not in the menu either. The mini app puts every act on a
 * button and the phone puts every act on the screen; here they were invisible.
 *
 * **One list, because there were nearly three.** This repository has had six
 * restated lists go wrong — Dockerfile manifests, README test counts, this
 * bot's own command list, its help text, `StoredSeat`, and CI's `for pkg in …`
 * — and a menu is a fourth place to write the same names down. So the handlers,
 * the help text and the menu are held to each other by `commands.test.ts`
 * rather than kept in step by hand.
 *
 * `/help` is deliberately absent from the help text and present here: a help
 * text that lists itself is noise, and a menu that omits the way to read it is
 * the trap this fixes.
 */
export interface BotCommand {
  /** As Telegram wants it: lowercase, no slash. */
  readonly command: string;
  /** The key of the sentence describing it, so the menu is translated too. */
  readonly describedBy: MessageKey;
}

export const BOT_COMMANDS: readonly BotCommand[] = [
  { command: 'new', describedBy: 'menu.new' },
  { command: 'join', describedBy: 'menu.join' },
  { command: 'start', describedBy: 'menu.start' },
  { command: 'roll', describedBy: 'menu.roll' },
  { command: 'intention', describedBy: 'menu.intention' },
  { command: 'report', describedBy: 'menu.report' },
  { command: 'plan', describedBy: 'menu.plan' },
  { command: 'rules', describedBy: 'menu.rules' },
  { command: 'ask', describedBy: 'menu.ask' },
  { command: 'path', describedBy: 'menu.path' },
  { command: 'returns', describedBy: 'menu.returns' },
  { command: 'take', describedBy: 'menu.take' },
  { command: 'save', describedBy: 'menu.save' },
  { command: 'board', describedBy: 'menu.board' },
  { command: 'end', describedBy: 'menu.end' },
  { command: 'help', describedBy: 'menu.help' },
];

/** The menu as Telegram wants it, in one language. */
export function menuFor(language: Language): Array<{ command: string; description: string }> {
  return BOT_COMMANDS.map((one) => ({
    command: one.command,
    // Telegram refuses a description over 256 characters, and refuses the whole
    // call rather than the one entry — so a sentence that grows in translation
    // would take the entire menu down with it.
    description: messageFor(language, one.describedBy).slice(0, 256),
  }));
}

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

/**
 * Whether this player may clear the table.
 *
 * `/end` asked nothing. Not who sent it, not whether there was a table: it
 * deleted the room and replied *The table is cleared* to anybody who typed the
 * word. In a group that is everyone who can write in the chat — a lurker who
 * never took a seat wipes six players' hour, the board, whose turn it was, and
 * the companion's memory of every exchange, in one word.
 *
 * The same file already decided this question once, one command up: seat zero
 * opened the table and only they may `/start` it, because starting closes the
 * table on everybody else. `/new` decided it a second time — it refuses to
 * throw away a session that is not over. Ending it was the door left open
 * beside two locked ones.
 *
 * **A table with play in it belongs to the people sitting at it**, so any of
 * them may end it and nobody else may. Before it starts and after it is over
 * there is nothing to lose, and anybody may clear it — which is also what keeps
 * a group from being stuck with a table nobody can open past: `/new` will not
 * replace a running session, so if `/end` needed a seat in every case, a table
 * whose players had all left would hold the chat for good.
 *
 * The residue is honest and small: a *running* table abandoned by everyone
 * seated stays until one of them comes back. That is the trade for not letting
 * a stranger end a game in progress.
 */
export function mayEnd(room: Room | null, byPlayerId: string): boolean {
  if (!room) return false;
  if (!room.started || isSessionOver(room.session)) return true;

  return room.session.players.some((player) => player.id === byPlayerId);
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
/**
 * What this player is playing for, as the roll needs to know it.
 *
 * Absent means *this caller does not deal in intentions* — a bot built with a
 * store that cannot hold one, and every test that plays a game without them —
 * and then there is no gate. Present with nothing in it means they have not
 * answered, and that is what the gate is for. The two are different facts and
 * an optional string would make them one.
 *
 * `bot.ts` always passes it, and `asked.test.ts` holds it to that: a default
 * that quietly skips the gate is an absence reading exactly like a pass.
 */
export interface Asked {
  intention: string;
}

/**
 * Take a throw.
 *
 * **The question comes before the die**, on this surface as on the other three.
 * The published app blocks the board without one (`screens/helper.ts`, with the
 * back gesture blocked), the mini app's `mayThrow` refuses, and the phone was
 * given the same gate two passes ago under the rule this repository states
 * plainly: *the one difference between surfaces this repository does not allow
 * is what the game asks of a player.* The bot was the surface where a whole
 * game could be played without ever being asked.
 *
 * `intention.ask` has been in the catalogue in English and Russian since the
 * bot learned `/intention`, and was said by nobody — which is how this was
 * found. Not a `RuleSet` change: the gate lives in the surfaces and not in
 * `@leela/engine`, as it did when the phone joined them.
 *
 * After *whose turn is it*, because a question is not worth asking of somebody
 * who is not up; before the engine's verdict, because every account is written
 * inside the question and asking for the writing first is asking somebody to
 * answer a question nobody put.
 */
export function roll(
  room: Room,
  byPlayerId: string,
  now: number,
  asked?: Asked,
): CommandResult {
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

  if (asked && asked.intention.trim() === '') {
    return { room, replies: [say(messageFor(room.language, 'intention.ask'), false)] };
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
        say(
          messageFor(room.language, 'roll.cooldown', {
            wait: formatWait(room.language, verdict.waitMs),
          }),
          false,
        ),
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

    /**
     * And whether the last account is still owed.
     *
     * `classic` asks for a report on 68, and a pass went into making the
     * winner's account possible at all — the square a whole game is played to
     * reach was, for a while, the one arrival nobody was ever asked to write
     * about. Having made it possible, this line pointed at `/path` and `/new`
     * and not at `/report`, which is the one thing still to do.
     *
     * Every other arrival is met with the words that discharge it. The
     * standings just above do say *owes a report*, in a list — an obligation
     * named in a parenthesis, in the same breath as *that is the game*, is one
     * nobody reads as an obligation.
     */
    const owing = next.session.players.some(
      (player) => owesReport(player.state, next.session.rules) && !player.reportSubmitted,
    );

    replies.push(say(messageFor(room.language, owing ? 'roll.endedOwing' : 'roll.ended')));
  } else if (move.keepsTurn) {
    // The extra turn, which is the engine's answer and not a guess from who
    // holds the turn next. Read the other way round — "the same player throws
    // next" — a solo table announced every throw as a six, including a one,
    // in the same breath as saying it takes a six to enter.
    //
    // **And whether the throw can actually happen is asked of the same
    // function that will refuse it.** A six that moves a player onto a new
    // square also leaves them owing a report — which is every entering six,
    // the first one of every game — so this said *A six — throw again* and the
    // next `/roll` answered *write what it brings up before you move on*. Two
    // sentences in a row, contradicting each other, on the most-travelled path
    // in the game. The announcement and the refusal are one question now.
    const afterwards = canCurrentPlayerRoll(next.session, now);

    if (afterwards.allowed) {
      replies.push(say(messageFor(room.language, 'roll.again')));
    } else if (afterwards.reason === 'report-required') {
      replies.push(say(messageFor(room.language, 'roll.againAfter')));
    }
    // A cooldown says nothing here: `online` measures the wait from the moment
    // the report is written, so any figure named now would be wrong by the time
    // it mattered, and `roll.cooldown` says it exactly when they ask.
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
  if (!countsAsReport(text, room.session.rules)) {
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

  /**
   * What a path can keep, decided here rather than at the far end of a file.
   *
   * Telegram carries 4096 characters and `MAX_REPORT_CHARS` is 4000, so a
   * report written in a chat can be longer than the format holds. This filed
   * the whole of it, said *P has reported*, and the tail was cut later — by
   * `parseDocument`, when the path was carried to a phone, where nobody was
   * watching it happen. The other two surfaces cap the box a player types in;
   * a chat has no box to cap.
   *
   * Clamped rather than refused, which is the reading `parseDocument` already
   * makes about the same number: a report of five thousand characters is
   * ordinary writing that is longer than the store will hold, and refusing it
   * outright would throw away all of it to enforce a limit on the end of it.
   * Said, because a bound nobody is shown is indistinguishable from a bug.
   */
  const written = text.trim();
  const kept = written.slice(0, MAX_REPORT_CHARS);
  const clipped = written.length - kept.length;

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
              wait: formatWait(room.language, after.waitMs),
            })
          : messageFor(room.language, 'report.filed', { name });

  return {
    room: next,
    replies: [
      say(
        clipped === 0
          ? filed
          : `${filed} ${messageFor(room.language, 'report.clipped', {
              count: clipped,
              max: MAX_REPORT_CHARS,
            })}`,
        false,
      ),
    ],
    // The report is what the game is played for; keeping it is the point.
    effects: [
      { kind: 'report', userId: byPlayerId, plan: seated.state.loka, text: kept },
    ],
  };
}

/** `/plan [n]` — read a plan; defaults to the one the asker stands on. */
/**
 * The square a player is standing on, or null while they are standing nowhere.
 *
 * `state.loka` is **68** for somebody who has never thrown a six — the engine
 * parks them there and `hasWon` is what tells the two apart. So `/plan` with no
 * argument answered a brand-new player with the text of Cosmic Consciousness,
 * the square the whole game is played to reach, and a progress bar showing them
 * at the end of it.
 *
 * The eighth sighting of the 68 ambiguity, and the second on this surface: the
 * bot's standings printed the raw square once too. Exported because the
 * transport asks the same question — a decision written out twice is a decision
 * that will differ, which is how `/plan` came to have this and `describeStandings`
 * came to have it separately.
 */
export function standingSquare(room: Room, byPlayerId: string): number | null {
  const seated = room.session.players.find((p) => p.id === byPlayerId);
  if (!seated || isWaitingToEnter(seated.state)) return null;
  return seated.state.loka;
}

export function plan(room: Room, byPlayerId: string, requested?: number): CommandResult {
  const seated = room.session.players.find((p) => p.id === byPlayerId);
  const number = requested ?? standingSquare(room, byPlayerId) ?? undefined;

  if (number === undefined) {
    // Two different absences, and they were one message. Somebody with no seat
    // is asked which plan they mean; somebody seated and waiting to enter is
    // told they are not on the board, which is the true and more useful thing.
    return {
      room,
      replies: [
        say(messageFor(room.language, seated ? 'ask.notOnBoard' : 'plan.which'), false),
      ],
    };
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
 *
 * That last sentence was written beside a *second* declaration of the same
 * number, which is how this repository's duplicated bounds have always started:
 * somebody notices the other one exists and copies it rather than importing it.
 * One of them, from the module about rendering for a chat.
 */
export { MAX_MESSAGE_CHARS } from './render';

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
