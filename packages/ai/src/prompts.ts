/**
 * What we ask the model, and what we give it to answer from.
 *
 * The service this replaces asked the model to *invent* a description of the
 * plan a player had landed on, while a canonical text for that plan sat unused
 * in the repository — in 22 languages. It also carried spiritual commentary for
 * 5 of the 72 plans, hardcoded in Russian, and most of those 5 were
 * unreachable because move-type messages were checked first.
 *
 * So the rule here is: the model never supplies the teaching. The teaching
 * comes from `@leela/content`; the model only helps the player meet it.
 */

import { TOTAL_PLANS, WIN_LOKA, type Direction } from '@leela/engine';
import { lastSentenceEnd, planFor, resolveLanguage, type Language } from '@leela/content';

/** Where the player is, and how they got there. */
/** One square a player has already stood on, and what they wrote there. */
export interface JourneyEntry {
  plan: number;
  text: string;
}

/**
 * Why this plan is in front of the player.
 *
 * `standing` is the ordinary case: they threw, they landed, they are sitting
 * with it. `received` is a square somebody **sent** them — the mini app hands
 * one over through Telegram and `/take` reads one pasted into a chat — and the
 * player is not on it. They may be on plan 6, or waiting to enter the game at
 * all.
 *
 * The distinction was missing and the prompt said *The player is on plan N* for
 * both, so the companion answered every handed-over square as though the
 * receiver were standing there. It is the same defect this repository has met
 * five times on the surfaces — a sentence naming the wrong thing because it was
 * the one already written — arriving here, in what a model is told.
 */
export type Arrival = 'standing' | 'received';

export interface PlanContext {
  /** 1..72 */
  plan: number;
  /** Language to answer in. */
  language: Language;
  /**
   * Whether the player is on this plan or was sent it. `standing` by default,
   * because that is what every path but the hand-over does.
   */
  arrival?: Arrival;
  /** How the player arrived, when this is about a move. */
  direction?: Direction;
  /** The square they came from. */
  previousPlan?: number;
  /**
   * What the player is playing for.
   *
   * The frame every report is written inside — this repository's own words:
   * *the game is being played to answer it, and the reports are the answer
   * accumulating.* The companion had never been told it. It read a year of
   * answers without knowing the question, on both surfaces: the mini app keeps
   * one and does not call a model, the bot calls one and kept no intention.
   *
   * Given whole rather than summarised. It is at most a paragraph — the
   * published app's `yup.string().min(2).max(800)` — and it is the one piece of
   * context that everything else is relative to.
   */
  intention?: string;
  /**
   * Where the player has been and what they wrote there, oldest first.
   *
   * Without this a reflection on plan 40 is read as though it were the first
   * thing the player had ever said. The game is a path, and a companion that
   * cannot see the path can only respond to a single square.
   */
  journey?: ReadonlyArray<JourneyEntry>;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class PromptError extends Error {}

/**
 * How much of a plan's text to put in the prompt.
 *
 * The longest plan runs past 6000 characters, which crowds out the player's
 * own words in a small context window. Cut on a paragraph boundary so the text
 * never stops mid-sentence.
 */
export const MAX_PLAN_CHARS = 2400;

/**
 * How much of the journey to include, and how much of each entry.
 *
 * The plan's own text is what the answer must rest on, so the journey is
 * summarised rather than quoted: the most recent squares, one line each. Forty
 * reports at full length would push the plan out of a small context window and
 * leave the model with nothing to be faithful to.
 */
export const MAX_JOURNEY_ENTRIES = 8;
export const MAX_JOURNEY_ENTRY_CHARS = 160;
export const MAX_JOURNEY_CHARS = 1200;

/**
 * How many earlier accounts of *this* square to carry, and what they may cost.
 *
 * The journey is the last eight squares, which is recency — and recency is
 * blind to the one thing Leela is about. A player standing on 41 for the fourth
 * time wrote about it in February and in June; if forty squares have passed
 * since, neither is in the window, and the companion meets the most loaded
 * square in the game as though it were new.
 *
 * So what was written *here* is chosen first and separately, and the recent
 * squares fill what is left. Four of them, because a fifth is a paragraph and
 * the plan's own text is still what the answer has to rest on.
 */
export const MAX_RETURN_ENTRIES = 4;
export const MAX_RETURN_CHARS = 600;

/**
 * The longest intention carried into a prompt.
 *
 * The published app's own bound: `yup.string().min(2).max(800)` in
 * `ChangeIntention`. Clipped here as well, because a prompt is the one place a
 * value that has been through a file and an editor meets a budget that
 * everything else in the prompt has to share.
 *
 * From the format rather than beside it. This was the third copy of eight
 * hundred — a validator, a file reader and a prompt, three jobs and one number,
 * agreeing until somebody changed one of them.
 */
import { MAX_INTENTION_CHARS } from '@leela/journal';
export { MAX_INTENTION_CHARS };

/** One line per entry, clipped, in the shape both summaries use. */
function line(entry: JourneyEntry, language: Language): string {
  const title = planFor(language, entry.plan).title;
  const text = entry.text.replace(/\s+/g, ' ').trim();
  const clipped =
    text.length > MAX_JOURNEY_ENTRY_CHARS
      ? `${text.slice(0, MAX_JOURNEY_ENTRY_CHARS - 1)}…`
      : text;

  return `${entry.plan}. ${title} — ${clipped}`;
}

/**
 * What the player wrote the last times they stood on this same square.
 *
 * The most relevant thing in their whole journal, and the thing a window of the
 * eight most recent squares is structurally unable to see. Oldest first, because
 * the first account is what the later ones are measured against — which is the
 * same order the app and the bot both read a returned square in.
 */
export function summariseReturns(
  journey: ReadonlyArray<JourneyEntry>,
  plan: number,
  language: Language,
  budget = MAX_RETURN_CHARS,
): string {
  const here = journey.filter((entry) => entry.plan === plan);
  if (here.length === 0) return '';

  // The most recent of them, kept in walking order: if only some fit, the ones
  // that fit should be the ones nearest to now.
  const lines: string[] = [];
  let used = 0;

  for (const entry of [...here].slice(-MAX_RETURN_ENTRIES).reverse()) {
    const written = line(entry, language);
    if (used + written.length > budget) break;

    lines.unshift(written);
    used += written.length;
  }

  if (lines.length === 0) return '';

  const omitted = here.length - lines.length;
  const preamble =
    omitted > 0
      ? `They have stood here before. The last ${lines.length} of ${here.length} times they wrote:`
      : 'They have stood here before, and wrote:';

  return `${preamble}\n${lines.join('\n')}`;
}

/** The path, compressed to fit beside the plan text rather than instead of it. */
export function summariseJourney(
  journey: ReadonlyArray<JourneyEntry>,
  language: Language,
  budget = MAX_JOURNEY_CHARS,
): string {
  if (journey.length === 0) return '';

  // The most recent squares matter most; a player rereads what they just wrote.
  // Filled newest-first so that hitting the character budget drops the oldest
  // entries — filling oldest-first dropped the newest, which is backwards.
  const recent = journey.slice(-MAX_JOURNEY_ENTRIES);
  const lines: string[] = [];
  let used = 0;

  for (const entry of [...recent].reverse()) {
    const written = line(entry, language);
    if (used + written.length > budget) break;

    lines.unshift(written); // back into walking order
    used += written.length;
  }

  // Unreachable at the default budget — the longest possible entry is about 175
  // characters against 1200 — but not unreachable at a smaller one, and a
  // heading with nothing under it would be worse than saying nothing. The
  // `budget` parameter exists so this is tested rather than assumed.
  if (lines.length === 0) return '';

  const omitted = journey.length - lines.length;
  const preamble =
    omitted > 0
      ? `Where they have been (the last ${lines.length} of ${journey.length} squares):`
      : 'Where they have been:';

  return `${preamble}\n${lines.join('\n')}`;
}

export function trimToParagraph(text: string, limit = MAX_PLAN_CHARS): string {
  if (text.length <= limit) return text;

  const head = text.slice(0, limit);
  const lastBreak = head.lastIndexOf('\n\n');
  // Only respect a paragraph break if it leaves a useful amount of text.
  if (lastBreak > limit * 0.5) return withoutADanglingColon(head.slice(0, lastBreak).trim());

  // Where a sentence ends, in the scripts these texts are actually written in.
  // This knew `. ` and `。` and nothing else, so for the languages that end a
  // sentence with `।` or `۔` the fallback never matched and the text reached
  // the companion cut mid-word: Hindi plan 23 stopped inside `सर्वोच`, Urdu 23
  // inside `رہا`. The same blindness cost this repository a measurement once
  // already — a sweep for texts that end without a terminator called two
  // hundred and ninety-eight Bengali and Hindi plans broken, on the same two
  // characters.
  // `@leela/content` counts these off the texts themselves. Written by hand
  // here first, with two of the four, which is how the plan text came to reach
  // the companion cut mid-word.
  const lastStop = lastSentenceEnd(head);
  // No colon check here, and the reason is that it could never fire. This
  // branch is reached only when no sentence ends after the halfway mark, and
  // the way back from a dangling colon is that same mark — so there is never
  // anywhere to go back to. A cut on a sentence mark cannot end on a colon
  // either. Tried, measured, and taken out again rather than left as a line
  // that reads like a guard.
  return (lastStop > limit * 0.5 ? head.slice(0, lastStop + 1) : head).trim();
}

/**
 * The text back to the last thing that finished, when it ends on a promise.
 *
 * Only the paragraph branch needs this, and only it can use it: a paragraph
 * that ends on a colon gives its list in the next one, which the cut has
 * dropped. Three plans do exactly that — 64 in Hindi, Malay and Punjabi — and
 * the companion was handed *energy manifests itself in three dimensions:* and
 * no dimensions.
 */
function withoutADanglingColon(text: string): string {
  if (!/[:：]\s*$/.test(text)) return text;

  const before = Math.max(lastSentenceEnd(text, text.length - 2), text.lastIndexOf('\n\n'));

  // Only if what is left is still worth handing over. A colon in the opening
  // sentence would otherwise take the whole text away.
  return before > text.length * 0.5 ? text.slice(0, before + 1).trim() : text;
}

/**
 * The name of the language to answer in, for the model.
 *
 * English names, and deliberately not `@leela/content`'s `LANGUAGE_NAMES`,
 * which holds the endonyms — *Русский*, *日本語*, *العربية* — because those are
 * for a reader choosing a language and this is an instruction to a model.
 *
 * **Typed `Record<Language, string>`, so a twenty-third language will not
 * compile.** It was `Record<string, string>` with a `?? 'English'` behind it,
 * which is a restated list of the twenty-two — the defect this repository has
 * met more often than any other — with the one ending that reads as correct: a
 * language added to `@leela/content` would have been handed the traditional
 * text in its own script under the instruction *Answer in English*, and every
 * test would have passed.
 *
 * The fallback is gone with it. `resolveLanguage` answers `Language` and
 * nothing else, so by the time this is indexed the key is always one of the
 * twenty-two; a `??` there could only ever have covered for this map being
 * short.
 */
const LANGUAGE_NAMES: Record<Language, string> = {
  ar: 'Arabic', bn: 'Bengali', de: 'German', en: 'English', es: 'Spanish',
  fr: 'French', hi: 'Hindi', ja: 'Japanese', jv: 'Javanese', ko: 'Korean',
  mr: 'Marathi', ms: 'Malay', pa: 'Punjabi', pt: 'Portuguese', ru: 'Russian',
  ta: 'Tamil', te: 'Telugu', tr: 'Turkish', uk: 'Ukrainian', ur: 'Urdu',
  vi: 'Vietnamese', zh: 'Chinese',
};

/** How each arrival is described to the model, in plain terms. */
/**
 * How the player reached the square they are writing about.
 *
 * Each of these follows the word "They", and three of the five did not agree
 * with it: "They was brought down here by a snake." Nobody had noticed, because
 * none of them had ever been rendered — `Guide` accepted a direction and the
 * bot never passed one, so five sentences were written, wired at one end, and
 * dead. Code that never runs is code nobody has read.
 */
const ARRIVAL: Record<Direction, string> = {
  'step 🚶🏼': 'walked here one square at a time',
  'snake 🐍': 'were brought down here by a snake',
  'arrow 🏹': 'were carried up here by an arrow',
  'stop 🛑': 'could not move and remain here',
  'win 🕉': 'have reached Cosmic Consciousness',
};

/**
 * The instruction that defines the voice.
 *
 * Written in English regardless of the player's language: the model follows
 * instructions more reliably in English, and the *answer* language is stated
 * explicitly rather than implied by the prompt's own language.
 */
export function systemPrompt(context: PlanContext): string {
  const language = resolveLanguage(context.language);
  const plan = planFor(language, context.plan);
  const languageName = LANGUAGE_NAMES[language];
  // Said rather than assumed. Branching on `!== 'received'` left `standing` a
  // word the vocabulary declared and nothing ever produced — which is exactly
  // what `audit-reachable` exists to catch, and it caught this within the hour.
  const arrival: Arrival = context.arrival ?? 'standing';

  const lines = [
    'You are a companion in Leela, the game of self-knowledge.',
    '',
    'The board has 72 plans. A player rolls, lands on a plan, and sits with it:',
    'the reflection is the game, not the movement. Your part is to help them',
    'meet what they landed on — never to hurry them along it.',
    '',
    arrival === 'received'
      ? `Somebody has sent the player plan ${context.plan}: ${plan.title}, with what` +
        ' they wrote about it. The player is not standing there — this is another' +
        " person's square, handed over, and what follows is that person's words."
      : `The player is on plan ${context.plan}: ${plan.title}.`,
  ];

  /**
   * Whether this is the game beginning rather than a move within it.
   *
   * A player waiting to enter is parked on `WIN_LOKA` — the engine's own choice,
   * and the published app draws the piece there from the first screen — so a
   * `previousPlan` of 68 on any *other* square is not a square they came from.
   * Nothing moves off 68: a player who stood there has won and is out of play.
   *
   * Without this, the first report of **every game** told the companion two
   * false things — *they walked here one square at a time*, about entering the
   * board, and *they came from plan 68*, a descent from Cosmic Consciousness
   * that never happened. The ninth sighting of the 68 ambiguity, and the first
   * inside a model's instructions.
   */
  const entered = context.previousPlan === WIN_LOKA && context.plan !== WIN_LOKA;

  // Only a move has a direction, and only somebody standing somewhere came
  // from a previous square. A received square was nobody's arrival: saying
  // *they were brought down here by a snake* about a square they have never
  // been on is worse than saying nothing.
  if (arrival === 'standing' && entered) {
    lines.push('They have just entered the game; before this they were not on the board.');
  } else if (arrival === 'standing') {
    if (context.direction) {
      lines.push(`They ${ARRIVAL[context.direction]}.`);
    }
    if (context.previousPlan !== undefined && context.previousPlan !== context.plan) {
      lines.push(`They came from plan ${context.previousPlan}.`);
    }
  }
  // And the winning square is an ending only for whoever reached it. A player
  // handed 68 by somebody else has not finished anything.
  if (context.plan === WIN_LOKA && arrival === 'standing') {
    lines.push('This is the end of a game, and the start of the next one.');
  }

  const asked = (context.intention ?? '').trim().slice(0, MAX_INTENTION_CHARS);
  if (asked) {
    lines.push(
      '',
      `They are playing to answer this: ${asked}`,
      '',
      'That is theirs and not yours — not to grant, not to judge, and not to',
      'declare answered. A game of this is how somebody decides that for',
      'themselves. Let it tell you what bears on where they are; do not steer',
      'them towards it, and do not read it back to them.',
    );
  }

  // What was written here before, then the recent squares — and the second
  // never repeats the first: a square counted twice is budget spent saying one
  // thing, at the expense of the plan's own text.
  const all = context.journey ?? [];
  const returns = summariseReturns(all, context.plan, language);
  const elsewhere = summariseJourney(
    all.filter((entry) => entry.plan !== context.plan),
    language,
    Math.max(0, MAX_JOURNEY_CHARS - returns.length),
  );

  if (returns) {
    lines.push(
      '',
      returns,
      '',
      'Returning is what this game is about: the same state arrives again, and',
      'what changed between the tellings is the thing worth noticing. Do not',
      'read it back to them, and do not claim progress they have not claimed.',
    );
  }

  if (elsewhere) {
    lines.push(
      '',
      elsewhere,
      '',
      'That is their own writing, not yours to repeat back. Use it to notice',
      'what recurs, and only when it genuinely bears on where they are now.',
    );
  }

  lines.push(
    '',
    'This is the traditional text for that plan. It is the source; you are not.',
    'Draw on it, quote it where it helps, and do not contradict it. If the',
    'player asks something it does not answer, say so plainly rather than',
    'inventing doctrine.',
    '',
    '---',
    trimToParagraph(plan.body),
    '---',
    '',
    `Answer in ${languageName}.`,
    'Be brief — a few sentences, not an essay. Ask at most one question, and',
    'only when it opens something up. Do not congratulate, do not predict the',
    'future, and do not tell the player what their life means. You are not a',
    'therapist; if they describe real distress, say plainly that talking to',
    'someone qualified would serve them better than a game will.',
  );

  return lines.join('\n');
}

function assertPlan(plan: number): void {
  if (!Number.isInteger(plan) || plan < 1 || plan > TOTAL_PLANS) {
    throw new PromptError(`plan must be an integer in 1..${TOTAL_PLANS}, got ${plan}`);
  }
}

/**
 * The exchange for a player's report on the plan they are standing on.
 *
 * @param history  Earlier turns of this conversation, oldest first. Trimmed to
 *                 the most recent few so an old exchange cannot crowd out the
 *                 plan text the answer is supposed to rest on.
 */
export function reportPrompt(
  context: PlanContext,
  report: string,
  history: ReadonlyArray<Message> = [],
): Message[] {
  assertPlan(context.plan);

  const text = report.trim();
  if (text.length === 0) {
    throw new PromptError('a report cannot be empty');
  }

  return [
    { role: 'system', content: systemPrompt(context) },
    ...recentHistory(history),
    { role: 'user', content: text },
  ];
}

/** A question about the plan, rather than a report on it. */
export function questionPrompt(
  context: PlanContext,
  question: string,
  history: ReadonlyArray<Message> = [],
): Message[] {
  assertPlan(context.plan);

  const text = question.trim();
  if (text.length === 0) {
    throw new PromptError('a question cannot be empty');
  }

  return [
    { role: 'system', content: systemPrompt(context) },
    ...recentHistory(history),
    { role: 'user', content: text },
  ];
}

/** How many earlier messages to carry. Six is three exchanges. */
export const MAX_HISTORY = 6;

/**
 * How much of one earlier message to carry.
 *
 * Everything else this package puts in a prompt is clipped by it: the plan's
 * text at `MAX_PLAN_CHARS`, a journey line at `MAX_JOURNEY_ENTRY_CHARS`, the
 * intention at `MAX_INTENTION_CHARS`. The history was clipped by *count* alone,
 * so six messages of any length at all went in whole — and the prompt this
 * package so carefully bounds was bounded by whatever the caller happened to be
 * holding.
 *
 * Measured before it was chosen: the system prompt cannot pass 6,080
 * characters and the report adds 4,000, so everything this package decides
 * comes to about ten thousand. Six exchanges at twelve hundred is another seven
 * — a prompt of the same order as its own parts, rather than three times them.
 *
 * The consequence of leaving it was the quiet kind. A refused request comes
 * back as a fallback sentence, so a companion that stopped answering the
 * longest conversations would look, from inside the game, exactly like a
 * companion having a bad day.
 */
export const MAX_HISTORY_CHARS = 1200;

function recentHistory(history: ReadonlyArray<Message>): Message[] {
  // Drop any system messages from history: there is exactly one system prompt,
  // and it is built fresh from the plan the player is on now.
  return history
    .filter((m) => m.role !== 'system')
    .slice(-MAX_HISTORY)
    .map((m) =>
      m.content.length > MAX_HISTORY_CHARS
        ? { ...m, content: trimToParagraph(m.content, MAX_HISTORY_CHARS) }
        : m,
    );
}
