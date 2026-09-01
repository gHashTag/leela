import {
  LEGACY_MOBILE,
  WIN_LOKA,
  type MoveEvent,
  MAX_SEATS,
  createSession,
  currentPlayer,
  rollDie,
} from '@leela/engine';

// `resolveLanguage` used to be called here. The choice moved to `tongue.ts`,
// which weighs a stored preference against the browser's list, and the import
// stayed behind - a reader would take it for the language still being decided
// on this line.
import { directionOf, messageFor, planFor, titlesFor } from './canon';
import { describeMove, type Language } from '@leela/content';
import { revisited, seatId, writingsOn, MAX_REPORT_CHARS } from '@leela/journal';

import { Companion, type Line, type Rests } from './companion';
import { DEFAULT_DEITY, DEITIES, deityFor, deityForSeat, seatsOf } from './deities';
import { standingFor, toneOf, turnPassed } from './hud';
import { fanOffset, hopPoint, planPosition } from './layout';
import { browserStore, finishedTable, read, write, type KeptSeat } from './kept';
import { ENTITLEMENT_CHANGED, askToSubscribe, entitled, hostOf } from './hosted';
import { pathOf } from './path';
import { boxFor, roomFor } from './room';
import {
  add as keepWritten,
  readAll,
  readIntention,
  writeIntention,
} from './written';
import { RESTING_FACE, isFace, pipsFor } from './die';
import { shouldFollow } from './follow';
import { coveredBy } from './keyboard';
import { blocksOf } from './marked';
import { holdsTheDie } from './owed';
import { isLastFree, movesTaken, tollFor } from './toll';
import { askOverHttp } from './ask';
import { askOverHost, hostCanAnswer } from './asked';
import {
  LABELS,
  boardLanguage,
  alignWithChat,
  nextLanguage,
  openingStore,
  writeLanguage,
} from './tongue';
import { lookFor, other, paletteFor, preferred, remember, stored } from './look';
import { entered, throwFor, type Hop, type Thrown } from './play';
import type { SeatedPlayer } from '@leela/engine';
import { canDraw } from './drawable';
import { createBoard } from './scene';
import { atEnd, bringIntoView, dragged, stepped, type Detent, type Heights } from './sheet';
import { askForARoll, myGame, type Standing as ChatStanding } from './mine';
import { sendMyPath } from './sending';
import { askTelegramToSubscribe, launchOf, meetTelegram, nameAskOrigin, telegramOf } from './telegram';
import { css } from './theme';
import {
  hearing,
  listen,
  neuralChosen,
  neuralSounding,
  preferring,
  recognitionLangFor,
  rememberNeural,
  rememberSpeaking,
  speakChosen,
  speakers,
  speaking,
  speakingQueue,
  type Listening,
  type Mouth,
} from './voice';
import {
  LOAD_PATIENCE_MS,
  PAYLOAD_BYTES,
  WEIGHTS,
  fetchWeights,
  megabytes,
  shelfOn,
  speaksNeurally,
} from './supertonic';

/**
 * Wiring: the board draws, `Play` decides, the companion talks, and this walks
 * between them. No rule lives here — if a move looks wrong, the engine is where
 * to look, and the engine has its own tests. No sentence lives here either:
 * `hud` decides what is said and `@leela/content` holds the words.
 *
 * Two things this deliberately does not do:
 *
 *   - It does not render on a permanent loop. A board game is still for most
 *     of its life. `frames` owns when a frame is drawn.
 *   - It does not animate when the reader asked not to be animated.
 *     `prefers-reduced-motion` moves the piece instantly and still reports
 *     every step, so nothing is lost but the motion.
 */

/**
 * How long the piece takes to cross one square.
 *
 * 420 made a six take two and a half seconds — every step legible and the whole
 * throw sluggish. The steps are the point (`walk` reports each one, and a
 * reader who asked for no motion still gets them), so this is not zero; it is
 * as short as a step can be and still be seen.
 */
// --- the hosts --------------------------------------------------------------

// First, before anything could ask or paint: the build's word on where the
// companion's route lives goes onto the page, and Telegram - when it is the
// host - gets its greeting and lends the chrome its colours. Theme tokens
// swapped after first paint are a flash of the wrong room.
nameAskOrigin(globalThis as { __leelaAsk?: string }, import.meta.env.VITE_ASK_ORIGIN);
meetTelegram(telegramOf(), document.documentElement.style);

/**
 * What the chat says, asked once and shown if it answers.
 *
 * `specs/009` step 3, and the owner's «да 3D поле везде!». The bot serves this
 * player their own position behind a signature it checks; the board asks with
 * the launch Telegram signed and shows what comes back.
 *
 * **Not awaited, and nothing here can stop the board drawing.** This is the
 * boot path, on a phone, inside somebody else's webview: a board that waits on
 * a network is a black screen. `myGame` answers a shape and never throws, the
 * request gives up after eight seconds, and every outcome except a real
 * standing leaves this line hidden — including a refusal, which is the bot
 * declining to say rather than the player having no game.
 *
 * It does not adopt the game. The route serves a position, not a table, so
 * writing it into storage would make a board that claims to be the chat's game
 * and diverges from it the moment anybody rolls here. Step 4 of the spec — what
 * should happen to a game already in this browser — is the owner's to answer.
 */
const launch = launchOf(telegramOf());

/**
 * Whether this board IS the chat's game, and therefore whose die it throws.
 *
 * Null in a plain browser, and null when the bot could not be asked or answered
 * without a state — in which case everything below behaves exactly as it did
 * before step 4 was answered, which is the floor this must never fall through.
 */
let chatGame: string | null = null;

/** The server-authoritative paid state for a game adopted from the chat. */
let chatAccess: { taken: number; entitled: boolean; hosted: boolean } | null = null;

const rememberChatAccess = (standing: ChatStanding): void => {
  if (
    typeof standing.moved === 'number' &&
    typeof standing.entitled === 'boolean' &&
    typeof standing.canSubscribe === 'boolean'
  ) {
    chatAccess = {
      taken: standing.moved,
      entitled: standing.entitled,
      hosted: standing.canSubscribe,
    };
  }
};

/**
 * Say which of the five things happened, always.
 *
 * **Every outcome but success used to draw nothing**, and on 2026-08-31 that
 * cost an evening: a player looking at plan 6 in the chat and plan 41 on this
 * board had no way to learn why, and neither did anybody trying to fix it. The
 * bundle carried the code, the route answered, the guards were sound — and the
 * one thing nobody could see was WHICH branch had returned early.
 *
 * A silence covering four facts is not a small thing. `myGame` carries a closed
 * reason code — never player-visible transport prose — and this boundary maps
 * it onto the catalogue language before anything reaches the screen.
 */
const sayAboutTheChat = (key: Parameters<typeof messageFor>[1], params: Record<string, string | number> = {}): void => {
  el.inTheChat.textContent = messageFor(language, key, params);
  el.inTheChat.hidden = false;
};

void myGame({ initData: launch, fetch: (...args) => fetch(...args) }).then((mine) => {
  if (mine.kind === 'unasked') {
    // Two facts, and they read differently to a player: nobody signed this
    // launch, or the bot could not be reached. The first is not a fault.
    sayAboutTheChat(
      mine.reason === 'outside-telegram' ? 'app.chatNotOpened' : 'app.chatUnreachable',
    );
    return;
  }

  if (mine.kind === 'none') {
    sayAboutTheChat('app.chatNoGame');
    return;
  }

  el.inTheChat.textContent = messageFor(language, 'app.inTheChat', { plan: mine.standing.plan });
  el.inTheChat.hidden = false;

  /*
   * **ADOPT — `specs/009` step 4, answered 2026-08-31.**
   *
   * Settled by a screenshot of both surfaces at once: the chat reading *«Вы
   * стоите на плане 6»* and this board, same session, *41. The human plane*.
   *
   * Three conditions, and each is a way this could be wrong rather than
   * fussiness. The bot must have sent a STATE — a position cannot be played on,
   * and a deployment a few minutes behind sends only the old three fields.
   * There must be exactly ONE seat, because the chat serves this player's own
   * game and adopting it into a table of three would put somebody else's token
   * on their square. And the board must not have been played yet in this
   * session — `busy` is held while a walk is in flight, and replacing the state
   * under a walking token is how a piece ends up on a square nothing chose.
   *
   * The browser's own saved game is NOT destroyed. `leela.webgl.game` is left
   * exactly as it was; this replaces the state in memory only, so a player who
   * opens the board outside Telegram afterwards still finds the game they were
   * playing here. That was the third piece the spec demanded and the one with
   * a player's path on the other side of it.
   */
  const state = mine.standing.state;
  rememberChatAccess(mine.standing);

  // A bot too old to send a state is a bot that needs deploying, and the board
  // says so rather than quietly showing a different game.
  if (state === undefined) {
    sayAboutTheChat('app.chatOldBot');
    return;
  }

  // A table of several is not this player's single chat game, and adopting into
  // one would put somebody else's token on their square.
  if (session.players.length !== 1) {
    sayAboutTheChat('app.chatBusyTable', { seats: session.players.length });
    return;
  }

  if (busy) return;

  // A room becomes authoritative only when its game is actually adopted.
  // Old responses, multi-seat local boards and an in-flight move keep both
  // the local state and the player's explicit language choice untouched.
  if (alignWithChat(languageStore, language, mine.standing.language)) {
    window.location.reload();
    return;
  }

  chatGame = launch;
  session = { ...session, players: [{ ...session.players[0]!, state }] };
  // The board's own roll history belongs to the game it just stopped playing.
  // Kept, it would draw a die face and a trail from a different game.
  rolls = [[]];
  lastThrower = null;
  placeSeats();
  showLotus();
  showPlanText(state.loka);
  // Said on success too, so the line means *this is the chat's game* rather
  // than *here is a number from somewhere else*.
  sayAboutTheChat('app.chatAdopted', { plan: state.loka });
  showGate();
});


const HOP_MS = 260;

/**
 * How high the token's anchor sits above the web.
 *
 * Its plinth reaches `0.16 * scale` below the anchor, so this puts the base on
 * the thread rather than over it. At 0.3 the token floated, and floating is not
 * a small thing when the camera looks down at seventy degrees: the eye reads
 * the base against the knot, and a token a third of a cell up projects visibly
 * off its own square. It looked like the piece was on the wrong plan.
 */
const PIECE_LIFT = 0.184;

const need = <T extends Element>(selector: string): T => {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`the page is missing ${selector}`);
  return found;
};

const el = {
  canvas: need<HTMLCanvasElement>('#board'),
  where: need<HTMLElement>('#where'),
  planNumber: need<HTMLElement>('#plan-number'),
  planTitle: need<HTMLElement>('#plan-title'),
  progress: need<HTMLProgressElement>('#progress'),
  visiting: need<HTMLElement>('#visiting'),
  visitingText: need<HTMLElement>('#visiting-text'),
  visitingBack: need<HTMLButtonElement>('#visiting-back'),
  sheet: need<HTMLElement>('#sheet'),
  sheetBody: need<HTMLElement>('#sheet-body'),
  who: need<HTMLElement>('#who'),
  whoCount: need<HTMLElement>('#who-count'),
  whoList: need<HTMLElement>('#who-list'),
  lotus: need<HTMLButtonElement>('#lotus'),
  lotusMark: need<HTMLElement>('#lotus-mark'),
  handle: need<HTMLButtonElement>('#handle'),
  die: need<HTMLButtonElement>('#die'),
  face: need<HTMLElement>('#face'),
  say: need<HTMLElement>('#say'),
  tongue: need<HTMLButtonElement>('#tongue'),
  look: need<HTMLButtonElement>('#look'),
  speak: need<HTMLButtonElement>('#speak'),
  voice: need<HTMLButtonElement>('#voice'),
  gear: need<HTMLButtonElement>('#gear'),
  settings: need<HTMLElement>('#settings'),
  owed: need<HTMLElement>('#owed'),
  inTheChat: need<HTMLElement>('#in-the-chat'),
  toll: need<HTMLElement>('#toll'),
  tollOpen: need<HTMLButtonElement>('#toll-open'),
  planHeading: need<HTMLElement>('#plan-heading'),
  planText: need<HTMLElement>('#plan-text'),
  thread: need<HTMLElement>('#thread'),
  visitingPlan: need<HTMLElement>('#visiting-plan'),
  intention: need<HTMLButtonElement>('#intention'),
  intentionLabel: need<HTMLElement>('#intention-label'),
  intentionText: need<HTMLElement>('#intention-text'),
  carrySaid: need<HTMLElement>('#carry-said'),
  path: need<HTMLDetailsElement>('#path'),
  pathSummary: need<HTMLElement>('#path-summary'),
  pathList: need<HTMLElement>('#path-list'),
  rests: need<HTMLDetailsElement>('#rests'),
  restsSummary: need<HTMLElement>('#rests-summary'),
  restsList: need<HTMLElement>('#rests-list'),
  compose: need<HTMLFormElement>('#compose'),
  reply: need<HTMLTextAreaElement>('#reply'),
  mic: need<HTMLButtonElement>('#mic'),
  send: need<HTMLButtonElement>('#send'),
};

// --- who is reading ---------------------------------------------------------

/**
 * The stored choice outranks the browser's setting; see `tongue` for why and
 * for the rule, which is tested there.
 *
 * The same two calls `boot.ts` made before it imported this module — and it
 * has already awaited this language's plan text, which is the whole reason
 * this module is imported rather than loaded directly.
 */
const languageStore = openingStore();
const language = boardLanguage() as Language;
const titleOf = titlesFor(language);

document.documentElement.lang = language;
document.documentElement.dir = directionOf(language);
el.reply.placeholder = messageFor(language, 'app.reportPlaceholder');
el.die.setAttribute('aria-label', messageFor(language, 'app.play'));
el.visitingBack.textContent = messageFor(language, 'app.read');
el.pathSummary.textContent = messageFor(language, 'app.path');
el.intentionLabel.textContent = messageFor(language, 'app.intention');
el.planTitle.textContent = messageFor(language, 'app.waiting');
el.restsSummary.textContent = messageFor(language, 'app.restsOn');
el.say.textContent = messageFor(language, 'app.opening');

/**
 * The language switch.
 *
 * Labelled with the language it moves *to*, so the button says what pressing it
 * does rather than where you already are.
 *
 * It reloads rather than re-rendering. Every string on this screen — the board's
 * plan titles, the companion's sentences, the die's label, the model's system
 * prompt — is read from `language` once at startup and handed to objects built
 * from it. Re-translating them in place would mean threading a language change
 * through all of that, and the first one missed is a screen that is half in
 * each. A reload is a tenth of a second and cannot be half-done; the game is in
 * storage and comes back exactly where it was.
 */
const nextTongue = nextLanguage(language);
el.tongue.textContent = LABELS[nextTongue] ?? nextTongue.toUpperCase();
el.tongue.setAttribute(
  'aria-label',
  `${messageFor(language, 'app.language')}: ${LABELS[nextTongue] ?? nextTongue}`,
);
el.tongue.addEventListener('click', () => {
  writeLanguage(languageStore, nextTongue);
  window.location.reload();
});

// --- the light it is drawn in ------------------------------------------------

/**
 * Light or dark, decided before anything is drawn.
 *
 * Same order as the language, same reason: a stored choice outranks the
 * system's, and the system is only asked of a reader who has not said. The rule
 * itself is `look.ts`, where it is tested.
 *
 * `data-look` on the root is what the stylesheet reads; `paletteFor` is what
 * the board is built from. Both from one value, so the page and the scene
 * cannot end up in different lights - which is what a light page around a black
 * starfield would be.
 */
const chosenLook = lookFor(
  stored(languageStore),
  preferred((query) => window.matchMedia(query).matches),
);
document.documentElement.dataset.look = chosenLook;

/**
 * The switch, labelled with the light it moves *to* - so the button says what
 * pressing it does rather than where you already are.
 *
 * It reloads, for the reason the language switch reloads: the palette is baked
 * into geometry, materials, lights and the painted numbers when the board is
 * built. Repainting all of that in place means threading a change through every
 * one of them, and the first one missed is a board half in each light. A reload
 * cannot be half-done, and the game is in storage and comes back where it was.
 */
const nextLook = other(chosenLook);
/*
 * From the catalogue, not from here.
 *
 * This read `nextLook === 'light' ? 'Light' : 'Dark'`, which put an English
 * word on the face of a button on all twenty-two boards — and the two
 * aria-labels beside it said `Language:` and `Theme:` in English as well. The
 * comment two hundred lines below already records four strings found this way
 * and moved to `@leela/content`; these were the survivors, and nothing was
 * watching for them. `scripts/audit-spoken.mjs` is now.
 */
const lookWord = messageFor(language, nextLook === 'light' ? 'app.light' : 'app.dark');
el.look.textContent = lookWord;
el.look.setAttribute('aria-label', `${messageFor(language, 'app.theme')}: ${lookWord}`);
el.look.addEventListener('click', () => {
  remember(languageStore, nextLook);
  window.location.reload();
});

/**
 * The settings menu, opened from the one mark in the header.
 *
 * Closed by pressing the mark again, by Escape, and by touching anything else -
 * the three ways a person expects a small menu to close. Without the last one
 * it stays open over the board until the mark is found again, which on a phone
 * means it is simply in the way.
 *
 * `aria-expanded` on the button and `hidden` on the panel, so it is one state
 * said in the two places that read it.
 */
const showSettings = (open: boolean): void => {
  el.settings.hidden = !open;
  el.gear.setAttribute('aria-expanded', String(open));
};

el.gear.addEventListener('click', (event) => {
  event.stopPropagation();
  showSettings(el.settings.hidden);
});

// Inside the menu is not outside it: a click on the language button reaches
// its own handler and must not be read as "somewhere else".
el.settings.addEventListener('click', (event) => event.stopPropagation());

document.addEventListener('click', () => showSettings(false));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !el.settings.hidden) showSettings(false);
});

/**
 * The keyboard, followed.
 *
 * A page inside a `WebView` is never told the keyboard exists: the layout
 * viewport keeps the full height of the screen and the keyboard is drawn over
 * it, so the writing box — anchored to the bottom, which is where a writing box
 * belongs — is covered by the thing the player is typing with.
 *
 * The visual viewport is the one that moves. `coveredBy` turns it into pixels
 * and `--keyboard` is what the stylesheet lifts the sheet by; the arithmetic is
 * `keyboard.ts`, where it is tested.
 *
 * `fit()` runs too: the board is framed against the part of the canvas nobody
 * is standing on, and the keyboard is now standing on some of it.
 */
const followKeyboard = (): void => {
  const covered = coveredBy(window.visualViewport, window.innerHeight);
  document.documentElement.style.setProperty('--keyboard', `${covered}px`);
  fit();
};

if (window.visualViewport) {
  // Both, and both are needed: `resize` is the keyboard opening and closing,
  // `scroll` is iOS pushing the page up to keep a focused field in view — which
  // moves the box without changing the height of anything.
  window.visualViewport.addEventListener('resize', followKeyboard);
  window.visualViewport.addEventListener('scroll', followKeyboard);
}

/**
 * The paywall's two ends.
 *
 * The board cannot sell anything — a receipt is native, and a page in a web
 * view has no store to talk to. So it asks, and the app owns the screen and the
 * transaction. See `askToSubscribe` in `hosted.ts`.
 *
 * And when the app comes back entitled it fires an event rather than reloading:
 * a reload in the middle of a purchase would take the board away at the moment
 * the player has just paid for it.
 */
el.tollOpen.addEventListener('click', () => {
  if (askToSubscribe()) return;
  askTelegramToSubscribe(telegramOf());
});

window.addEventListener(ENTITLEMENT_CHANGED, () => showGate());

// --- the pieces -------------------------------------------------------------

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// What the last visit left behind, read before anything is built from it.
const store = browserStore();

/**
 * And this board's own path, offered to the chat.
 *
 * `specs/001-shared-reports` P1 — *what I wrote should be one path, wherever I
 * wrote it.* The other half of the wire the line above reads from.
 *
 * **This needs none of the decision `specs/009` step 4 is waiting on.** That
 * question is about the GAME, where a browser game and a chat game could
 * disagree and one has to win. A path cannot disagree with a path: the bot
 * merges by the moment each report was written, so nothing is replaced and
 * sending twice adds nothing the second time. There is no conflict to have an
 * opinion about, which is why this could be built while that waits.
 *
 * Not awaited, silent whatever happens, and it says nothing to the player: a
 * sync that worked is not news, and one that failed will be tried again the
 * next time the board opens. The reading above is the surface that speaks.
 */
void sendMyPath({
  initData: launch,
  entries: readAll(store),
  fetch: (...args) => fetch(...args),
});

const saved = read(store, LEGACY_MOBILE);

/*
 * The board is built in the light the reader chose; see `look.ts` — but only
 * where a browser will draw at all. Asked before `createBoard` rather than
 * caught after it: three.js constructs a renderer and only then fails, and
 * what it throws differs by version and by which blocker refused. The probe
 * answers the one question this page needs, on a canvas nobody keeps.
 *
 * With no board the game still plays: the sheet holds the plan's text, the
 * companion answers, the die is arithmetic. `board` is null and every caller
 * that draws checks it — the alternative, a fake board object, would let a
 * drawing bug reach a player as silence.
 */
const drawable = canDraw(() => document.createElement('canvas'));
if (!drawable) {
  el.canvas.hidden = true;
  el.say.textContent = messageFor(language, 'app.noBoard');
}
const board = drawable
  ? createBoard(el.canvas, undefined, undefined, paletteFor(chosenLook))
  : null;

/**
 * The table.
 *
 * The engine's `Session`: it has held several seats, a turn index and the
 * rotation between them all along. Only the seats' states come out of storage —
 * a `RuleSet` is code, and a saved game carrying one would be a saved game that
 * could disagree with the engine it is loaded into.
 */
let rolls: number[][] = [];

/**
 * Which seat threw last, or null before anyone has.
 *
 * Held here and written to storage rather than worked out on the way back:
 * after a non-six the turn has already moved on, so the seat holding the turn
 * is not the one whose number is on the die.
 */
/**
 * Whether the throw just watched earned another.
 *
 * The report gate reads this: a six keeps the turn, and asking for a reflection
 * between the throws of that chain made the screen contradict itself — the
 * sentence said throw again while the die said write first.
 */
let stillMoving = false;
let lastThrower: number | null = null;
// The fresh device's one seat, named by the journal so what it writes here is
// found under the same name on every other surface.
let session = createSession('device', [{ id: seatId(0) }], LEGACY_MOBILE);

/** Seats a table of `count`, keeping whatever the seats already had. */
const seatTable = (count: number, from: readonly KeptSeat[] = []): void => {
  const wanted = Math.min(Math.max(Math.trunc(count) || 1, 1), MAX_SEATS);
  const fresh = createSession(
    'device',
    Array.from({ length: wanted }, (_, at) => ({ id: `p${at + 1}` })),
    LEGACY_MOBILE,
  );

  session = {
    ...fresh,
    players: fresh.players.map((player, at) => {
      const kept = from[at];
      return kept ? { ...player, state: kept.state } : player;
    }),
  };
  rolls = fresh.players.map((_, at) => [...(from[at]?.rolls ?? [])]);
  // `seatsOf` decides both halves of this — the ids the session will rotate and
  // a distinct deity per seat — because it is the part that can be silently
  // wrong and `board` needs WebGL, so only this half can be held by a test.
  const seated = seatsOf(
    fresh.players.map((player) => player.id),
    fresh.players.map((_, at) => from[at]?.deity || undefined),
  );
  deities = seated.map((row) => row.deity);
  board?.setSeats(seated);
};

/** Re-seats the board from the deities the seats now hold. */
const seatBoard = (): void =>
  board?.setSeats(
    seatsOf(
      session.players.map((player) => player.id),
      deities.map((held) => held.id),
    ),
  );

let deities: Array<ReturnType<typeof deityFor>> = [];

/** Whoever holds the turn. Read rather than kept, so it cannot go stale. */
const seat = () => currentPlayer(session);

/** That seat's index, which is what the per-seat arrays are keyed by. */
const seatAt = (): number => session.turnIndex;

// The model, if the deployment put one behind `/api/ask`. Absent is a
// supported way to run: the companion says the text is there to read and the
// reflection is the player's either way.
const companion = new Companion({
  language,
  // Redraws as the answer arrives; the companion does not own the DOM.
  onProgress: () => showThread(),
  /*
   * Ask whoever can answer.
   *
   * Inside the app there is no route beside the page - the board is loaded
   * from the phone's own filesystem - so it asks the host, which holds the key
   * and makes the call itself. In a browser the route is served alongside and
   * the http path is used, unchanged.
   *
   * Both build the same prompt; only the delivery differs.
   */
  ask: (hostCanAnswer() ? askOverHost : askOverHttp)(language, (plan) => {
    const text = planFor(language, plan);
    return text.body || text.description || '';
  }),
  modelName: 'Z.AI',
});

// Said once, not on every throw: the game plays on in a window that keeps
// nothing, and a sentence repeated per move is noise over exactly the line a
// player needs beside their throw. The mini app says it the same way.
let saidUnkept = false;

const keep = (): void => {
  const kept = write(store, {
    turnIndex: session.turnIndex,
    lastThrower,
    seats: session.players.map((player, at) => ({
      id: player.id,
      deity: deities[at]?.id ?? deityForSeat(at).id,
      state: player.state,
      rolls: rolls[at] ?? [],
    })),
  });
  if (!kept && !saidUnkept) {
    saidUnkept = true;
    el.say.textContent = `${el.say.textContent ?? ''} ${messageFor(language, 'app.gameUnkept')}`.trim();
  }
};

// --- who is playing ---------------------------------------------------------

// Who was playing last time. One record holds the deity and the game, because
// two keys is two things to keep in step — and the deity outliving the board it
// was standing on is exactly the state that reads as a bug.
/** The deity of whoever holds the turn — which is what the lotus shows. */
const deity = (): ReturnType<typeof deityFor> => deities[seatAt()] ?? DEFAULT_DEITY;

/** Open or shut the roster, and say which it is for a screen reader. */
const showRoster = (open: boolean): void => {
  el.who.hidden = !open;
  el.lotus.setAttribute('aria-expanded', String(open));
};

const chooseDeity = (next: (typeof DEITIES)[number]): void => {
  // The seat holding the turn, not a global: at a table the lotus is whose go
  // it is, and choosing changes that player rather than everybody.
  deities[seatAt()] = next;
  keep();
  seatBoard();
  showLotus();
  // Chosen is chosen: the roster is a menu, and a menu that stays open after a
  // choice is a menu the player has to dismiss for no reason.
  showRoster(false);
};

el.lotus.addEventListener('click', () => showRoster(el.who.hidden));

/**
 * Opening the path puts the player where they are, not at step one.
 *
 * Three moves, and all three are needed — the first version did only the last
 * and put nothing on screen. The list is capped to the panel, because a list
 * taller than the window over it can be scrolled to a row nobody can see (341px
 * of list inside a 143px panel, measured). The panel is then scrolled to the
 * list, because the list sits below the conversation and the panel was left
 * wherever the companion put it. Only then is the newest row aimed inside the
 * list.
 *
 * Moving the panel here does not fight the thread: this runs when a player has
 * *asked* to read their path, which is the one moment the panel belongs to the
 * path rather than to the conversation. Nothing else in the path's code touches
 * `#sheet-body`.
 *
 * On `toggle` rather than inside `showPath` because that is the moment of the
 * asking — and because `showPath` is not called when the seat count changes,
 * while `seatTable` rebuilds the throws underneath it.
 */
el.path.addEventListener('toggle', () => {
  if (!el.path.open) return;
  capPath();
  follow(el.sheetBody, el.pathList);
  follow(el.pathList, el.pathList.lastElementChild);
});

// Anywhere else shuts it, which is what every other menu on a phone does.
document.addEventListener('pointerdown', (event) => {
  if (el.who.hidden) return;
  const on = event.target as Node;
  if (!el.who.contains(on) && !el.lotus.contains(on)) showRoster(false);
});

/**
 * How many are playing, one to `MAX_SEATS`.
 *
 * Changing it keeps the seats that stay exactly as they are and only makes the
 * ones being added — `apps/miniapp/src/seats.ts` argues this out: somebody
 * joining is not a reason for everybody to start again, and a game thirty days
 * old should not end because a tap on a count said so.
 */
const showSeatCount = (): void => {
  el.whoCount.replaceChildren(
    ...Array.from({ length: MAX_SEATS }, (_, at) => {
      const many = at + 1;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'seats';
      button.role = 'radio';
      button.textContent = String(many);
      button.setAttribute('aria-checked', String(many === session.players.length));
      button.setAttribute('aria-label', messageFor(language, 'app.seatTurn', { seat: many }));
      button.addEventListener('click', () => {
        const staying = session.players.map((player, seatIndex) => ({
          id: player.id,
          deity: deities[seatIndex]?.id ?? deityForSeat(seatIndex).id,
          state: player.state,
          rolls: rolls[seatIndex] ?? [],
        }));
        seatTable(many, staying);
        keep();
        showSeatCount();
        showLotus();
        showStanding(null);
        settle();
      });
      return button;
    }),
  );
};

/** The lotus wears the current seat's colour, so it says whose turn it is. */
const showLotus = (): void => {
  el.lotusMark.style.setProperty('--lotus', css(deity().colour));
  el.lotus.setAttribute(
    'aria-label',
    `${deity().latin} — ${messageFor(language, 'app.seatTurn', { seat: seatAt() + 1 })}`,
  );
  for (const button of el.who.querySelectorAll<HTMLElement>('.deity')) {
    button.setAttribute('aria-checked', String(button.dataset.deity === deity().id));
  }
};

for (const each of DEITIES) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'deity';
  button.role = 'radio';
  button.dataset.deity = each.id;
  button.setAttribute('aria-checked', 'false');
  // Devanagari and a transliteration, both: the reader of any of the other
  // twenty-one scripts gets a name they can say, and the name in the script the
  // texts are named in is not thrown away to achieve that.
  button.setAttribute('aria-label', each.latin);

  const mark = document.createElement('span');
  mark.className = 'deity-mark';
  // Through `theme.css`, so the bead in this row and the token on the board are
  // one number rather than two that have to be kept equal by hand.
  mark.style.background = css(each.colour);
  const sanskrit = document.createElement('span');
  sanskrit.className = 'deity-sanskrit';
  sanskrit.textContent = each.sanskrit;
  const latin = document.createElement('span');
  latin.className = 'deity-latin';
  latin.textContent = each.latin;

  button.append(mark, sanskrit, latin);
  button.addEventListener('click', () => chooseDeity(each));
  el.whoList.append(button);
}

seatTable(saved.seats.length || 1, saved.seats);
if (finishedTable(saved.seats)) {
  // A restored table nobody can move in is reseated — the same answer the
  // winning arm gives when the last seat finishes live. Seated as-is it is a
  // dead end with the lights on: `advance` throws at a session that is over,
  // and the first tap of the die takes that throw inside `takeTurn` with
  // `busy` held and the die disabled, so the game never answers again. The
  // saved `turnIndex` goes with the table it belonged to; the die's face
  // sorts itself out, because `showFace` reads the live `rolls`, which a
  // fresh seating has already emptied.
  seatTable(session.players.length);
} else {
  session = { ...session, turnIndex: saved.turnIndex };
}
showSeatCount();
showLotus();

// --- the sheet --------------------------------------------------------------

let detent: Detent = 'half';

/**
 * What each detent is worth in pixels, read from the stylesheet rather than
 * repeated here. `--half` is a `dvh`, so the answer changes when a phone
 * browser's toolbar slides away, and a copy of it in script would be stale
 * exactly then.
 */
const heights = (): Heights => {
  const style = getComputedStyle(el.sheet);
  const peek = parseFloat(style.getPropertyValue('--peek')) || 132;
  const full = window.innerHeight - 56;
  const half = (parseFloat(style.getPropertyValue('--half')) / 100) * window.innerHeight || full / 2;
  return { peek, half, full };
};

const showDetent = (next: Detent): void => {
  detent = next;
  el.sheet.dataset.detent = next;
  el.handle.setAttribute('aria-expanded', String(next !== 'peek'));
  fit();
};

el.handle.addEventListener('click', () => showDetent(stepped(detent)));

// Dragging the handle. Pointer events rather than touch, so a mouse, a finger
// and a stylus are one code path.
let dragFrom: { y: number; height: number } | null = null;

el.handle.addEventListener('pointerdown', (event) => {
  dragFrom = { y: event.clientY, height: el.sheet.getBoundingClientRect().height };
  el.handle.setPointerCapture(event.pointerId);
});

el.handle.addEventListener('pointermove', (event) => {
  if (!dragFrom) return;
  el.sheet.style.height = `${Math.max(0, dragFrom.height - (event.clientY - dragFrom.y))}px`;
});

const endDrag = (event: PointerEvent): void => {
  if (!dragFrom) return;
  const settled = dragged(dragFrom.height, event.clientY - dragFrom.y, heights());
  dragFrom = null;
  // Hand the height back to the stylesheet, or the detent classes stop meaning
  // anything the moment the viewport changes.
  el.sheet.style.height = '';
  showDetent(settled);
};

el.handle.addEventListener('pointerup', endDrag);
el.handle.addEventListener('pointercancel', endDrag);

// --- framing ----------------------------------------------------------------

/**
 * The board is framed against the part of the canvas nobody is standing on.
 *
 * Measured from the sheet rather than computed from the detent: the sheet is
 * mid-transition for a quarter of a second after every change, and a board that
 * only agrees with it at the end of the animation looks like it is chasing it.
 */
/**
 * The path list may not be taller than the panel that shows it.
 *
 * A scroller inside a scroller: the list carried `max-height: 42dvh`, which is
 * 341px against a 143px panel at the half detent, so scrolling a row to the
 * bottom of the list put it 200px below anything visible. The panel measures
 * itself rather than the stylesheet guessing the same number twice, and the
 * stylesheet keeps 42dvh as the fallback, so an unset property is exactly
 * today's behaviour.
 */
const capPath = (): void => {
  const panel = el.sheetBody.clientHeight;
  if (panel > 0) el.sheet.style.setProperty('--path-max', `${panel}px`);
};

const fit = (): void => {
  const sheet = el.sheet.getBoundingClientRect();
  // Which edge the sheet is on is a question the stylesheet answers and this
  // reads back, rather than a breakpoint written out twice. Below 760px it is a
  // bottom sheet spanning the width; above, a panel floated against the right.
  const alongTheBottom = sheet.left <= 1;
  // Measured, not guessed: the header's height is its safe-area padding plus a
  // plan title that wraps or does not, and a number written here would be right
  // on one phone. The top row of the board - 72, 71, 70 - was sitting under it.
  const header = el.where.getBoundingClientRect();

  board?.resize(window.innerWidth, window.innerHeight, {
    top: Math.max(0, header.bottom),
    bottom: alongTheBottom ? Math.max(0, window.innerHeight - sheet.top) : 0,
    right: alongTheBottom ? 0 : Math.max(0, window.innerWidth - sheet.left),
  });

  capPath();
};

window.addEventListener('resize', fit);
el.sheet.addEventListener('transitionend', (event) => {
  if (event.propertyName === 'height') fit();
});

// --- what the screen says ---------------------------------------------------

const paragraphs = (text: string): DocumentFragment => {
  const fragment = document.createDocumentFragment();
  for (const part of text.split(/\n{2,}/)) {
    const trimmed = part.trim();
    if (trimmed.length === 0) continue;
    const p = document.createElement('p');
    p.textContent = trimmed;
    fragment.append(p);
  }
  return fragment;
};

const showPlanText = (plan: number): void => {
  const text = planFor(language, plan);
  el.planHeading.textContent = `${plan} · ${text.title}`;
  el.planText.replaceChildren(paragraphs(text.body || text.description || ''));
};

/**
 * Brings something into view inside the scroller that actually holds it.
 *
 * This was `scrollIntoView({ block: 'nearest' })` and it did not arrive. On a
 * fresh load one throw left the companion's answer at 685–856 against a panel
 * whose visible box ends at 745, with the scroller still at zero — measured on
 * the page, both ways: the smooth variant leaves it at zero, the instant one
 * moves it. The proactive half of this game was being written below the fold.
 *
 * There are two scrollers, which is why this takes one rather than naming it.
 * The thread's is `#sheet-body`, because `.thread` has no overflow and spills
 * into the panel. The path's is `#path-list` itself, which carries its own
 * `overflow-y: auto`. Writing one never moves the other — measured — and that
 * is the whole reason `scrollIntoView` is not used: it walks *every* ancestor
 * scroller, so aiming a path row would drag the panel and undo the thread.
 *
 * Rects rather than `offsetTop` because the offset parent is not the scroller,
 * and a position measured against the wrong box is the kind of wrong that looks
 * like a browser bug.
 */
const follow = (view: HTMLElement, line: Element | null): void => {
  if (!line) return;
  const box = line.getBoundingClientRect();
  const around = view.getBoundingClientRect();
  const to = bringIntoView(view, {
    top: box.top - around.top + view.scrollTop,
    height: box.height,
  });
  if (to !== null) view.scrollTop = to;
};

const showThread = (): void => {
  const view = companion.view();

  /*
   * The spoken half rides the repaint.
   *
   * `onProgress` fires this on every chunk and `say(...).then(showThread)`
   * fires it once more when the answer resolves, so this one spot sees the
   * streamed text grow and then sees it gone — which is exactly a feed and a
   * flush. Tapping the stream here rather than in a second callback keeps one
   * consumer of `view.streaming`; `flush` is idempotent, so every repaint
   * that is not streaming — arrivals, throws, visits — costs nothing.
   */
  if (spoken && speakAloud) {
    if (view.status === 'thinking' && view.streaming) spoken.feed(view.streaming.text);
    else spoken.flush();
  } else if (view.status === 'thinking') {
    // Said once per answer that nobody hears: the two reasons a board goes
    // quiet - no mouth on this platform, or the toggle off - look identical
    // from outside, and telling them apart from a screenshot cost an hour.
    console.log(`[voice] not speaking: mouth=${spoken !== null}, aloud=${speakAloud}`);
  }

  const fragment = document.createDocumentFragment();

  for (const line of view.lines) fragment.append(bubble(line));

  if (view.status === 'thinking') {
    const live = view.streaming;
    // Three dots only until there is something to show. Once the model starts
    // speaking, the dots are worse than nothing: they say "waiting" over text
    // that is already arriving.
    if (live && (live.text || live.thinking)) {
      const bubble = document.createElement('div');
      bubble.className = 'bubble companion streaming';

      /*
       * A mark that moves, for as long as it is still moving.
       *
       * The three dots below only ever showed before the first token: once
       * reasoning began arriving they were replaced by it, and a page of grey
       * italics with nothing animating on it reads as finished. This says
       * *thinking* rather than *thought*, and it is the first thing in the
       * bubble so it is not scrolled away by the reasoning under it.
       */
      const working = document.createElement('p');
      working.className = 'working';
      working.append(document.createElement('i'));
      const label = document.createElement('span');
      label.textContent = messageFor(language, 'app.thinkingNow');
      working.append(label);
      bubble.append(working);

      if (live.thinking) {
        const thought = document.createElement('div');
        thought.className = 'thinking-text';
        // Marked so the pass below can find it after the fragment is in the
        // document — `scrollHeight` is 0 on a node that has not been laid out.
        thought.dataset.live = 'true';
        // The tail, not the head: the newest thought is the one worth reading,
        // and reasoning runs long.
        //
        // It stays once the answer starts, shorter. It used to be dropped at
        // the first word of the answer - `live.thinking && !live.text` - so the
        // one thing a player had been watching vanished at the moment it became
        // possible to compare it with what was said. Above the answer and
        // dimmed: still there, no longer the thing being read.
        // Every step, not a tail, and read rather than printed: the asterisks
        // a model writes are bullets and emphasis, and the screen used to show
        // them as punctuation. The box scrolls and pins itself to the bottom in
        // `style.css`, so a long reasoning stays readable without pushing the
        // answer off the screen.
        thought.replaceChildren(reasoned(live.thinking));
        bubble.append(thought);
      }

      if (live.text) {
        const said = document.createElement('p');
        said.textContent = live.text;
        bubble.append(said);
      }

      fragment.append(bubble);
    } else {
      const waiting = document.createElement('div');
      waiting.className = 'thinking';
      waiting.append(...['', '', ''].map(() => document.createElement('i')));
      fragment.append(waiting);
    }
  }

  /*
   * The reasoning box keeps its own place, and keeps the reader's.
   *
   * Measured before the swap and applied after: `scrollHeight` is 0 on a node
   * that has not been laid out, so the question has to be asked of the box that
   * is on screen now and answered on the one that replaces it.
   *
   * `shouldFollow` is the rule and it is tested in `follow.ts`: follow only
   * while the reader is already at the bottom, because scrolling up is what
   * says *I am reading this*.
   */
  const living = el.thread.querySelector<HTMLElement>('.thinking-text[data-live]');
  const wasFollowing = living === null || shouldFollow(living);
  const wasScrolled = living?.scrollTop ?? 0;

  el.thread.replaceChildren(fragment);

  const nowLive = el.thread.querySelector<HTMLElement>('.thinking-text[data-live]');
  if (nowLive) {
    nowLive.scrollTop = wasFollowing ? nowLive.scrollHeight : wasScrolled;
  }

  follow(el.sheetBody, el.thread.lastElementChild);

  showRests(view.rests, view.status, view.note);
  // Before the board the rests panel is hidden, so a doorstep note - the
  // answer to a question typed before the first six - would be set in the
  // model and shown nowhere. It borrows the opening sentence's place, and the
  // next throw or arrival rewrites that place in the ordinary way.
  if (view.note && !view.rests) el.say.textContent = view.note;
  showGate();
};

/**
 * Closes the die until the square has been written about, and says so.
 *
 * The rule is in `owed`, tested there; this only reflects it. Three surfaces
 * carry it because a disabled control with no explanation is the worst of both
 * — the die itself, its label for a screen reader, and a line in the sheet
 * where the player is already reading.
 */
const showGate = (): void => {
  const rests = companion.view().rests;
  const standing = {
    plan: rests ? rests.plan : null,
    written: rests ? writingsOn(readAll(store), rests.plan).length : 0,
    rollsAgain: stillMoving,
  };
  const held = holdsTheDie(standing);

  /*
   * Two gates, and they are different in kind.
   *
   * `held` is the game's own rule: write about the square you are standing on
   * and the die opens. `toll` is the app asking to be paid. Both can shut the
   * die and only one of them can be answered by writing, so the sentence has to
   * say which — a player told to write, who writes, and finds the die still
   * shut, has been lied to.
   *
   * The account comes first when both are due: it is the thing they can do
   * something about without a card.
   */
  const toll = tollFor(chatAccess ?? {
    // Moves, not throws. A six is what puts you on the board, and charging for
    // the throws that failed to find one meant 58% of new players met the
    // paywall having never stood on a plane.
    taken: movesTaken(rolls),
    entitled: entitled(),
    hosted: hostOf() !== null,
  });

  const shut = held || !toll.mayThrow;
  el.die.disabled = shut || busy;
  el.die.classList.toggle('waiting', shut);
  el.die.setAttribute(
    'aria-label',
    held
      ? messageFor(language, 'app.owedShort')
      : toll.mayThrow
        ? messageFor(language, 'app.play')
        : messageFor(language, 'app.tollDue'),
  );

  el.owed.textContent = held ? messageFor(language, 'app.owed') : '';
  el.owed.hidden = !held;

  // Said on the last free move and when they have run out; silent otherwise,
  // and silent for anybody who will never be asked - `left` is null for them.
  const say = !toll.mayThrow
    ? messageFor(language, 'app.tollDue')
    : isLastFree(toll)
      ? messageFor(language, 'app.tollLast')
      : '';
  el.toll.textContent = say;
  el.toll.hidden = say === '';

  el.tollOpen.textContent = messageFor(language, 'app.tollOpen');
  el.tollOpen.hidden = toll.mayThrow;
};

/*
 * Where a line came from, in the reader's language.
 *
 * These were four English strings written straight into this file, one line
 * above the `messageFor` that renders everything else — so a Russian board
 * printed FROM THE TEXT and MODEL beside Russian sentences, and the App
 * Store's Russian screenshots carried English chrome. Read from the catalogue
 * now, like every other word on the screen.
 */
const SOURCE_LABEL: Readonly<Record<Line['source'], string>> = {
  canon: messageFor(language, 'app.fromText'),
  model: messageFor(language, 'app.fromModel'),
  fallback: messageFor(language, 'app.unanswered'),
  player: '',
  // Dated rather than labelled: what matters about your own earlier writing is
  // *when*, and `bubble` fills this in from the line's own timestamp.
  written: '',
};

/** A date a player can place, in their own language. */
const on = (at: number): string =>
  new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(at));

/**
 * The companion's working, as nodes.
 *
 * Built rather than assigned: this is text a model wrote, and `innerHTML` on it
 * is handing a stranger the page. `blocksOf` returns structure and every string
 * below lands in `textContent`, so the worst a malformed line can do is come
 * out as itself.
 */
const reasoned = (text: string): DocumentFragment => {
  const fragment = document.createDocumentFragment();

  for (const block of blocksOf(text)) {
    const node = document.createElement(block.kind === 'item' ? 'li' : 'p');
    if (block.kind === 'item' && block.depth > 0) {
      node.dataset.depth = String(block.depth);
    }

    for (const run of block.runs) {
      const part = document.createElement(run.strong ? 'strong' : run.emphasis ? 'em' : 'span');
      part.textContent = run.text;
      node.append(part);
    }

    fragment.append(node);
  }

  return fragment;
};

const bubble = (line: Line): HTMLElement => {
  const node = document.createElement('div');
  node.className = 'line';
  node.dataset.who = line.who;
  // The provenance is on the bubble, not in a legend somewhere. A model's
  // sentence and the traditional text of a plan carry very different weight,
  // and a screen that renders them identically has quietly lent one the
  // authority of the other.
  node.dataset.source =
    line.source === 'written' && line.at !== undefined ? on(line.at) : SOURCE_LABEL[line.source];

  /*
   * How it got there, kept and openable.
   *
   * Folded rather than printed: reasoning runs many times the length of the
   * answer, and a thread where every reply is preceded by a page of working is
   * a thread nobody reads. Closed by default, in place, and it holds every step
   * rather than the tail — the tail is what the live view shows while there is
   * nothing else to look at; this is the record.
   */
  if (line.thinking) {
    const shown = document.createElement('details');
    shown.className = 'reasoning';

    const label = document.createElement('summary');
    label.textContent = messageFor(language, 'app.thinking');
    shown.append(label);

    const steps = document.createElement('div');
    steps.className = 'reasoning-steps';
    steps.append(reasoned(line.thinking));
    shown.append(steps);

    node.append(shown);
  }

  const said = document.createElement('span');
  said.textContent = line.text;
  node.append(said);

  if (line.more) {
    // The whole plan, opened in place. `app.read` is the mini app's own label
    // for this exact control, so the two surfaces ask for the same thing in the
    // same words in twenty-two languages.
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'more';
    more.textContent = messageFor(language, 'app.read');
    more.addEventListener('click', () => {
      said.replaceChildren(paragraphs(line.more ?? ''));
      more.remove();
    });
    node.append(more);
  }

  return node;
};

const row = (term: string, value: string, empty = false): void => {
  const dt = document.createElement('dt');
  dt.textContent = term;
  const dd = document.createElement('dd');
  dd.textContent = value;
  dd.dataset.empty = String(empty);
  el.restsList.append(dt, dd);
};

/**
 * What the companion is working from.
 *
 * Every field, including the ones with nothing in them — `absent is not zero`,
 * and a context panel that hides its holes is a panel that cannot be audited.
 */
const showRests = (rests: Rests | null, status: string, note: string | null): void => {
  el.restsList.replaceChildren();
  if (!rests) {
    el.rests.hidden = true;
    return;
  }
  el.rests.hidden = false;

  row('plan', `${rests.plan} · ${rests.title}`);
  row('text', rests.canonChars > 0 ? `${rests.canonChars} characters` : 'none', rests.canonChars === 0);
  row('language', rests.language);
  row('arrived by', rests.direction || 'not yet', !rests.direction);
  row('from', rests.previousPlan === null ? 'nowhere yet' : String(rests.previousPlan), rests.previousPlan === null);
  row('squares walked', String(rests.journey));
  row('model', rests.model ?? 'none configured here', rests.model === null);
  if (note) row('last refusal', note);
  row('answering', status);
};

/**
 * Where the player has been, derived from the throws.
 *
 * Never stored as squares: `pathOf` replays the rolls through the engine, so
 * this list cannot disagree with the rules that produced it. `revisited` is
 * `packages/journal`'s, because coming back to a square is what Leela is about
 * and the corpus already had the function that finds it.
 */
/**
 * @param at whose path. Defaults to the seat holding the turn, which is right
 *        at rest — but not straight after a throw, when the turn has already
 *        passed and the panel would list the next player's throws underneath a
 *        header narrating the mover's move.
 */
const showPath = (at: number = seatAt()): void => {
  // Asked before the rebuild: a list already at its end keeps following, and one
  // the player scrolled up to read is left where they left it. `replaceChildren`
  // keeps `scrollTop`, so their place is theirs to lose, not this function's.
  const following = atEnd(el.pathList);
  const steps = pathOf(rolls[at] ?? [], LEGACY_MOBILE);
  el.path.hidden = steps.length === 0;
  el.pathSummary.textContent = `${messageFor(language, 'app.path')} · ${steps.length}`;

  const again = new Map(
    revisited(steps.filter((step) => step.moved).map((step) => ({ plan: step.to }))).map(
      (revisit) => [revisit.plan, revisit.times],
    ),
  );

  el.pathList.replaceChildren(
    ...steps.map((step) => {
      const row = document.createElement('li');
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'step';
      open.dataset.moved = String(step.moved);
      open.dataset.tone = toneOf(step.event.direction);

      const ordinal = document.createElement('span');
      ordinal.className = 'step-ordinal';
      ordinal.textContent = `${step.ordinal}.`;

      const where = document.createElement('span');
      where.className = 'step-where';
      /**
       * `describeMove`, not a key picked here.
       *
       * The first version of this row chose `app.noRoom` for every throw that
       * did not move anyone, so a player still waiting for their six was told
       * there was *not enough room* — a rule they were not under yet. That is
       * the exact mistake `describeMove` was extracted to stop, and its own
       * comment records it having been made once already. Two surfaces building
       * the sentence themselves is how they end up disagreeing.
       */
      where.textContent = describeMove(language, step.event, titleOf);

      open.append(ordinal, where);

      const times = again.get(step.to);
      if (step.moved && times) {
        const mark = document.createElement('span');
        mark.className = 'step-again';
        mark.textContent = `×${times}`;
        mark.title = messageFor(language, 'app.cameBack');
        where.append(' ', mark);
      }

      open.addEventListener('click', () => visit(step.to));
      row.append(open);
      return row;
    }),
  );

  if (following) follow(el.pathList, el.pathList.lastElementChild);
};

/**
 * What the player is playing for, and the chance to say it.
 *
 * Asked rather than demanded. The published app blocks the board until there is
 * one — `if (!prof.intention) navigate('CHANGE_INTENTION_SCREEN', { blockGoBack: true })`
 * — and that is a gate in front of a game somebody opened to play. Here it sits
 * above the conversation as an invitation, and it is answerable at any point,
 * including after forty squares, which is when most people know what they were
 * actually asking.
 */
const showIntention = (): void => {
  const asked = readIntention(store);
  el.intention.dataset.asked = String(asked !== null);
  el.intentionText.textContent = asked ?? messageFor(language, 'app.reportPlaceholder');
};

el.intention.addEventListener('click', () => {
  const asked = window.prompt(messageFor(language, 'app.intention'), readIntention(store) ?? '');
  if (asked === null) return;
  // `writeIntention` says no both for a question the game cannot hold and for a
  // storage that refused. The player is in front of us, so they are told.
  el.carrySaid.textContent = writeIntention(store, asked)
    ? ''
    : messageFor(language, 'app.reportEmpty');
  showIntention();
});

/**
 * @param waiting true when the face is being restored rather than thrown.
 *
 * `data-thrown` is not "there is a face"; it is what the stylesheet uses to run
 * the pulse that says the die is a control worth pressing. A returning player
 * has a number to look at and still has to throw, so the two came apart the
 * moment the face survived a reload: the pips come back, the invitation stays.
 */
const showFace = (value: number, waiting = false, thrown = true): void => {
  const cells = pipsFor(value);
  el.die.dataset.thrown = String(isFace(value) && !waiting);
  el.face.replaceChildren(
    ...Array.from({ length: 9 }, (_, at) =>
      document.createElement(cells.includes(at + 1) ? 'i' : 'span'),
    ),
  );
  // The number is said only when it was actually thrown. The resting six is a
  // face on a control, not a result, and reading it out as one would tell
  // somebody who cannot see the screen that they had thrown a six.
  el.die.setAttribute(
    'aria-label',
    isFace(value) && thrown
      ? `${messageFor(language, 'app.play')} · ${value}`
      : messageFor(language, 'app.play'),
  );
};

/**
 * @param of whose standing this is. Defaults to whoever holds the turn, which
 *        is right everywhere except straight after a throw — `advance` rotates,
 *        so by then the current player is the *next* seat and the mover has to
 *        be named.
 */
const showStanding = (event: MoveEvent | null, of: SeatedPlayer = seat()): void => {
  const standing = standingFor(language, of.state, titleOf, event);
  el.planNumber.textContent = standing.number;
  el.planTitle.textContent = standing.title;
  el.progress.value = standing.progress;
  el.say.textContent = standing.say;
  el.say.dataset.tone = standing.tone;
};

// --- reading a square you are not on ---------------------------------------

let visiting: number | null = null;

const visit = (plan: number): void => {
  visiting = plan;
  showPlanText(plan);
  el.visitingText.textContent = `${plan} · ${titleOf(plan)}`;
  el.visiting.hidden = false;
  el.visitingPlan.hidden = false;
  el.thread.hidden = true;
  el.sheetBody.scrollTop = 0;
  board?.focus(plan);
  board?.draw();
  if (detent === 'peek') showDetent('half');
};

const stopVisiting = (): void => {
  visiting = null;
  el.visiting.hidden = true;
  el.visitingPlan.hidden = true;
  el.thread.hidden = false;
  board?.focus(entered(seat()) ? seat().state.loka : null);
  board?.draw();
};

el.visitingBack.addEventListener('click', stopVisiting);

// A tap on a square opens it. A drag orbits the camera, so the two are told
// apart by how far the pointer travelled — not by which one fired first.
let pressed: { x: number; y: number } | null = null;
el.canvas.addEventListener('pointerdown', (event) => {
  pressed = { x: event.clientX, y: event.clientY };
});
el.canvas.addEventListener('pointerup', (event) => {
  if (!pressed) return;
  const travelled = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y);
  pressed = null;
  if (travelled > 8) return;
  // `undefined` where there is no board to pick from, `null` where the tap
  // landed off the board: neither is a square, and both mean the same here.
  const plan = board?.planAt(event.clientX, event.clientY);
  if (plan === null || plan === undefined) return;
  if (entered(seat()) && plan === seat().state.loka) stopVisiting();
  else visit(plan);
});

// --- the throw --------------------------------------------------------------

/**
 * Every seat's token, on the square that seat stands on.
 *
 * This surface played one seat, so every placement named the constant `SEAT`
 * and one token was the whole board. The model seats a table now — and a board
 * that moves only `p1` leaves the other tokens at the origin, stacked on each
 * other one square from the middle. It does not read as three pieces nobody
 * placed. It reads as a piece on the wrong plan, which is the defect this
 * repository has already shipped once.
 *
 * A seat that has not entered has no token on the board: in Leela you are not
 * in play until a six puts you there, and a winner has left. `entered` is that
 * question, and it is the same one the die and the companion ask.
 */
const placeSeats = (): void => {
  // How many stand on each square, before any of them is placed: a token's
  // offset depends on how many it is sharing with, which is not known until
  // every seat has been read.
  const sharing = new Map<number, number>();
  for (const player of session.players) {
    if (!entered(player)) continue;
    sharing.set(player.state.loka, (sharing.get(player.state.loka) ?? 0) + 1);
  }

  const placed = new Map<number, number>();
  for (const player of session.players) {
    const piece = board?.token(player.id);
    if (!piece) continue;
    piece.visible = entered(player);
    if (!piece.visible) continue;

    const plan = player.state.loka;
    const at = placed.get(plan) ?? 0;
    placed.set(plan, at + 1);

    const centre = planPosition(plan);
    const fan = fanOffset(at, sharing.get(plan) ?? 1);
    piece.position.set(centre.x + fan.x, PIECE_LIFT, centre.z + fan.z);
  }
};

const settle = (): void => {
  placeSeats();
  if (!visiting) board?.focus(entered(seat()) ? seat().state.loka : null);
  board?.draw();
};

/**
 * Walks one hop, resolving when the piece has landed.
 *
 * Takes whose piece: at a table the token that moves is the one belonging to
 * the seat that threw, and that is decided before the throw resolves rather
 * than read back afterwards — `throwFor` returns a new session, and reading the
 * mover off it is reading it after the turn may have moved on.
 */
const walk = (hop: Hop, mover: string): Promise<void> => {
  const from = planPosition(hop.from);
  const to = planPosition(hop.to);

  if (reducedMotion.matches || hop.from === hop.to) {
    board?.token(mover)?.position.set(to.x, PIECE_LIFT, to.z);
    board?.draw();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const started = performance.now();
    let done = false;

    const land = (): void => {
      if (done) return;
      done = true;
      clearTimeout(backstop);
      board?.token(mover)?.position.set(to.x, PIECE_LIFT, to.z);
      board?.draw();
      resolve();
    };

    /**
     * A turn must not be able to hang on an animation.
     *
     * `requestAnimationFrame` does not fire in a hidden tab. Switch away
     * mid-hop and this promise never settles, so `busy` stays true and the die
     * stays disabled — for as long as the tab is in the background. It does
     * recover on return, which is exactly what makes it easy to miss: it was
     * found only because a headless pane kept the page hidden and twenty-three
     * throws in a row appeared to produce nothing.
     *
     * `setTimeout` is throttled in the background but it still fires, so the
     * turn finishes either way. The piece is put on its square rather than left
     * wherever the last frame left it.
     */
    const backstop = setTimeout(land, HOP_MS * 4);

    const frame = (now: number): void => {
      if (done) return;
      const t = Math.min(1, (now - started) / HOP_MS);
      const point = hopPoint(from, to, t);
      board?.token(mover)?.position.set(point.x, point.y + PIECE_LIFT, point.z);
      board?.draw();
      if (t < 1) requestAnimationFrame(frame);
      else land();
    };
    requestAnimationFrame(frame);
  });
};

let busy = false;

/**
 * Appends who throws next, when the throw actually changed hands.
 *
 * `turnPassed` answers null when the mover still holds the turn, so this is
 * safe to call from every arm that leaves the table standing. It is read off
 * the session as it is *now*, which is why it must not be called after a
 * reseat: the seat it would name is one nobody is sitting in yet.
 */
const sayNext = (turn: Thrown): void => {
  const passed = turnPassed(language, turn.seatId, seat().id, seatAt());
  if (passed !== null) el.say.textContent = `${el.say.textContent} · ${passed}`;
};

const takeTurn = async (): Promise<void> => {
  if (busy) return;
  busy = true;
  el.die.disabled = true;
  if (visiting) stopVisiting();

  const threw = seatAt();
  lastThrower = threw;
  const mover = seat().id;

  /*
   * **The die is the chat's when the game is the chat's.**
   *
   * `specs/009` step 4. Reading the chat's game and then throwing a local die
   * gives two games again one roll later — the bot's die is seeded per room and
   * advanced by `rollsTaken`, so a value invented here would replay a different
   * game from the one the chat shows.
   *
   * The board still WALKS it. `throwFor` applies the value with the same
   * `@leela/engine` the bot just applied it with, over the same `GameState`, so
   * the answer is the one already stored — the animation is a re-derivation,
   * not a second opinion.
   *
   * A refusal is the player's to read: *not your turn*, *write what this plan
   * brings up first*. It arrives in their own language because the bot composed
   * it, and it leaves the game untouched.
   */
  let value: number;
  if (chatGame !== null) {
    const asked = await askForARoll({ initData: chatGame, fetch: (...args) => fetch(...args) });

    if (asked.kind !== 'rolled') {
      el.say.textContent = asked.kind === 'refused'
        ? asked.why
        : messageFor(language, asked.reason === 'outside-telegram' ? 'app.chatNotOpened' : 'app.chatUnreachable');
      el.say.dataset.tone = 'step';
      el.die.disabled = false;
      busy = false;
      return;
    }
    rememberChatAccess(asked.rolled.standing);
    value = asked.rolled.roll;
  } else {
    value = rollDie();
  }

  const turn = throwFor(session, value);
  // Set before anything draws. Setting it after meant the gate ran on the
  // previous throw's answer, so a six re-enabled the die while the labels
  // beside it still read 'waiting for your reflection'.
  stillMoving = turn.rollsAgain;
  session = turn.session;
  rolls[threw]?.push(turn.roll);
  showFace(turn.roll);
  if (!reducedMotion.matches) {
    el.die.classList.add('rolling');
    el.die.addEventListener('animationend', () => el.die.classList.remove('rolling'), { once: true });
  }
  board?.focus(null);

  for (const hop of turn.hops) await walk(hop, mover);

  // Entering, winning and leaving all change *which* tokens belong on the board,
  // not just where one of them is — so the table is re-placed once the walk is
  // over rather than only the piece that walked.
  placeSeats();

  // Everything below reports the seat that *threw*. After `advance` the
  // session's current player is whoever throws next, so reading the board back
  // through `seat()` here told the player about somebody else's square: the
  // number said 10 while the sentence under it said an arrow had carried them
  // to 50. One seat at a table of one is always both, which is why this
  // survived every pass before there was a table.
  const { moved } = turn;
  board?.focus(entered(moved) ? moved.state.loka : null);
  showStanding(turn.event, moved);

  // The companion speaks on every landing, not on request. The game's own loop
  // puts a reflection between one throw and the next; a companion that waits to
  // be addressed turns that into a form nobody fills in.
  if (entered(moved)) {
    companion.arrived(
      moved.state.loka,
      turn.event,
      el.say.textContent ?? '',
      writingsOn(readAll(store), moved.state.loka),
    );
    showThread();
  }
  showPath(threw);
  // The mark beside the die is the only thing that says whose throw is next,
  // and it was not being redrawn when the turn passed — so it showed the player
  // who had just gone.
  showLotus();

  if (turn.won) {
    // Won, and still standing on 68 until the next throw. Say so, keep the
    // text of the winning plan on screen, and let the player start again when
    // they are ready rather than resetting the board underneath them.
    el.say.textContent = messageFor(language, 'app.won');
    el.say.dataset.tone = 'win';
    if (turn.tableOver) {
      // Everybody has finished, so a fresh table is what the die is for next.
      // This used to run on `won` alone: at a table of three, the first player
      // to reach 68 seated a new session over two games in progress. The
      // engine has always gone on rotating past a finished seat — `tableOver`
      // is `isSessionOver`, and at a table of one it is still `won`.
      seatTable(session.players.length);
      companion.reset();
    } else {
      // The table carries on, so it has to say who carries it on. A win with
      // nothing after it reads, on the winner's device, as the end of the game.
      sayNext(turn);
    }
  } else if (turn.rollsAgain) {
    // A six keeps the turn, and the player has to be told — otherwise the only
    // sign is that the die still works, which reads as the app not having
    // registered the throw.
    //
    // `audit-unread` is what caught this: rewriting this file for the one-screen
    // layout dropped the sentence, and `rollsAgain` became a field written and
    // never read. `roll.again` is the catalogue's own wording, in English and
    // Russian, and the bot has been saying it since it was written.
    el.say.textContent = `${el.say.textContent} · ${messageFor(language, 'roll.again')}`;
  } else {
    // The turn has moved to somebody else, and until now only the colour of the
    // mark said so.
    sayNext(turn);
  }

  // Written after the turn has fully resolved, not after the roll: a game saved
  // mid-hop is a game that resumes having taken a snake it was still sliding
  // down, and `seat().state` is only the whole truth once the walk is over.
  keep();

  board?.draw();
  // Through the gate, not directly: setting `disabled` here bypassed the one
  // place that also writes the label, and left a working die labelled as
  // waiting.
  busy = false;
  showGate();
};

el.die.addEventListener('click', () => void takeTurn());
window.addEventListener('keydown', (event) => {
  // Not while the player is writing, and not when the die already has focus —
  // or the browser fires both this and the button's own click.
  if (document.activeElement === el.die) return;
  if (document.activeElement === el.reply) return;
  if (event.code === 'Space' || event.code === 'Enter') {
    event.preventDefault();
    void takeTurn();
  }
});

// --- writing back -----------------------------------------------------------

const grow = (): void => {
  /*
   * An empty field is measured too, and its reading is believed only if it is
   * the size a sentence could be.
   *
   * This measured `scrollHeight` unconditionally once, and it is called at
   * startup - while the sheet is still animating into its detent, so the
   * measurement is taken against a box that is not yet the box. It read 598px
   * on an empty field, the stylesheet clamped that to `max-height: 30dvh`, and
   * the writing box stood 244 pixels tall over the board with nothing in it,
   * every launch, until somebody typed.
   *
   * The answer then was to stop measuring an empty field at all, and THAT COST
   * THE PLACEHOLDER: at 375 CSS pixels the box is 46px and *"What does this
   * plan bring up?"* needs 70, so on a phone the game's own question was cut
   * off half way through, on the one control the die waits for. `roomFor` is
   * the rule that keeps both - it takes a plausible reading and drops an
   * implausible one, which leaves the stylesheet's `min-height` standing
   * exactly as it did before.
   */
  el.reply.style.height = 'auto';
  const style = getComputedStyle(el.reply);
  // `scrollHeight` excludes the border and the height being set includes it.
  // See `boxFor` — the typed path was two pixels short of its own content from
  // the day it was written, and both branches go through the same arithmetic.
  const borderY =
    (Number.parseFloat(style.borderTopWidth) || 0) +
    (Number.parseFloat(style.borderBottomWidth) || 0);

  if (el.reply.value === '') {
    const room = roomFor({
      measured: el.reply.scrollHeight,
      floor: Number.parseFloat(style.minHeight) || 0,
      lineHeight: Number.parseFloat(style.lineHeight) || 0,
      borderY,
    });

    el.reply.style.height = room === null ? '' : `${room}px`;
  } else {
    el.reply.style.height = `${boxFor(el.reply.scrollHeight, borderY)}px`;
  }

  el.send.disabled = el.reply.value.trim().length === 0;
};

el.reply.addEventListener('input', grow);
el.reply.addEventListener('keydown', (event) => {
  // Enter sends, Shift+Enter breaks the line — the convention of every chat the
  // player already uses.
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    el.compose.requestSubmit();
  }
});

el.compose.addEventListener('submit', (event) => {
  event.preventDefault();
  const said = el.reply.value.trim().slice(0, MAX_REPORT_CHARS);
  el.reply.value = '';
  grow();
  if (said.length === 0) return;

  /**
   * Kept before it is answered.
   *
   * The reports *are* the game — the reason to come back to a square is to find
   * out what you said the last time you stood on it — and until now this box
   * fed the companion and nothing else, so a reflection written on plan 34 was
   * gone when the tab was. Only while the player is on the board: a note about
   * a square nobody is standing on has no square to belong to.
   */
  // The square the companion asked about, not the seat holding the turn: by the
  // time a reflection is typed the turn has usually passed, and filing it under
  // `seat()` files one player's writing against another player's square. The
  // companion's `rests` is the plan the thread is actually about, and it is
  // only set once somebody has landed — which is the same guard the seat check
  // was making, stated in terms of the thing being written about.
  const about = companion.view().rests;
  if (about) keepWritten(store, { plan: about.plan, text: said, at: Date.now() });

  void companion.say(said).then(showThread);
  showThread();
});

// --- the voice ---------------------------------------------------------------

/**
 * Speaking to the companion, and hearing it answer — live, where the platform
 * allows.
 *
 * The rules live in `voice.ts` and this only wires them: the microphone fills
 * the same box the keyboard fills and sends through the same submit the Send
 * button fires, so there is exactly one path a reflection takes into the game
 * whichever way it arrived. The spoken half taps the stream inside
 * `showThread`, where the repaint already holds `view.streaming.text`.
 *
 * Detection is per half, and a missing half takes its control out of the DOM
 * rather than disabling it — a WKWebView (the iOS app) has neither, by design;
 * see `voice.ts` for why nobody should "fix" that.
 */
const mouth = speaking(window, language);
const canHear = hearing(
  globalThis as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown },
);

// Off until asked for, and kept the way the look is kept: same store, same
// tolerate-a-refusal contract. Never true where there is no mouth to honour
// it, so the flag and the control cannot disagree.
let speakAloud = mouth !== null && speakChosen(languageStore);

/**
 * The mouth the queue actually speaks through.
 *
 * `mouth` is the platform's and never changes. This starts as the same object
 * and is replaced by `preferring(...)` if the player takes the better voice —
 * so the swap happens mid-session without the queue, the toggle or the
 * microphone knowing anything about it. Read on every sentence rather than
 * captured once, which is the whole reason the swap is possible.
 */
let speaks: Mouth | null = mouth;
const spoken = mouth
  ? speakingQueue(
      (sentence) => speaks?.say(sentence),
      () => speaks?.hush(),
    )
  : null;

/** The toggle, labelled with what pressing it does — like the light switch. */
const showSpeak = (): void => {
  el.speak.textContent = messageFor(language, speakAloud ? 'app.speakOff' : 'app.speakOn');
  el.speak.setAttribute('aria-pressed', String(speakAloud));
};

if (!mouth) {
  el.speak.remove();
} else {
  showSpeak();
  el.speak.addEventListener('click', () => {
    speakAloud = !speakAloud;
    // Off means now: a voice that finishes its paragraph after being told to
    // stop is a control that did not do what it said.
    if (!speakAloud) spoken?.stop();
    rememberSpeaking(languageStore, speakAloud);
    showSpeak();
  });
}

/**
 * Emily, offered rather than switched on.
 *
 * The rule this control exists to keep is that **nobody downloads ninety-six
 * megabytes without being asked**. So the offer states its own price in its
 * label, the download starts on a tap and never on a page load, and the answer
 * is kept — a player who said yes once is not asked again, and on the next
 * visit the weights come off the shelf instead of the network.
 *
 * Taken out of the page entirely, not disabled, where there is nothing to
 * offer: no `Worker`, no Web Audio, no plain mouth to fall back to, or a board
 * in one of the twenty languages Supertonic does not speak. That is the same
 * rule the speak toggle and the microphone follow, and the same reason —
 * a control that can never do anything is worse than no control. It is why the
 * iOS app's WKWebView, which has no `speechSynthesis` and therefore no `mouth`,
 * shows nothing here.
 */
const canSpeakBetter =
  mouth !== null &&
  speaksNeurally(language) &&
  typeof Worker === 'function' &&
  typeof (globalThis as { AudioContext?: unknown }).AudioContext === 'function';

if (!canSpeakBetter || mouth === null) {
  el.voice.remove();
} else {
  const plain = mouth;
  let state: 'plain' | 'getting' | 'better' | 'failed' = 'plain';
  let percent = 0;

  const showVoice = (): void => {
    el.voice.textContent =
      state === 'getting'
        ? messageFor(language, 'app.voiceGetting', { percent })
        : state === 'better'
          ? messageFor(language, 'app.voiceOff')
          : state === 'failed'
            ? messageFor(language, 'app.voiceFailed')
            : messageFor(language, 'app.voiceOn', { size: megabytes(PAYLOAD_BYTES) });
    el.voice.setAttribute('aria-pressed', String(state === 'better'));
    el.voice.disabled = state === 'getting';
  };

  /**
   * Fetch the weights, stand the worker up, and put the better mouth in front.
   *
   * Every failure lands in one place and does one thing: the plain mouth stays
   * where it is, the choice is un-kept so the next visit does not retry a
   * download that did not work, and the label says so. The player never loses
   * a voice — at worst they keep the one they arrived with.
   */
  const takeTheBetterVoice = async (): Promise<void> => {
    if (state === 'getting' || state === 'better') return;
    state = 'getting';
    percent = 0;
    showVoice();

    try {
      const Sound = (globalThis as unknown as { AudioContext: new () => AudioContext }).AudioContext;
      const context = new Sound();
      /*
       * Resume, but never wait on it.
       *
       * A tap is the gesture browsers want before they will make a sound, and
       * the click path runs inside one. The re-arm on load does not — and a
       * `resume()` called without a gesture returns a promise that never
       * settles at all, so awaiting it stopped the arming dead: measured on
       * the deployed board, nought percent for seventy seconds, no worker, no
       * request. Bounded, so a context that will not wake costs a second
       * rather than the voice; a suspended context then simply cannot play,
       * `preferring` hears the failure, and the plain mouth takes the answer.
       */
      await Promise.race([
        context.resume().catch(() => undefined),
        new Promise((wake) => setTimeout(wake, 1_000)),
      ]);

      const weights = await fetchWeights(WEIGHTS, {
        fetch: (url, init) => fetch(url, init),
        shelf: shelfOn((globalThis as { caches?: unknown }).caches, Response),
        onProgress: ({ done, total }) => {
          percent = Math.round((done / total) * 100);
          showVoice();
        },
      });

      const worker = new Worker(new URL('./supertonic.worker.ts', import.meta.url));
      await new Promise<void>((ready, broken) => {
        const timer = setTimeout(
          () => broken(new Error('the voice did not finish loading')),
          LOAD_PATIENCE_MS,
        );
        worker.addEventListener('message', (event: MessageEvent) => {
          const said = (event.data ?? {}) as { what?: unknown; error?: unknown };
          if (said.what === 'ready') {
            clearTimeout(timer);
            ready();
          } else if (said.what === 'broken') {
            clearTimeout(timer);
            broken(new Error(String(said.error)));
          }
        });
        worker.postMessage({ what: 'load', weights });
      });

      speaks = preferring(
        neuralSounding({ worker, player: speakers(context), language }),
        plain,
      );
      state = 'better';
      rememberNeural(languageStore, true);
    } catch {
      speaks = plain;
      state = 'failed';
      rememberNeural(languageStore, false);
    }
    showVoice();
  };

  showVoice();
  el.voice.addEventListener('click', () => {
    if (state === 'better') {
      // Back to the platform's voice. The weights stay on the shelf: the
      // player said no to Emily, not to the ninety megabytes they already
      // spent, and asking for them again would be the rudeness this whole
      // control is arranged to avoid.
      speaks = plain;
      state = 'plain';
      rememberNeural(languageStore, false);
      showVoice();
      return;
    }
    void takeTheBetterVoice();
  });

  // Asked once. A player who took the better voice last time gets it again
  // without a second offer, and off the shelf rather than off the network.
  // A kept yes re-arms on load — the weights come off the shelf, so this is
  // usually instant. Said out loud either way: silence here was the thing that
  // made a live check impossible to read.
  if (neuralChosen(languageStore)) {
    void takeTheBetterVoice().then(() => {
      console.log(`[voice] re-armed from the shelf: ${state}`);
    });
  }
}

let listening: Listening | null = null;

const showMic = (): void => {
  el.mic.classList.toggle('listening', listening !== null);
  el.mic.setAttribute('aria-pressed', String(listening !== null));
  el.mic.setAttribute(
    'aria-label',
    messageFor(language, listening ? 'app.micStop' : 'app.micStart'),
  );
};

if (!canHear) {
  el.mic.remove();
} else {
  showMic();
  el.mic.addEventListener('click', () => {
    if (listening) {
      // Pressed again is "done": the engine answers with its end event, which
      // is the one place the button's state is put back.
      listening.stop();
      return;
    }

    // No talking over the player: their words are what the microphone is for.
    spoken?.stop();

    // Whatever was already typed stays and the transcript grows after it —
    // interim results repaint live, so the player watches their words arrive.
    const held = el.reply.value.trim();
    const opened = held.length > 0 ? `${held} ` : '';

    try {
      listening = listen(canHear, recognitionLangFor(language), {
        interim: (words) => {
          el.reply.value = `${opened}${words}`;
          grow();
        },
        final: (words) => {
          el.reply.value = `${opened}${words}`;
          grow();
          // The exact same path the Send button takes — `requestSubmit` fires
          // the one submit handler above, which trims, caps, keeps and asks.
          // A second call to `companion.say` here would be a second wording of
          // that handler, and the first one missed is how they disagree.
          el.compose.requestSubmit();
        },
        ended: () => {
          listening = null;
          showMic();
        },
      });
    } catch {
      // A constructor that lied about being one. The box keeps whatever is in
      // it, and the button simply never lights.
      listening = null;
    }
    showMic();
  });
}

// --- open -------------------------------------------------------------------

// The throw the player last watched, from the seat that actually made it — not
// from whoever holds the turn now, which after a non-six is somebody else. Zero
// when nothing is known, and zero is no face at all.
// The last throw if there was one, and a die at rest otherwise.
const lastThrown = rolls[saved.lastThrower ?? -1]?.at(-1);
showFace(lastThrown ?? RESTING_FACE, true, lastThrown !== undefined);
showDetent('half');
showStanding(null);

/**
 * What the player is told about the game they have come back to.
 *
 * Three cases, and the third is the one worth having. A resumed game opens on
 * the square it left off, with the companion naming it — otherwise the board
 * shows a piece forty squares in and a conversation that has never happened. A
 * *refused* save says so: `app.gameNotRead` exists for exactly this event, and a
 * restore that silently starts a new game is indistinguishable from never
 * having saved, which is how a broken save survives for months.
 */
if (saved.seats.length > 0 && entered(seat())) {
  companion.arrived(
    seat().state.loka,
    null,
    messageFor(language, 'app.standing', { plan: seat().state.loka, title: titleOf(seat().state.loka) }),
    writingsOn(readAll(store), seat().state.loka),
  );
} else if (saved.why) {
  el.say.textContent = messageFor(language, 'app.gameNotRead');
}

showThread();
showPath();
showIntention();
settle();
grow();
el.progress.max = 1;
el.progress.setAttribute('aria-label', `0 / ${WIN_LOKA}`);
