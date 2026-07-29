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
  formatWait,
  isSessionOver,
  ruleSetById,
  seededRoller,
  standings,
  submitReport,
  type RuleSet,
  type Session,
} from '@leela/engine';
import { planFor, resolveLanguage, type Language } from '@leela/content';

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

export interface Reply {
  /** What to send. */
  text: string;
  /**
   * Whether this is addressed to the whole room. The transport may use it to
   * decide between a group message and a direct one.
   */
  broadcast: boolean;
}

/**
 * Something the world outside has to do.
 *
 * Commands stay pure by describing the write rather than performing it. The
 * transport applies effects after the room is saved, so a failure to record a
 * report cannot leave the board ahead of the writing.
 */
export type Effect = {
  kind: 'report';
  userId: string;
  /** The plan the report is about — the one the player is standing on. */
  plan: number;
  text: string;
};

export interface CommandResult {
  room: Room | null;
  replies: Reply[];
  /** Writes for the transport to apply. Absent when there are none. */
  effects?: Effect[];
}

function say(text: string, broadcast = true): Reply {
  return { text, broadcast };
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
        `A table is open. ${host.name} is seated.\n` +
          `Up to ${MAX_SEATS} may play — send /join.\n` +
          `When everyone is seated, ${host.name} sends /start.`,
      ),
    ],
  };
}

/** `/join` — take a seat, until the table is full or play has begun. */
export function join(room: Room, player: { id: string; name: string }): CommandResult {
  if (room.started) {
    return { room, replies: [say('This game has already begun.', false)] };
  }

  if (room.session.players.some((p) => p.id === player.id)) {
    return { room, replies: [say('You are already seated.', false)] };
  }

  if (room.session.players.length >= MAX_SEATS) {
    return { room, replies: [say(`The table seats ${MAX_SEATS}, and it is full.`, false)] };
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
    replies: [say(`${player.name} takes a seat. ${seated.length} at the table.`)],
  };
}

/** `/start` — close the table and begin. Only the host may. */
export function start(room: Room, byPlayerId: string): CommandResult {
  if (room.started) {
    return { room, replies: [say('Already playing.', false)] };
  }

  if (room.session.players[0].id !== byPlayerId) {
    return { room, replies: [say('Only whoever opened the table may start it.', false)] };
  }

  const next: Room = { ...room, started: true };
  const first = currentPlayer(next.session);

  return {
    room: next,
    replies: [
      say(
        `The game begins. ${nameOf(next, first.id)} goes first.\n` +
          'A six puts you on the board — send /roll.',
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
    return { room, replies: [say('The table has not started yet — /start first.', false)] };
  }

  if (isSessionOver(room.session)) {
    return { room, replies: [say('This game is over.', false)] };
  }

  const holder = currentPlayer(room.session);
  if (holder.id !== byPlayerId) {
    return {
      room,
      replies: [say(`It is ${nameOf(room, holder.id)}'s turn.`, false)],
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
            `You are standing on ${holder.state.loka}. ${plan.title}.\n` +
              'Write what it brings up before you move on — send /report followed by your words.',
            false,
          ),
        ],
      };
    }
    return {
      room,
      replies: [say(`Not yet. Your next throw is in ${formatWait(verdict.waitMs)}.`, false)],
    };
  }

  // Advance the die to this room's next value.
  const die = seededRoller(room.seed);
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

  if (move.event.isGameFinished && !move.event.isBlocked) {
    replies.push(say(`${nameOf(next, move.playerId)} reaches Cosmic Consciousness. 🕉`));
  }

  if (isSessionOver(next.session)) {
    replies.push(say(describeStandings(next)));
  } else if (!move.keepsTurn) {
    replies.push(say(`${nameOf(next, currentPlayer(next.session).id)} is next.`));
  } else {
    replies.push(say('A six — throw again.'));
  }

  return { room: next, replies };
}

/** A move, in words, with the plan the player landed on. */
function describeMove(
  room: Room,
  playerId: string,
  value: number,
  event: { from: number; to: number; direction: string; isBlocked: boolean; isThreeSixesReset: boolean; jumpedFrom: number | null },
): string {
  const who = nameOf(room, playerId);

  if (event.isBlocked && event.from === event.to) {
    return `${who} throws ${value}. Not enough room — the throw is refused.`;
  }

  const plan = planFor(room.language, event.to);
  const head = `${who} throws ${value}.`;

  if (event.isThreeSixesReset) {
    return `${head} A third six — the run burns, back to ${event.to}.\n${event.to}. ${plan.title}`;
  }

  if (event.jumpedFrom !== null) {
    const kind = event.direction.startsWith('snake') ? 'A snake at' : 'An arrow at';
    return `${head} ${kind} ${event.jumpedFrom} takes them to ${event.to}.\n${event.to}. ${plan.title}`;
  }

  return `${head} ${event.from} → ${event.to}.\n${event.to}. ${plan.title}`;
}

/** `/report <text>` — file the report the game is played for. */
export function report(room: Room, byPlayerId: string, text: string): CommandResult {
  const seated = room.session.players.find((p) => p.id === byPlayerId);
  if (!seated) {
    return { room, replies: [say('You are not at this table.', false)] };
  }

  if (text.trim().length === 0) {
    return {
      room,
      replies: [say('Send /report followed by what the plan brings up.', false)],
    };
  }

  const next: Room = { ...room, session: submitReport(room.session, byPlayerId) };
  return {
    room: next,
    replies: [say(`${nameOf(next, byPlayerId)} has reported. You may throw.`, false)],
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
    return { room, replies: [say('Which plan? Send /plan followed by a number, 1 to 72.', false)] };
  }

  if (!Number.isInteger(number) || number < 1 || number > 72) {
    return { room, replies: [say('The board runs from 1 to 72.', false)] };
  }

  const found = planFor(room.language, number);
  return {
    room,
    replies: [say(`${number}. ${found.title}\n\n${found.body}`, false)],
  };
}

/** `/board` — where everyone stands. */
export function board(room: Room): CommandResult {
  return { room, replies: [say(describeStandings(room))] };
}

function describeStandings(room: Room): string {
  const lines = standings(room.session).map((player) => {
    const done = player.state.is_finished && player.state.previous_loka !== 0;
    const where = done ? 'finished 🕉' : `${player.state.loka}`;
    const owed = player.reportSubmitted ? '' : ' — owes a report';
    return `${nameOf(room, player.id)}: ${where}${owed}`;
  });

  return lines.join('\n');
}

/** `/help` — the whole surface, in one message. */
export function help(): CommandResult {
  return {
    room: null,
    replies: [
      say(
        [
          'Leela — the game of self-knowledge.',
          '',
          '/new — open a table',
          '/join — take a seat',
          '/start — begin (host only)',
          '/roll — throw the die',
          '/report <text> — reflect on the plan you stand on',
          '/plan [n] — read a plan',
          '/board — where everyone stands',
          '',
          'A six puts you on the board. Reaching 68 exactly wins.',
          'You cannot throw again until you have reported on where you are.',
        ].join('\n'),
        false,
      ),
    ],
  };
}
