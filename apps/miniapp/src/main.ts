/**
 * Leela as a Telegram mini app.
 *
 * The same engine the bot uses, drawn as the board players know. State lives
 * in memory and in `localStorage`, so a game survives closing the app; nothing
 * here talks to a server, which is what lets it be opened and played without
 * any deployment beyond static files.
 */

import {
  BOARD_ROWS,
  CLASSIC,
  hasWon,
  initialState,
  rollDie,
  rollerFor,
  type MoveEvent,
  advance,
  currentPlayer,
  submitReport,
  MAX_SEATS,
} from '@leela/engine';
import { messageFor, piecesOf, resolveLanguage, type Language } from '@leela/content';
import { loadBook, loadPlans, plan as planFor, plans as loadedPlans } from './content';
import { applyChrome } from './chrome';
import { describeMove, attribute} from './describe';
import { createCell } from './cell';
import { boardFor, paintBoard } from './paint';
import { browserSpinHost, faceFor, settle, spinDegrees, spinMs, type DieFaces } from './die';
import {
  planEntries,
  ruleEntries,
  ruleText,
  showsPathTools,
  type Entry,
  type ReaderKind,
} from './browse';
import die1 from './die-1.webp';
import die2 from './die-2.webp';
import die3 from './die-3.webp';
import die4 from './die-4.webp';
import die5 from './die-5.webp';
import die6 from './die-6.webp';
import boardLight from './board-light.webp';
import boardDark from './board-dark.webp';
import gemArt from './gem.webp';
import {
  readSeats,
  resize,
  saveSeats,
  seatsFrom,
  sessionFrom,
} from './seats';
import {
  clearDraft,
  forgetIntention,
  loadDraft,
  loadLastRoll,
  saveDraft,
  saveLastRoll,
  loadIntention,
  isIntention,
  saveIntention,
} from './state';
import {
  fileName,
  taking,
  parseDocument,
  parseSquare,
  shareTextFor,
  takeSquare,
  toDocument,
  toText,
} from './journal-file';
import {
  arrived,
  seatOwesReport,
  path as pathOf,
  record,
  type Journal,
  hintFor,
  loadJournalFor,
  readJournalFor,
  owingSeat,
  pathSections,
  revisited,
  type PathSection,
  type Revisit,
  saveJournalFor,
  writingsOn,
} from './reports';
import {
  afterWriting,
  headline,
  lineFor,
  mayExport,
  mayExportHere,
  mayShare,
  mayAsk,
  mayStartOver,
  mayLeaveTheQuestion,
  mayThrow,
  mayWrite,
  standing,
  fitsHandOver,
  handOverExcess,
} from './view';

/** Telegram's WebApp object, when we are running inside Telegram. */
interface TelegramWebApp {
  ready(): void;
  expand(): void;
  colorScheme: 'light' | 'dark';
  initDataUnsafe?: { user?: { language_code?: string } };
  /**
   * Telegram's signed launch payload, and the only honest sign we are inside
   * Telegram at all.
   *
   * `telegram-web-app.js` is served from telegram.org and defines `WebApp` in
   * *any* browser, `sendData` included — so feature-detecting the method draws
   * a button in a plain tab where pressing it does nothing. Found by opening
   * the app in one, which is the same lesson as the last three passes: a
   * control that cannot work is worse than no control.
   *
   * Empty outside Telegram. Whether the launch came from a keyboard button —
   * which is what `sendData` actually requires — is not visible from here at
   * all; that is the operator's setup, and it is written down in the bot's
   * README rather than guessed at.
   */
  initData?: string;
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy'): void;
    notificationOccurred(type: 'success' | 'warning' | 'error'): void;
  };
  /**
   * Hand something to the bot, and close.
   *
   * Present only when the app was opened from a *keyboard* button — not from a
   * link, not from an inline one. So it is feature-detected rather than
   * assumed, and the control that uses it is not drawn where it cannot work.
   */
  sendData?(data: string): void;
}

const telegram: TelegramWebApp | undefined = (window as unknown as { Telegram?: { WebApp: TelegramWebApp } })
  .Telegram?.WebApp;

/**
 * Whether this is really running inside Telegram.
 *
 * Not `telegram !== undefined`: the script that defines it is served from
 * telegram.org and runs in any browser. `initData` is signed and empty
 * everywhere else.
 */
function insideTelegram(): boolean {
  return (telegram?.initData ?? '').length > 0;
}

/**
 * A buzz, and only where a buzz is possible.
 *
 * `telegram-web-app.js` defines `HapticFeedback` in any browser and warns
 * internally — *HapticFeedback is not supported in version 6.0* — so optional
 * chaining never short-circuits and a plain browser logs a warning on every
 * accepted throw. The file already documents this exact trap for `sendData`
 * twenty lines up; haptics is the one place the lesson was not applied.
 */
function buzz(effect: () => void): void {
  if (insideTelegram()) effect();
}

telegram?.ready();
telegram?.expand();

// Telegram's own colour scheme is authoritative inside the app and can differ
// from the system setting the media query sees.
if (telegram?.colorScheme) {
  document.documentElement.dataset.theme = telegram.colorScheme;
}

// --- state -------------------------------------------------------------------

const language: Language = resolveLanguage(
  telegram?.initDataUnsafe?.user?.language_code ?? navigator.language,
);

/**
 * The table. One seat is the game this app has always been; six is what the
 * published app offers, and `advance` moves the turn between them exactly as
 * it does for the bot.
 */
const openedWith = readSeats(localStorage);
let seats = openedWith.seats;
let session = sessionFrom(seats);

/** The player whose turn it is, and the writing they have done. */
let state = currentPlayer(session).state;
let journal = takeJournalFor(currentPlayer(session).id);

/**
 * The seat the writing box is addressing.
 *
 * Usually the seat holding the turn, and not at the one moment that matters
 * most: a player who reaches Cosmic Consciousness owes an account of it and the
 * turn leaves them on the same throw. Held while the dialog is open, because
 * the dialog is modal and nothing can move underneath it.
 */
let writingFor: string | null = null;

/**
 * What the app has just been told to say, until something happens.
 *
 * The line under the board answers "where do I stand", and sometimes has to
 * answer "I have just done what you asked" instead. Keeping the second in a
 * variable rather than writing it straight to the element is what makes the
 * order of `announce` and `draw` stop mattering — the reason four confirmations
 * went missing at once when the standing line arrived.
 */
let announcement: string | null = null;

/** Say something, and keep saying it until the next throw. */
/**
 * Whether the browser is keeping the game, and whether it has been said.
 *
 * A window that refuses one write refuses every write, so this is said once and
 * then not again: repeated under each throw it would bury the sentence a player
 * is actually reading — the one about the snake they just hit.
 */
let unkept = false;
let saidUnkept = false;

/**
 * Accounts that were on this browser and are not on the screen.
 *
 * A path that came back short looks exactly like a path that was never that
 * long, and this app used to make the loss total: one entry it could not read
 * and the whole file was replaced, without a word, a moment before the next
 * account was saved over what was left. Said once, like `unkept`, and for the
 * same reason — under every throw it would bury the sentence about the snake.
 */
let lost = 0;
let saidLost = false;

/**
 * Seats that were in the table and are not at it.
 *
 * Counted at startup, before anything is drawn, because the table is read
 * before this file has a screen to say it on. Kept apart from `lost`: an
 * account nobody can read is a page of writing, and a seat nobody can read is
 * somebody's whole game.
 */
const seatsLost = openedWith.dropped;
let saidSeatsLost = false;

/** One seat's path, counting what could not be read into the notice. */
function takeJournalFor(playerId: string): Journal {
  const read = readJournalFor(localStorage, playerId);
  if (read.dropped > 0) {
    lost += read.dropped;
    // A different seat's loss is still this device's loss, and the player
    // changing seats is the person who can do something about it.
    saidLost = false;
  }

  return read.journal;
}

function announce(text: string): void {
  announcement = text;
  draw();
}

/** Read the current seat back out of the session, after any move. */
function takeSeat(): void {
  const seated = currentPlayer(session);
  state = seated.state;
  journal = takeJournalFor(seated.id);
  intention = loadIntention(localStorage, seated.id);
}

/** Keep the table, and the seat's writing with it. */
function keepTable(): void {
  seats = seatsFrom(session);
  // Noted rather than shown here: `keepTable` runs before the sentence
  // describing the move exists, and the notice belongs beside that sentence.
  if (!saveSeats(localStorage, seats)) unkept = true;
}

/**
 * What the seated player is playing for. Asked before the board, as the app
 * asks it — and asked of each seat, because it is theirs and not the device's.
 */
let intention: string = loadIntention(localStorage, currentPlayer(session).id);

// --- elements ------------------------------------------------------------------

const el = {
  board: document.getElementById('board') as HTMLElement,
  planNumber: document.getElementById('plan-number') as HTMLElement,
  planTitle: document.getElementById('plan-title') as HTMLElement,
  progress: document.getElementById('progress') as HTMLProgressElement,
  say: document.getElementById('say') as HTMLElement,
  roll: document.getElementById('roll') as HTMLButtonElement,
  read: document.getElementById('read') as HTMLButtonElement,
  reader: document.getElementById('reader') as HTMLDialogElement,
  readerTitle: document.getElementById('reader-title') as HTMLElement,
  readerBody: document.getElementById('reader-body') as HTMLElement,
  report: document.getElementById('report') as HTMLButtonElement,
  path: document.getElementById('path') as HTMLButtonElement,
  writer: document.getElementById('writer') as HTMLDialogElement,
  writerTitle: document.getElementById('writer-title') as HTMLElement,
  writerBefore: document.getElementById('writer-before') as HTMLElement,
  writerText: document.getElementById('writer-text') as HTMLTextAreaElement,
  writerSave: document.getElementById('writer-save') as HTMLButtonElement,
  writerHint: document.getElementById('writer-hint') as HTMLElement,
  writerShare: document.getElementById('writer-share') as HTMLButtonElement,
  writerAsk: document.getElementById('writer-ask') as HTMLButtonElement,
  intention: document.getElementById('intention') as HTMLDialogElement,
  intentionTitle: document.getElementById('intention-title') as HTMLElement,
  intentionText: document.getElementById('intention-text') as HTMLTextAreaElement,
  intentionHint: document.getElementById('intention-hint') as HTMLElement,
  intentionSave: document.getElementById('intention-save') as HTMLButtonElement,
  intentionClose: document.getElementById('intention-close') as HTMLButtonElement,
  pathExport: document.getElementById('path-export') as HTMLButtonElement,
  pathPaste: document.getElementById('path-paste') as HTMLButtonElement,
  paste: document.getElementById('paste') as HTMLDialogElement,
  pasteTitle: document.getElementById('paste-title') as HTMLElement,
  pasteText: document.getElementById('paste-text') as HTMLTextAreaElement,
  pasteHint: document.getElementById('paste-hint') as HTMLElement,
  pasteTake: document.getElementById('paste-take') as HTMLButtonElement,
  pathImport: document.getElementById('path-import-input') as HTMLInputElement,
  pathImportText: document.getElementById('path-import') as HTMLElement,
  pathImportLabel: document.getElementById('path-import-label') as HTMLElement,
  rules: document.getElementById('rules') as HTMLButtonElement,
  plans: document.getElementById('plans') as HTMLButtonElement,
  players: document.getElementById('players') as HTMLButtonElement,
  restart: document.getElementById('restart') as HTMLButtonElement,
  list: document.getElementById('list') as HTMLDialogElement,
  listTitle: document.getElementById('list-title') as HTMLElement,
  listItems: document.getElementById('list-items') as HTMLElement,
};

/** Every cell, by plan, so an update touches only what changed. */
const cells = new Map<number, HTMLElement>();

function buildBoard(): void {
  // The squares sit in their own layer, inset to the painted board's numbered
  // area. Appending them straight onto `#board` would stretch the grid across
  // the image's margin and offset every square from its number.
  const squares = document.createElement('div');
  squares.className = 'squares';
  const fragment = document.createDocumentFragment();

  for (const row of BOARD_ROWS) {
    for (const plan of row) {
      const cell = createCell({
        plan,
        label: `${plan}. ${planFor(plan).title}`,
        onActivate: openPlan,
        document,
      });
      cells.set(plan, cell);
      fragment.append(cell);
    }
  }

  squares.append(fragment);
  el.board.append(squares);
}

// --- drawing --------------------------------------------------------------------

function draw(event?: MoveEvent, threwSeat = session.turnIndex): void {
  const show = headline(state, language, (plan) => planFor(plan).title);

  for (const cell of cells.values()) {
    cell.classList.remove('here', 'from', 'other');
    cell.removeAttribute('data-seat');
    cell.removeAttribute('aria-current');
  }

  // Everyone at the table, not only whoever holds the turn. The published app
  // draws a gem per seat — `Gem` maps over `OfflinePlayers.store.plans` — and
  // a board that showed one of six players would be a board nobody else could
  // read.
  for (const [seat, player] of session.players.entries()) {
    if (player.id === currentPlayer(session).id) continue;

    const where = headline(player.state, language, (plan) => planFor(plan).title).here;
    if (where === null) continue;

    const cell = cells.get(where);
    if (!cell || cell.classList.contains('here')) continue;
    cell.classList.add('other');
    cell.dataset.seat = String(seat + 1);
  }

  if (show.here !== null) {
    const here = cells.get(show.here);
    here?.classList.add('here');

    // Where the player is standing, for somebody who cannot see the board.
    //
    // The square was marked by a class and nothing else, so a player moving
    // across seventy-two buttons by keyboard heard *41. The human plane
    // (jana-loka)* on every one of them and had no way to find their own. The
    // sentence in `#say` announces it once, on the throw; the board itself said
    // nothing, and a board is what a player comes back to.
    //
    // `aria-current` is the word for exactly this — the one item of a set that
    // is the current one — so nothing new has to be said in twenty-two
    // languages for it to be understood.
    here?.setAttribute('aria-current', 'true');
  }
  if (show.from !== null) cells.get(show.from)?.classList.add('from');

  el.planNumber.textContent = show.number;
  el.planTitle.textContent =
    session.players.length > 1
      ? `${messageFor(language, 'app.seatTurn', { seat: session.turnIndex + 1 })} · ${show.title}`
      : show.title;
  el.progress.value = show.progress;
  el.read.disabled = !show.canRead;

  // The gate. A throw is refused until the plan has been written about, which
  // is the rule the contract enforces and the published app carried. And
  // before any of it, the intention: the app will not show the board without
  // one, so the die will not turn without one either.
  // The engine's gate, not the journal's. Two records of one fact disagreed
  // the moment a second player sat down.
  const owed = seatOwesReport(currentPlayer(session));
  // One question, asked here and again by whoever acts. The button saying no is
  // not the same as the act saying no, and the difference is a double tap away.
  el.roll.disabled = mayThrow(session, intention, rolling, owed) !== 'yes';
  el.report.disabled = !mayWrite(session);

  // The published app shows "Start over" only once the game has ended —
  // `endGame` in GameScreen. `hasWon` rather than `is_finished`, which a player
  // who has not entered yet also carries: the 68 ambiguity, four times found.
  el.restart.hidden = !mayStartOver(session);
  el.restart.textContent = messageFor(language, 'app.restart');

  el.say.className = 'say';

  // Which of the three the line is saying, and what becomes of the
  // announcement — one rule, in `view`, rather than the order of two
  // statements at every call site that has something to report.
  const line = lineFor(announcement, event !== undefined);
  announcement = line.announcement;

  if (!event) {
    // Two sources, in order: what the app has just been told to say, and
    // otherwise where the player stands. Before there was a standing line this
    // was one source and an accident — every announcement survived because
    // nothing overwrote it — and the pass that made the line describe the state
    // silently ate four confirmations that happened to be set before a redraw.
    // An announcement outlives its redraw and nothing else, which is the whole
    // rule.
    if (line.says === 'announcement') {
      el.say.textContent = line.announcement;
    } else {
      const where = standing(state, owed, (plan) => planFor(plan).title);
      el.say.textContent = messageFor(language, where.key, where.params ?? {});
      if (hasWon(state)) el.say.classList.add('win');
    }
  }
  if (event) {
    // Named when there is more than one seat: the header has already moved to
    // whoever throws next, so an unattributed sentence reads as theirs.
    el.say.textContent = attribute(
      language,
      describeMove(language, event, (plan) => planFor(plan).title),
      threwSeat,
      session.players.length,
    );
    if (event.direction === 'snake 🐍') el.say.classList.add('snake');
    if (event.direction === 'arrow 🏹') el.say.classList.add('arrow');
    if (event.isGameFinished && !event.isBlocked) el.say.classList.add('win');
  }

  // Beside whatever is being said, once, whichever of the three lines it is.
  // Not through `announce`: `lineFor` discards an announcement when a move is
  // being described — rightly, it is about the turn — and this is not about the
  // turn. It is about the browser, and the throw it is failing to keep is
  // exactly the sentence a player needs it next to.
  if (unkept && !saidUnkept) {
    saidUnkept = true;
    el.say.textContent = `${el.say.textContent ?? ''} ${messageFor(language, 'app.gameUnkept')}`.trim();
  }

  // And what this browser held and could not give back. A separate sentence
  // from `unkept`: one is about tomorrow and this one is about yesterday, and a
  // player who reads only the first would think their path is intact.
  if (lost > 0 && !saidLost) {
    saidLost = true;
    const line = messageFor(language, 'app.pathPartlyRead', { count: lost });
    el.say.textContent = `${el.say.textContent ?? ''} ${line}`.trim();
  }

  // And whoever is not at the table who should be. Its own sentence, because
  // the answer to it is not the answer to a missing account: a player whose
  // game is gone may want to sit down again before anybody throws.
  if (seatsLost > 0 && !saidSeatsLost) {
    saidSeatsLost = true;
    const line = messageFor(language, 'app.seatsPartlyRead', { count: seatsLost });
    el.say.textContent = `${el.say.textContent ?? ''} ${line}`.trim();
  }
}

/**
 * A list of titles that open a text.
 *
 * The published app has two of these — `RULES_SCREEN` and `PLANS_SCREEN`, both
 * a `FlatList` of `RenderPlanItem` — and they are the same thing on screen, so
 * they are one dialog here.
 */
function openList(title: string, entries: Entry[], open: (key: number | string) => void): void {
  el.listTitle.textContent = title;

  el.listItems.replaceChildren(
    ...entries.map((entry) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = entry.title;
      if (entry.here) button.classList.add('here');
      if (entry.borrowed) {
        const note = document.createElement('span');
        note.className = 'quiet-mark';
        note.textContent = messageFor(language, 'app.borrowed');
        button.append(note);
      }
      if (entry.returns) {
        // A count rather than a dot: "three" is the whole point, and a mark
        // that only says "some" makes a player open all 72 to find out which.
        const mark = document.createElement('span');
        mark.className = 'returns';
        mark.textContent = String(entry.returns);
        mark.title = messageFor(language, 'app.returns', { count: entry.returns });
        button.append(mark);
      }
      button.addEventListener('click', () => {
        el.list.close();
        open(entry.key);
      });
      item.append(button);
      return item;
    }),
  );

  el.list.showModal();
}

/** The rules book. Carried in 22 languages since the third pass, and until now
 *  there was no way to open it. */
function openRules(): void {
  // Awaited, because the book is its own chunk now and the first tap may be the
  // fetch. Nothing is opened until it lands: a list that appears empty and
  // fills in a moment later reads as a book with no chapters.
  void loadBook(language).then((chapters) => {
    openList(messageFor(language, 'app.rules'), ruleEntries(chapters), (slug) => {
      const chapter = ruleText(chapters, String(slug));
      if (!chapter) return;
      openReader('chapter', chapter.title, paragraphs(chapter.body));
    });
  });
}

/**
 * How many are playing from this device.
 *
 * `SelectPlayersScreen` in the published app, which offers one to six and then
 * starts the game. Seating a table discards the games in progress, so it says
 * so by asking rather than by doing it from a stray tap.
 */
function askPlayers(): void {
  const entries = Array.from({ length: MAX_SEATS }, (_, index) => ({
    key: index + 1,
    title: String(index + 1),
    here: index + 1 === session.players.length,
  }));

  openList(messageFor(language, 'app.playersAsk'), entries, (count) => {
    // Nobody who stays loses their game. Choosing a number used to build a
    // fresh table — every seat back to the waiting square, a month of play gone
    // on one tap, with nothing asked and nothing said.
    const changed = resize(seats, Number(count));
    seats = changed.seats;
    session = sessionFrom(seats);
    saveSeats(localStorage, seats);
    takeSeat();

    // Only the seats just made. A draft under `p2` from a table before this one
    // would otherwise surface as somebody else's half-sentence; a draft under a
    // seat that stayed belongs to somebody still playing.
    for (const id of changed.created) clearDraft(localStorage, id);

    announce(messageFor(language, 'app.playersSet', { count: seats.players.length }));
  });
}

/** Every plan, so a player can read a square they have not landed on. */
function openPlans(): void {
  // Marked with the returns, because the list is the only place a whole game is
  // visible at once. Three marks against 41 is the game saying something no
  // single report can.
  const returns = new Map(revisited(journal).map((visit) => [visit.plan, visit.times]));

  openList(messageFor(language, 'app.plans'), planEntries(loadedPlans(), state.loka, returns), (plan) => {
    openPlan(Number(plan));
  });
}

/**
 * Start the game again.
 *
 * `OfflinePlayers.resetGame` clears storage and puts the player back at the
 * beginning. The journal is left alone on purpose: what somebody wrote about
 * the squares they stood on is theirs, and a new game is not a reason to burn
 * it. `/path` still shows it, and "Save a copy" still exports it.
 */
function startOver(): void {
  // The same question the button is drawn from. A hidden control cannot be
  // pressed, but that is the drawing's promise rather than this function's, and
  // three defects in this app came from an act that trusted a drawing.
  if (!mayStartOver(session)) return;

  // This seat begins again. The others are in the middle of their own games,
  // and a shared device is not a reason to end somebody else's.
  const seated = currentPlayer(session);
  session = {
    ...session,
    players: session.players.map((player) =>
      player.id === seated.id ? { ...player, state: initialState() } : player,
    ),
  };
  keepTable();
  takeSeat();

  // The gate is released: a new game owes nothing yet. The entries stay —
  // what somebody wrote about the squares they stood on is theirs, and
  // starting again is not a reason to burn it.
  journal = { ...journal, reported: true };
  saveJournalFor(localStorage, seated.id, journal);
  clearDraft(localStorage, seated.id);

  // A new game is a new question. This seat's own — the others are in the
  // middle of their games and theirs stand. The board was emptied and the
  // draft forgotten, and the sentence this game was *played to answer* stayed,
  // with `mayThrow` already satisfied by it, so nobody beginning again was
  // asked what they were beginning for. The bot lets go of it on `/end`, the
  // phone on *Start over*, and this is the third surface with the shape.
  intention = '';
  forgetIntention(localStorage, seated.id);

  showFace(loadLastRoll(localStorage));
  announce(messageFor(language, 'app.restarted'));

  // And asked, rather than left behind a die nobody can press. This app's own
  // rule, written where a hand-off meets a seat that has never answered: the
  // die is shut until it does, so the question has to arrive by itself.
  askIntention();
}

/**
 * Ask what the player is playing for.
 *
 * Before the board, as the published app asks it — `blockGoBack: true` there,
 * and here the die stays shut until it is answered. In Leela the intention is
 * not a profile field: it is the question the game is being played to answer,
 * and the reports are the answer accumulating.
 */
/**
 * Ask what the player is playing for.
 *
 * **A way out, but only once there is one to go back to.** Four of the five
 * dialogs here carry a Close and this one carried none, on the reasoning the
 * published app states by blocking the back gesture: a player who has not
 * answered must not walk past the question. That is right the first time and
 * wrong every time after — and this is a mini app, which is a phone. There is
 * no Escape key on a phone, Telegram's own back button is not wired, and the
 * `cancel` handler below refuses the gesture anyway. So a player who tapped
 * *Change it* and cleared the box had nothing left: Save refuses two
 * characters, and there was no other control in the dialog at all.
 *
 * The same rule the phone was given: the way out appears when there is an
 * answer to keep.
 */
function askIntention(): void {
  el.intentionTitle.textContent = messageFor(language, 'app.intention');
  el.intentionText.value = intention;
  el.intentionHint.textContent = messageFor(language, 'app.intentionHint');
  el.intentionClose.hidden = !mayLeaveTheQuestion(intention);
  el.intention.showModal();
  el.intentionText.focus();
}

function saveTheIntention(): void {
  // Asked of the text, not of the store. These used to be one question, so a
  // browser that refused the write answered the player with "a little longer,
  // please" — about a sentence that was long enough.
  if (!isIntention(el.intentionText.value)) {
    el.intentionHint.textContent = messageFor(language, 'app.intentionShort');
    return;
  }

  if (!saveIntention(localStorage, el.intentionText.value, currentPlayer(session).id)) {
    unkept = true;
  }

  // What was just written, not what storage says was written. A private window
  // takes `setItem` and refuses `getItem`, so reading it back returned nothing
  // — the die never opened and the game could not begin at all, while
  // `saveIntention`'s own comment promised that "a window that cannot store
  // still plays". Found by playing the assembled app with a storage that
  // refuses everything, which no test of one function could do.
  intention = el.intentionText.value.trim();
  el.intention.close();
  announce(messageFor(language, 'app.intentionSaved'));
}

/** Show a plan's text. Paragraphs are built as nodes, never as innerHTML. */
/**
 * A square, and what this player has already said about it.
 *
 * The reports were readable only as a path — everything, in the order it
 * happened — which is the wrong shape for a game whose whole teaching is that
 * you come back. Standing on 41 for the third time, what you wrote the first
 * two times is the measure of what has changed, and it was in the app the
 * entire while with no way to reach it.
 */
function openPlan(plan: number, seatId = currentPlayer(session).id): void {
  const found = planFor(plan);
  // The player's own words first, when there are any. Seen on a phone: the
  // traditional text of 41 is three long paragraphs, so anything under it is
  // below the fold — and a player opening a square they have stood on three
  // times wants what they said last time, not to scroll past the teaching to
  // find it. On a first visit there is nothing here and the plan text is still
  // the first thing on screen.
  // Whose accounts, said out loud. The reader is the seat holding the turn
  // almost always — they are the one looking at the board — and not when a
  // chip in somebody else's section of the path view opened it. Tapping your
  // own return under your own name and reading the other player's private
  // writing is the worst thing this app could do with it.
  const theirs =
    seatId === currentPlayer(session).id ? journal : loadJournalFor(localStorage, seatId);

  openReader('plan', `${plan}. ${found.title}`, [
    ...writtenBefore(theirs, plan),
    ...paragraphs(found.body),
  ]);
}

/**
 * What one seat is playing for, and — for whoever holds the turn — the way to
 * change it.
 *
 * The intention is the frame the reports are written inside: the game is being
 * played to answer it, and the reports are the answer accumulating. The
 * published app keeps it on the profile, which is where nobody rereads it.
 *
 * Only the seat holding the turn is offered the change, because that is the
 * only seat `askIntention` can write to.
 */
function playingFor(section: PathSection): HTMLElement[] {
  if (section.intention === '') return [];

  const heading = document.createElement('h3');
  heading.textContent = messageFor(language, 'app.intentionYours');
  const said = document.createElement('p');
  said.textContent = section.intention;

  if (section.playerId !== currentPlayer(session).id) return [heading, said];

  const change = document.createElement('button');
  change.type = 'button';
  change.className = 'quiet';
  change.textContent = messageFor(language, 'app.intentionChange');
  change.addEventListener('click', () => {
    el.reader.close();
    askIntention();
  });

  return [heading, said, change];
}

/**
 * The squares that came back, as things to tap.
 *
 * A count rather than a dot, and a way in rather than a statement: the point of
 * knowing 41 came back four times is reading the four, and `openPlan` already
 * puts them one under the other.
 */
function cameBack(returns: ReadonlyArray<Revisit>, seatId: string): HTMLElement[] {
  const heading = document.createElement('h3');
  heading.className = 'mine';
  heading.textContent = messageFor(language, 'app.cameBack');

  const row = document.createElement('p');
  row.className = 'came-back';

  for (const visit of returns) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = `${visit.plan} · ${planFor(visit.plan).title} ×${visit.times}`;
    chip.title = messageFor(language, 'app.returns', { count: visit.times });
    chip.addEventListener('click', () => {
      el.reader.close();
      // The seat this row belongs to, which is not always the one holding the
      // turn: the path view shows every seat at the table.
      openPlan(visit.plan, seatId);
    });
    row.append(chip);
  }

  return [heading, row];
}

/**
 * Hand this square to the bot, which has the companion.
 *
 * The mini app has the plans, the returns, the arrival and the whole path —
 * everything `packages/ai` is given except the model, and a model needs a key.
 * A key in a browser bundle is a key given away, so the missing half of the
 * product was never the reflection: it was the bridge.
 *
 * Telegram provides one. The square goes over in the format both surfaces
 * already read and write, and the bot files it and answers. It closes the app,
 * which is Telegram's doing and not ours — so it is a button somebody presses
 * rather than something that happens to them.
 */
function askTheCompanion(): void {
  if (!mayAsk(el.writerText.value, insideTelegram())) return;

  const writing = whatIsBeingWritten();

  // The question only where this device is one person. A hand-over reaches the
  // bot as *the account holder's*, and the account holder is one human being —
  // so a phone that three people are playing on has no business telling the bot
  // what any of them is playing for. The square is still theirs to send; the
  // frame is not the device's to claim.
  const asked = session.players.length === 1 ? writing.intention : '';
  const payload = shareTextFor(
    writing.plan,
    planFor(writing.plan).title,
    el.writerText.value,
    asked,
  );

  // Built first, then measured. Telegram's cap is in bytes and every bound this
  // app shows the player is in characters, so a Russian account crosses it at
  // about half the length the writing box still says is fine — and crossing it
  // did nothing at all: no error, no reply, not even the app closing, which is
  // the only sign the hand-over worked.
  if (!fitsHandOver(payload)) {
    // Characters rather than bytes, because the player counts characters. The
    // encoder's average over what they actually typed, so it is right for the
    // alphabet in front of them rather than for Latin.
    const bytes = new TextEncoder().encode(el.writerText.value).length;
    const perCharacter = Math.max(1, bytes / Math.max(1, el.writerText.value.length));
    el.writerHint.textContent = messageFor(language, 'app.askTooLong', {
      over: Math.ceil(handOverExcess(payload) / perCharacter),
    });
    return;
  }

  // A throw of its own: `sendData` is the SDK's and it raises rather than
  // returning false. The hint is the only place a player can be told.
  try {
    telegram?.sendData?.(payload);
  } catch {
    el.writerHint.textContent = messageFor(language, 'app.askTooLong', { over: 0 });
  }
}

/** One player's earlier writing about one square, oldest first. */
function writtenBefore(theirs: Journal, plan: number): HTMLElement[] {
  const written = writingsOn(theirs, plan);
  if (written.length === 0) return [];

  const heading = document.createElement('h3');
  heading.className = 'mine';
  heading.textContent = messageFor(language, written.length > 1 ? 'app.wroteHere' : 'app.wroteOnce');

  return [
    heading,
    ...written.map((entry) => {
      const block = document.createElement('blockquote');
      block.className = 'mine';

      const when = document.createElement('cite');
      when.textContent = new Date(entry.at).toLocaleDateString(language);

      const said = document.createElement('p');
      said.textContent = entry.text;

      block.append(when, said);
      return block;
    }),
  ];
}

/**
 * Show the reader.
 *
 * The journal's export and import live in this dialog too, and only the export
 * was ever hidden — so a plan's text carried a "Bring one back" button under
 * it, and the rules book inherited that the day it existed. One place decides,
 * from what is being read.
 */
function openReader(kind: ReaderKind, title: string, body: HTMLElement[]): void {
  el.readerTitle.textContent = title;
  el.readerBody.replaceChildren(...body);

  const tools = showsPathTools(kind);
  el.pathExport.hidden = !tools;
  el.pathImportLabel.hidden = !tools;
  el.pathPaste.hidden = !tools;

  el.reader.showModal();
}

/** Text as nodes, never as innerHTML: the plans are data, not markup. */
/**
 * A text as the elements a reader meets.
 *
 * A heading is a heading. The rules chapters write their sections as
 * `## The second chakra (Svadhisthana)` — three hundred and five of them across
 * nineteen languages — and this put the paragraph on the screen as text, so a
 * reader met the hashes. Markup shown to somebody who never asked to see any,
 * on the surface that is published.
 *
 * `headingOf` is the format's own answer, shared with the book and the phone,
 * because three surfaces reading one text had each decided this for themselves
 * and two of them decided it wrong.
 *
 * `h3` at the shallowest: the dialog's own title is an `h2` above this, and a
 * reader using headings to move through a chapter should meet the next level
 * down rather than one that claims to be the page.
 *
 * **Down by the distance, not by a fixed two.** The chakras chapter writes its
 * sections as `####`, so a fixed shift drew them as `h6` under an `h2` title —
 * a reader moving by heading level is told three levels are missing. Where a
 * text starts counting is not something its author decided; the distances
 * between its headings are.
 */
function paragraphs(text: string): HTMLElement[] {
  const pieces = piecesOf(text);
  const shallowest = Math.min(...pieces.map((piece) => piece.heading?.level ?? 9), 9);
  const shift = shallowest === 9 ? 0 : 3 - shallowest;

  return pieces.map((piece) => {
    if (piece.heading) {
      const said = document.createElement(
        `h${Math.min(Math.max(piece.heading.level + shift, 3), 6)}`,
      );
      said.textContent = piece.text;
      return said;
    }

    const node = document.createElement('p');
    node.textContent = piece.text;
    return node;
  });
}

// --- playing ----------------------------------------------------------------------

/**
 * The die this app plays with — the variant's own, not always a fair one.
 * Created once so a re-rolling variant can remember its previous value.
 */
const throwDie = rollerFor(CLASSIC, rollDie);

let rolling = false;

/** Which seat made the throw the message is about. */
let threwAt = 0;

const FACES: DieFaces = [die1, die2, die3, die4, die5, die6];

/** Where the spin gets its clock and its "is anyone looking" from. */
const spinHost = browserSpinHost({ setTimeout, clearTimeout, document });

/** Show a face without spinning — on load, and after a throw has settled. */
function showFace(value: number): void {
  el.roll.style.backgroundImage = `url("${faceFor(value, FACES)}")`;
}

async function roll(): Promise<void> {
  // The same question the die's disabled state was drawn from. A disabled
  // button is a drawing, and a drawing does not refuse anything.
  if (mayThrow(session, intention, rolling, seatOwesReport(currentPlayer(session))) !== 'yes') {
    return;
  }
  rolling = true;
  el.roll.disabled = true;
  buzz(() => telegram?.HapticFeedback?.impactOccurred('medium'));

  // The value is thrown first and the spin is cut to fit it, which is what the
  // published app does: a six turns six times and takes three times as long to
  // settle as a two. The wait is part of the throw rather than a fixed beat.
  const value = throwDie();
  const duration = spinMs(value);

  el.roll.style.setProperty('--spin', `${spinDegrees(value)}deg`);
  el.roll.style.animation = `spin ${duration}ms linear`;
  showFace(value);

  let event;
  try {
    // The spin is decoration and the throw is the game. A browser freezes the
    // timers of a page nobody is looking at, so waiting the animation out left
    // a mini app that was switched away from mid-spin with a disabled die, an
    // unapplied throw and a board that never moved — dead until reloaded.
    await settle(duration, spinHost);

    // Through the session, so the turn moves to the next seat still playing —
    // `advance` and `nextSeat`, the same path the bot takes. The published app
    // writes that rotation out longhand in five branches; the engine has had
    // it right all along.
    const moved = advance(session, value, Date.now());
    session = moved.session;
    event = moved.event;

    // The seat that threw, which is not the seat that holds the turn now.
    const thrower = session.players.find((player) => player.id === moved.playerId);
    state = thrower?.state ?? state;
    keepTable();
    // After the board, not before: a face is a record of a throw the game
    // took, and one saved ahead of the state can outlive a throw that never
    // happened.
    if (!saveLastRoll(localStorage, value)) unkept = true;

    // A new arrival: whatever was written was about the plan they have left.
    // Before the redraw, or the gate is drawn from the journal of the last plan.
    if (moved.owesReport) {
      const owing = arrived(loadJournalFor(localStorage, moved.playerId));
      saveJournalFor(localStorage, moved.playerId, owing);
    }

    // Whoever holds the turn now — the thrower again on a six, the next seat
    // otherwise. The seat that threw is remembered for the sentence, which is
    // about their throw and not about whoever is up next.
    threwAt = session.players.findIndex((player) => player.id === moved.playerId);
    takeSeat();
  } finally {
    // Whatever happened above, the die comes back. It is the control the whole
    // game runs through, and a dimmed one with no explanation is the app
    // ending the game without saying so.
    el.roll.style.animation = '';
    el.roll.disabled = false;
    rolling = false;
  }

  draw(event, threwAt);

  if (event.isGameFinished && !event.isBlocked) {
    buzz(() => telegram?.HapticFeedback?.notificationOccurred('success'));
  } else if (event.direction === 'snake 🐍') {
    buzz(() => telegram?.HapticFeedback?.notificationOccurred('warning'));
  }

  // A seat that has never been asked what it is playing for. The die is shut
  // until it answers — exactly as it is on a first launch — so the question has
  // to arrive by itself rather than wait behind a control nobody can press.
  // Only ever a hand-off: the seat that threw has already answered, so in a
  // one-player game this is never reached and the reading below always is.
  if (intention === '') {
    askIntention();
    return;
  }

  // Landing somewhere new is an invitation to read it, which is the game.
  if (event.to !== event.from && !event.isBlocked) {
    // For the seat that threw. `openPlan` defaults to the turn holder, and by
    // here the turn has already left the mover on any throw that was not a six
    // — so the square they landed on opened with the *next* player's private
    // accounts under "What you wrote here". Four lines above, the same
    // distinction is already made for the sentence.
    const reader = threwAt >= 0 ? session.players[threwAt]?.id : undefined;
    window.setTimeout(() => openPlan(event.to, reader), 500);
  }
}

/** Ask for a report on the plan the player is standing on. */
function openWriter(): void {
  const owing = owingSeat(session.players, session.turnIndex);
  if (!owing) return;

  writingFor = owing.id;
  const plan = owing.state.loka;
  const theirs = loadJournalFor(localStorage, owing.id);

  el.writerTitle.textContent =
    session.players.length > 1
      ? `${messageFor(language, 'app.seatTurn', { seat: session.players.indexOf(owing) + 1 })} · ${plan}. ${planFor(plan).title}`
      : `${plan}. ${planFor(plan).title}`;
  // What they wrote the last times they stood here. It was already in the app
  // — in the reader, one dialog away — and the moment it matters is this one:
  // the game is asking for another account of the same square, and the measure
  // of what has changed is the last one.
  el.writerBefore.replaceChildren(...writtenBefore(theirs, plan));
  // Whatever was typed and not filed. A phone discards a backgrounded tab, and
  // the one thing this game asks a player to produce was held in a textarea
  // and nowhere else.
  el.writerText.value = loadDraft(localStorage, owing.id, plan);
  showWriterHint();
  el.writer.showModal();
  el.writerText.focus();
}

/**
 * What is left, and what saving will cost.
 *
 * Both limits were silent: a report longer than the cap was cut, and past 500
 * entries the oldest was dropped, and the player was told neither. The dialog
 * has carried an empty hint since it was written.
 */
/**
 * The seat the writing box was opened for.
 *
 * Asked four times and written out four times, and the fourth was wrong: the
 * keystroke handler saved the draft under `currentPlayer(session).id` while
 * `openWriter` had loaded it under `owing.id`. At a table those are different
 * players after any throw that passes the turn, so the writing seat's draft was
 * never kept at all — the crash recovery this function exists for silently did
 * not work for them — and the other seat's was destroyed on every keystroke.
 *
 * `whatIsBeingWritten` already ends "The whole of the fix is asking the same
 * seat three times instead of three different ones". This is the same fix with
 * nowhere left to ask differently.
 */
function writingSeat(): (typeof session.players)[number] | undefined {
  return session.players.find((player) => player.id === writingFor);
}

function showWriterHint(): void {
  // The journal of the seat being written for. The hint counts what is left in
  // *their* path, and the box is not always the turn holder's.
  const writer = writingSeat();
  const theirs = writer ? loadJournalFor(localStorage, writer.id) : journal;

  el.writerHint.textContent = hintFor(theirs, el.writerText.value.length, language);
  // Nothing to share until something has been written. The button appears
  // rather than sitting disabled: a control that is never usable is furniture.
  el.writerShare.hidden = !mayShare(el.writerText.value);
  el.writerAsk.hidden = !mayAsk(el.writerText.value, insideTelegram());
  el.writerShare.textContent = messageFor(language, 'app.share');
}

/**
 * Hand one square to somebody else.
 *
 * The path leaves this app as a file — a year of it, for coming back to. What
 * people pass on is a single square, and this app could export everything and
 * share nothing. `Lila Game`, the freshest of the competing apps, leads its
 * store listing with sharing results.
 *
 * The player presses; nothing leaves on its own. `navigator.share` where a
 * phone has it — that is the sheet Telegram and Safari both put up — and the
 * clipboard where it does not, which is what the path export has always used.
 */
/**
 * The square the writing box is about, and the question behind it.
 *
 * Not the seat holding the turn. Both of these controls live inside the box,
 * and the box belongs to whoever owes a report — which at the end of a game is
 * *not* the player whose turn it is, because winning hands the turn away.
 *
 * So sharing a winner's account of Cosmic Consciousness sent a friend plan 30,
 * with the winner's words under it and the other player's question at the
 * bottom: a square nobody stood on, signed by somebody who did not write it.
 * The whole of the fix is asking the same seat three times instead of three
 * different ones.
 */
function whatIsBeingWritten(): { plan: number; intention: string } {
  const writer = writingSeat();
  if (!writer) return { plan: state.loka, intention };

  return { plan: writer.state.loka, intention: loadIntention(localStorage, writer.id) };
}

async function shareSquare(): Promise<void> {
  if (!mayShare(el.writerText.value)) return;

  const writing = whatIsBeingWritten();
  const text = shareTextFor(
    writing.plan,
    planFor(writing.plan).title,
    el.writerText.value,
    writing.intention,
  );

  try {
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }

    await navigator.clipboard.writeText(text);
    announce(messageFor(language, 'app.shareCopied'));
  } catch {
    // A refusal is a person changing their mind as often as a browser saying
    // no, and neither is worth an error: the words are still in the box.
    el.writerHint.textContent = messageFor(language, 'app.shareRefused');
  }
}

function saveReport(): void {
  // The seat the box was opened for, and only while it still owes. Two taps on
  // Save used to file the same account twice — a slip on a phone, not an
  // exploit — and two accounts of one visit make `revisited` claim a square the
  // player never returned to.
  const writer = writingSeat();
  if (!writer || !seatOwesReport(writer)) {
    el.writer.close();
    return;
  }

  const theirs = loadJournalFor(localStorage, writer.id);
  const after = record(theirs, writer.state.loka, el.writerText.value, Date.now());

  if (after.entries.length === theirs.entries.length) {
    // Nothing is recorded and the gate stays shut — and the player is told
    // which of the two it was. *Nothing was written* and *not enough was* are
    // different things to be told, and a control that declines without saying
    // what it wants ends somebody's turn without telling them.
    announce(
      el.writerText.value.trim().length === 0
        ? messageFor(language, 'app.reportEmpty')
        : messageFor(language, 'report.tooShort', { count: CLASSIC.minReportChars }),
    );
    return;
  }

  // Whether the account actually landed. The game goes on either way — it is in
  // hand for this session — but a player whose browser refuses to keep it is
  // owed the truth while their words are still on the screen.
  const kept = saveJournalFor(localStorage, writer.id, after);
  // The seat has answered: the engine's gate is what `draw` reads.
  session = submitReport(session, writer.id, Date.now());
  keepTable();
  takeSeat();
  // The account in hand, over whatever `takeSeat` just read back. Same reason
  // as the intention: a store that refuses is a store that answers "nothing",
  // and what somebody has this moment written is not nothing.
  if (writer.id === currentPlayer(session).id) journal = after;
  clearDraft(localStorage, writer.id);
  el.writer.close();

  // What is true of the player who wrote it. "You may throw" was said whatever
  // the state was — including to a player who had just reached Cosmic
  // Consciousness, with the die dimmed underneath it. The bot said the same
  // sentence in the same situation and stopped two passes ago.
  const said = afterWriting(session, writer.id);
  writingFor = null;

  announce(
    !kept
      ? messageFor(language, 'app.reportUnkept')
      : said === 'finished'
        ? messageFor(language, 'app.reportSavedDone')
        : said === 'not-your-turn'
          ? messageFor(language, 'app.reportSavedTurn', { seat: session.turnIndex + 1 })
          : messageFor(language, 'app.reportSaved'),
  );
}

/** Everything the player has written, oldest first. */
function openPath(): void {
  const alone = session.players.length === 1;
  const written = pathOf(journal);

  // The heading counted the turn holder's path while the body showed everyone's
  // — "your path, 2 plans" over forty of somebody else's. At a shared table it
  // says what the view is instead of claiming a number for one seat.
  el.readerTitle.textContent = !alone
    ? messageFor(language, 'app.pathEveryone')
    : written.length === 0
      ? messageFor(language, 'app.path')
      : messageFor(language, 'app.pathCount', { count: written.length });

  const nodes: HTMLElement[] = [];

  // Every seat, not only whoever holds the turn. `OfflineProfileScreen` is a
  // sectioned list — "Player 1", "Player 2", … sliced to the number seated —
  // and a path that showed one of three would leave two people unable to read
  // what they had written on a device they share.

  const sections = pathSections(
    session.players.map((player) => ({
      id: player.id,
      journal: loadJournalFor(localStorage, player.id),
      intention: loadIntention(localStorage, player.id),
    })),
  );

  for (const section of sections) {
    const theirs = section.entries;

    if (!alone) {
      const who = document.createElement('h3');
      who.className = 'seat';
      who.textContent = messageFor(language, 'app.seatTurn', { seat: section.seat });
      nodes.push(who);
    }

    // Each seat's own, inside their section. It used to be one block at the
    // top under the word "you", above everybody's writing — so at a shared
    // table the frame belonged to whoever happened to hold the turn, and the
    // other players read somebody else's question as their own.
    nodes.push(...playingFor(section));

    if (theirs.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = messageFor(language, 'app.pathEmpty');
      nodes.push(empty);
      continue;
    }

    // What came back, before the path itself. The path is everything in the
    // order it happened, which is the wrong shape for the question the game is
    // about — and this is the one place a player already comes to look at
    // their own writing, so it needs no button of its own.
    if (section.returns.length > 0) nodes.push(...cameBack(section.returns, section.playerId));

    for (const entry of theirs) {
      const heading = document.createElement('h3');
      heading.textContent = `${entry.plan}. ${planFor(entry.plan).title}`;
      const body = document.createElement('p');
      body.textContent = entry.text;
      nodes.push(heading, body);
    }

    // One save per seat, named. The footer's single button cannot say whose
    // path it is about, and at a shared table that is the whole question.
    if (!alone) {
      const save = document.createElement('button');
      save.type = 'button';
      save.className = 'quiet';
      save.textContent = messageFor(language, 'app.pathExportSeat', { seat: section.seat });
      save.addEventListener('click', () => exportPath(section.playerId));
      nodes.push(save);
    }
  }

  const note = document.createElement('p');
  note.className = 'hint';
  note.textContent = messageFor(language, 'app.pathLocal');
  nodes.push(note);

  openReader('path', el.readerTitle.textContent ?? '', nodes);
  // Nothing written is nothing to save; the file input stays, because bringing
  // a path back is exactly what an empty journal is for.
  // The footer's button is the one-seat case: with several, each section has
  // its own, because a button that does not say whose saves the wrong one.
  el.pathExport.hidden = !mayExportHere(written, alone);

  /**
   * And the door back in says whose it opens onto.
   *
   * Three doors sit in this footer and two of them named the seat: the export
   * became *Save Player 1's copy* when a view showing every seat made an
   * unnamed one write the wrong file, and the paste dialog opens as *Player 3 ·
   * Paste a square somebody sent you*. This one said only *Bring one back*
   * while merging a whole path — and the question it was written under — into
   * whichever seat happened to hold the turn.
   */
  el.pathImportText.textContent = alone
    ? messageFor(language, 'app.pathImport')
    : messageFor(language, 'app.pathImportSeat', { seat: seatNumberOf(session) });
}

/**
 * Write the path to a file.
 *
 * A download rather than the clipboard: a year of writing should leave the
 * browser as something with a name, which can be kept, mailed, or handed to
 * the bot later. `URL.revokeObjectURL` because a page that never lets go of
 * its blobs holds a copy of everything the player has ever written.
 */
function exportPath(seatId = currentPlayer(session).id): void {
  // Whose path is being saved. The button lives in a view that shows every seat
  // at the table, and it used to save whoever held the turn — so a player could
  // scroll to their own section, tap Save a copy, and carry away a file of
  // somebody else's writing.
  const theirs =
    seatId === currentPlayer(session).id ? journal : loadJournalFor(localStorage, seatId);
  const asked =
    seatId === currentPlayer(session).id ? intention : loadIntention(localStorage, seatId);

  // The same question the button is drawn from. An empty file is not a
  // keepsake, and a download nobody asked for is worse than none.
  if (!mayExport(pathOf(theirs))) return;

  // The question with the answers. A path used to leave as a year of writing
  // with the frame it was written inside missing, so a player who changed phone
  // arrived with everything they had said and nothing they had asked.
  const document_ = toDocument(theirs, asked);
  const blob = new Blob([JSON.stringify(document_, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  // The seat in the name when there is more than one, so two files from one
  // phone are not the same file twice.
  const stamp = new Date().toISOString().slice(0, 10);
  link.download =
    session.players.length > 1 ? fileName(`${seatId}-${stamp}`) : fileName(stamp);
  link.click();
  URL.revokeObjectURL(url);

  // The file is for coming back; the clipboard is for reading, pasting into a
  // message, or keeping in a notes app. One action, because a second button
  // for the same path is a choice nobody wants to make.
  //
  // **`theirs`, not `journal`.** Everything above asks which seat the button
  // belongs to and this line did not, so at a table *Save a copy* under seat two
  // downloaded seat two's file and put seat one's whole path — readable text,
  // ready to paste into a message — on the clipboard. The fix that reached the
  // file stopped two lines short of it.
  void navigator.clipboard?.writeText(toText(theirs, (plan) => planFor(plan).title)).catch(() => {
    // A browser that refuses the clipboard still downloaded the file, which is
    // the part that matters.
  });

  announce(messageFor(language, 'app.pathExported'));
}

/**
 * Take in one square, sent as words.
 *
 * The path leaves as a file and comes back as a file. A square left as words —
 * the thing people actually pass on — and there was nothing to hear it with:
 * the app could write a sentence it could not read.
 *
 * Dated on arrival, and the reply says so. A shared square carries no time,
 * inventing one would put it at a place in the path where nothing happened, and
 * arriving today is the one true thing about it.
 */
/** Which seat a path or a square is about to become, counted from one. */
function seatNumberOf(of: typeof session): number {
  return of.players.indexOf(currentPlayer(of)) + 1;
}

function openPaste(): void {
  // Whose journal it will go into, said out loud. The footer's controls are
  // visible in a view that shows every seat, and a square filed into somebody's
  // path without their name on the box is the same silence that made "Save a
  // copy" write the wrong file.
  const seat = seatNumberOf(session);
  el.pasteTitle.textContent =
    session.players.length > 1
      ? `${messageFor(language, 'app.seatTurn', { seat })} · ${messageFor(language, 'app.pasteAsk')}`
      : messageFor(language, 'app.pasteAsk');
  el.pasteHint.textContent = messageFor(language, 'app.pasteHint');
  el.pasteText.value = '';
  el.pasteTake.textContent = messageFor(language, 'app.pasteTake');
  el.paste.showModal();
  el.pasteText.focus();
}

function takeThePastedSquare(): void {
  // The square and not the question. A pasted square is somebody else's — the
  // dialog says so — and reading their frame is not adopting it. The parser
  // hands the intention up now, and this is the route that declines it.
  const square = parseSquare(el.pasteText.value);
  if (square === null) {
    el.pasteHint.textContent = messageFor(language, 'app.pasteUnreadable');
    return;
  }

  const before = journal.entries.length;
  // `reported` is the current journal's and is never taken from what arrives.
  // A square written on some other device is not a reason to open this
  // player's gate — the rule an imported file has always followed.
  journal = { ...journal, entries: takeSquare(journal.entries, square, Date.now()) };
  saveJournalFor(localStorage, currentPlayer(session).id, journal);

  el.paste.close();
  el.reader.close();
  announce(
    journal.entries.length === before
      ? messageFor(language, 'app.pasteHad')
      : messageFor(language, 'app.pasteTook', { plan: square.plan }),
  );
}

/** Read one back, adding whatever is new and losing nothing. */
async function importPath(file: File): Promise<void> {
  const incoming = parseDocument(await file.text());

  if (incoming === null) {
    announce(messageFor(language, 'app.pathUnreadable'));
    return;
  }

  // What the file's accounts did, from the one place that knows: at the bound
  // the path does not grow, so measuring its length said *nothing new in that
  // file* about a file whose accounts had all landed — and said nothing at all
  // about the older ones they pushed out.
  const took = taking(journal, incoming.entries);
  journal = took.journal;
  saveJournalFor(localStorage, currentPlayer(session).id, journal);

  // The question, only where this seat has none. An intention already given is
  // this player's own and is never replaced by a file's — the same rule that
  // keeps `reported` out of an import, and for the same reason: what somebody
  // is playing for is not somebody else's to set.
  const asked = incoming.intention ?? '';
  if (intention === '' && asked !== '') {
    const seat = currentPlayer(session).id;
    // Held whether or not it lands, as everything else in this app is: a
    // browser that will not keep it is not a reason to drop the question the
    // path was written under.
    if (isIntention(asked)) {
      intention = asked.trim();
      if (!saveIntention(localStorage, asked, seat)) unkept = true;
    }
  }

  const seat = seatNumberOf(session);
  el.reader.close();

  const brought =
    took.added === 0
      ? messageFor(language, 'app.pathImportedNothing')
      : session.players.length > 1
        ? `${messageFor(language, 'app.seatTurn', { seat })} · ${messageFor(language, 'app.pathImported', { count: took.added })}`
        : messageFor(language, 'app.pathImported', { count: took.added });

  // Both, when both happened. A player brought accounts in *and* lost older
  // ones, and a sentence that carries only the first is the untruth this app
  // already caught itself telling about a report a store had refused.
  announce(
    took.dropped === 0
      ? brought
      : `${brought} ${messageFor(language, 'app.pathImportedCapped', { count: took.dropped })}`,
  );
}

el.roll.addEventListener('click', () => void roll());
el.read.addEventListener('click', () => openPlan(state.loka));
el.rules.addEventListener('click', openRules);
el.players.addEventListener('click', askPlayers);
el.plans.addEventListener('click', openPlans);
el.restart.addEventListener('click', startOver);
el.report.addEventListener('click', openWriter);
el.writerSave.addEventListener('click', saveReport);
el.writerShare.addEventListener('click', () => void shareSquare());
el.writerAsk.addEventListener('click', askTheCompanion);
el.intentionSave.addEventListener('click', saveTheIntention);

/*
 * The one dialog with no way out, kept that way.
 *
 * It is deliberately Close-less — the published app navigates to it with
 * `blockGoBack: true` — but a `<dialog>` closes on Escape and on Android's back
 * gesture whatever the markup says. Dismissed before the question is answered,
 * the player was left with a dark die, no reason given, and no control that
 * helps: `askIntention` is reachable only from a "Change it" button that is not
 * drawn until there is an intention to change. The game was over until reload.
 *
 * Only while it is unanswered. A returning player opening it to change their
 * question must still be able to close it and keep the old one.
 */
el.intention.addEventListener('cancel', (event) => {
  // The same question the Close button is drawn from. It was `intention === ''`
  // written out here and `mayLeaveTheQuestion(intention)` five hundred lines
  // up: one rule with two spellings, which is how a control and the act behind
  // it come to disagree.
  if (!mayLeaveTheQuestion(intention)) event.preventDefault();
});
el.writerText.addEventListener('input', () => {
  // The earliest write of a session, and so the first chance to notice that
  // this browser is keeping nothing — somebody typing in a private window gets
  // here before they have thrown anything.
  // The seat the box belongs to, not the seat holding the turn. `openWriter`
  // loads the draft under the owing seat and this used to save it under the
  // turn holder — so at a table the writing was kept nowhere and somebody
  // else's draft was overwritten by every keystroke.
  const writer = writingSeat();
  if (
    !saveDraft(
      localStorage,
      writer?.id ?? currentPlayer(session).id,
      writer?.state.loka ?? state.loka,
      el.writerText.value,
    )
  ) {
    // Redrawn here and nowhere else. Every other writer has a redraw behind it
    // — a throw, a confirmation, a seat change — and a keystroke has none, so
    // the notice would sit set and unsaid until the player did something the
    // app already answers. Once: `saidUnkept` closes it after the first pass.
    const before = saidUnkept;
    unkept = true;
    if (!before) draw();
  }
  showWriterHint();
});
el.path.addEventListener('click', openPath);
el.pathExport.addEventListener('click', () => exportPath());
el.pathPaste.addEventListener('click', openPaste);
el.pasteTake.addEventListener('click', takeThePastedSquare);
el.pathImport.addEventListener('change', () => {
  const [file] = el.pathImport.files ?? [];
  if (file) void importPath(file);
  // Cleared, so choosing the same file twice is two events rather than one.
  el.pathImport.value = '';
});

// Nothing can be drawn before the texts arrive: the board labels every square
// with its title. Failing loudly beats an empty grid that looks like a bug.
applyChrome(document, language);

// The gem the player stands on, as a variable so the stylesheet can place it
// without knowing the bundler's URL for it.
document.documentElement.style.setProperty('--gem', `url("${gemArt}")`);

// The painting is an upgrade on the numbered grid, not a precondition for it.
// Two boards, as the published app has: the snakes on white, and the same
// snakes on black behind Leela herself.
const scheme = telegram?.colorScheme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
void paintBoard(document, boardFor(scheme, { light: boardLight, dark: boardDark }));

// The throw the player last made, not a hard-coded one. A die that resets to
// `1` over a board that moved by six is the app contradicting itself.
showFace(loadLastRoll(localStorage));

loadPlans(language)
  .then(() => {
    buildBoard();
    draw();
    // The first thing the app asks, and the first thing this asks now.
    if (intention === '') {
      askIntention();
      return;
    }

    // And then, if a report is owed, the writing box — `if (!prof.isReported)
    // OpenPlanReportModal(prof.plan)` on the app's own launch path. A player
    // coming back to a game they left mid-thought was shown a dimmed die and a
    // sentence, and had to find the button that says the same thing.
    if (seatOwesReport(currentPlayer(session))) openWriter();
  })
  .catch((error) => {
    el.say.textContent = messageFor(language, 'app.unloadable');
    console.error('[miniapp] failed to load content', error);
  });
