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
  applyRoll,
  hasWon,
  initialState,
  owesReport,
  rollDie,
  rollerFor,
  type MoveEvent,
} from '@leela/engine';
import { messageFor, resolveLanguage, type Language } from '@leela/content';
import { loadPlans, plan as planFor } from './content';
import { applyChrome } from './chrome';
import { describeMove } from './describe';
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
  clearDraft,
  loadDraft,
  loadLastRoll,
  loadState,
  saveDraft,
  saveLastRoll,
  saveState,
  loadIntention,
  saveIntention,
} from './state';
import { fileName, merge, parseDocument, toDocument, toText } from './journal-file';
import {
  arrived,
  loadJournal,
  needsReport,
  path as pathOf,
  record,
  saveJournal,
  type Journal,
  hintFor,
} from './reports';
import { headline } from './view';

/** Telegram's WebApp object, when we are running inside Telegram. */
interface TelegramWebApp {
  ready(): void;
  expand(): void;
  colorScheme: 'light' | 'dark';
  initDataUnsafe?: { user?: { language_code?: string } };
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy'): void;
    notificationOccurred(type: 'success' | 'warning' | 'error'): void;
  };
}

const telegram: TelegramWebApp | undefined = (window as unknown as { Telegram?: { WebApp: TelegramWebApp } })
  .Telegram?.WebApp;

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

let state = loadState(localStorage);

/**
 * What the player has written, and whether this plan has been written about.
 *
 * Its own key, so a game already saved is not discarded by the arrival of a
 * field the validator has never heard of.
 */
let journal: Journal = loadJournal(localStorage);

/** What the player is playing for. Asked before the board, as the app asks it. */
let intention: string = loadIntention(localStorage);

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
  writerText: document.getElementById('writer-text') as HTMLTextAreaElement,
  writerSave: document.getElementById('writer-save') as HTMLButtonElement,
  writerHint: document.getElementById('writer-hint') as HTMLElement,
  intention: document.getElementById('intention') as HTMLDialogElement,
  intentionTitle: document.getElementById('intention-title') as HTMLElement,
  intentionText: document.getElementById('intention-text') as HTMLTextAreaElement,
  intentionHint: document.getElementById('intention-hint') as HTMLElement,
  intentionSave: document.getElementById('intention-save') as HTMLButtonElement,
  pathExport: document.getElementById('path-export') as HTMLButtonElement,
  pathImport: document.getElementById('path-import-input') as HTMLInputElement,
  pathImportLabel: document.getElementById('path-import-label') as HTMLElement,
  rules: document.getElementById('rules') as HTMLButtonElement,
  plans: document.getElementById('plans') as HTMLButtonElement,
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

function draw(event?: MoveEvent): void {
  const show = headline(state, language, (plan) => planFor(plan).title);

  for (const cell of cells.values()) cell.classList.remove('here', 'from');
  if (show.here !== null) cells.get(show.here)?.classList.add('here');
  if (show.from !== null) cells.get(show.from)?.classList.add('from');

  el.planNumber.textContent = show.number;
  el.planTitle.textContent = show.title;
  el.progress.value = show.progress;
  el.read.disabled = !show.canRead;

  // The gate. A throw is refused until the plan has been written about, which
  // is the rule the contract enforces and the published app carried. And
  // before any of it, the intention: the app will not show the board without
  // one, so the die will not turn without one either.
  const owed = needsReport(state, journal);
  el.roll.disabled = owed || rolling || intention === '';
  el.report.disabled = !owed;

  // The published app shows "Start over" only once the game has ended —
  // `endGame` in GameScreen. `hasWon` rather than `is_finished`, which a player
  // who has not entered yet also carries: the 68 ambiguity, four times found.
  el.restart.hidden = !hasWon(state);
  el.restart.textContent = messageFor(language, 'app.restart');

  el.say.className = 'say';
  if (owed && !event) {
    el.say.textContent = messageFor(language, 'app.reportNeeded');
  }
  if (event) {
    el.say.textContent = describeMove(language, event, (plan) => planFor(plan).title);
    if (event.direction === 'snake 🐍') el.say.classList.add('snake');
    if (event.direction === 'arrow 🏹') el.say.classList.add('arrow');
    if (event.isGameFinished && !event.isBlocked) el.say.classList.add('win');
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
  openList(messageFor(language, 'app.rules'), ruleEntries(language), (slug) => {
    const chapter = ruleText(language, String(slug));
    if (!chapter) return;
    openReader('chapter', chapter.title, paragraphs(chapter.body));
  });
}

/** Every plan, so a player can read a square they have not landed on. */
function openPlans(): void {
  openList(messageFor(language, 'app.plans'), planEntries(language, state.loka), (plan) => {
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
  state = initialState();
  saveState(localStorage, state);
  // The gate is released: a new game owes nothing yet. The entries stay —
  // what somebody wrote about the squares they stood on is theirs, and
  // starting again is not a reason to burn it.
  journal = { ...journal, reported: true };
  saveJournal(localStorage, journal);
  clearDraft(localStorage);
  showFace(loadLastRoll(localStorage));
  el.say.textContent = messageFor(language, 'app.restarted');
  draw();
}

/**
 * Ask what the player is playing for.
 *
 * Before the board, as the published app asks it — `blockGoBack: true` there,
 * and here the die stays shut until it is answered. In Leela the intention is
 * not a profile field: it is the question the game is being played to answer,
 * and the reports are the answer accumulating.
 */
function askIntention(): void {
  el.intentionTitle.textContent = messageFor(language, 'app.intention');
  el.intentionText.value = intention;
  el.intentionHint.textContent = messageFor(language, 'app.intentionHint');
  el.intention.showModal();
  el.intentionText.focus();
}

function saveTheIntention(): void {
  if (!saveIntention(localStorage, el.intentionText.value)) {
    el.intentionHint.textContent = messageFor(language, 'app.intentionShort');
    return;
  }

  intention = loadIntention(localStorage);
  el.intention.close();
  el.say.textContent = messageFor(language, 'app.intentionSaved');
  draw();
}

/** Show a plan's text. Paragraphs are built as nodes, never as innerHTML. */
function openPlan(plan: number): void {
  const found = planFor(plan);
  openReader('plan', `${plan}. ${found.title}`, paragraphs(found.body));
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

  el.reader.showModal();
}

/** Text as nodes, never as innerHTML: the plans are data, not markup. */
function paragraphs(text: string): HTMLElement[] {
  return text
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim().length > 0)
    .map((paragraph) => {
      const node = document.createElement('p');
      node.textContent = paragraph.trim();
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

const FACES: DieFaces = [die1, die2, die3, die4, die5, die6];

/** Where the spin gets its clock and its "is anyone looking" from. */
const spinHost = browserSpinHost({ setTimeout, clearTimeout, document });

/** Show a face without spinning — on load, and after a throw has settled. */
function showFace(value: number): void {
  el.roll.style.backgroundImage = `url("${faceFor(value, FACES)}")`;
}

async function roll(): Promise<void> {
  if (rolling) return;
  rolling = true;
  el.roll.disabled = true;
  telegram?.HapticFeedback?.impactOccurred('medium');

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

    const applied = applyRoll(state, value, CLASSIC);
    state = applied.state;
    event = applied.event;
    saveState(localStorage, state);
    // After the board, not before: a face is a record of a throw the game
    // took, and one saved ahead of the state can outlive a throw that never
    // happened.
    saveLastRoll(localStorage, value);

    // A new arrival: whatever was written was about the plan they have left.
    // Before the redraw, or the gate is drawn from the journal of the last plan.
    if (owesReport(state, CLASSIC)) {
      journal = arrived(journal);
      saveJournal(localStorage, journal);
    }
  } finally {
    // Whatever happened above, the die comes back. It is the control the whole
    // game runs through, and a dimmed one with no explanation is the app
    // ending the game without saying so.
    el.roll.style.animation = '';
    el.roll.disabled = false;
    rolling = false;
  }

  draw(event);

  if (event.isGameFinished && !event.isBlocked) {
    telegram?.HapticFeedback?.notificationOccurred('success');
  } else if (event.direction === 'snake 🐍') {
    telegram?.HapticFeedback?.notificationOccurred('warning');
  }

  // Landing somewhere new is an invitation to read it, which is the game.
  if (event.to !== event.from && !event.isBlocked) {
    window.setTimeout(() => openPlan(event.to), 500);
  }
}

/** Ask for a report on the plan the player is standing on. */
function openWriter(): void {
  el.writerTitle.textContent = `${state.loka}. ${planFor(state.loka).title}`;
  // Whatever was typed and not filed. A phone discards a backgrounded tab, and
  // the one thing this game asks a player to produce was held in a textarea
  // and nowhere else.
  el.writerText.value = loadDraft(localStorage, state.loka);
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
function showWriterHint(): void {
  el.writerHint.textContent = hintFor(journal, el.writerText.value.length, language);
}

function saveReport(): void {
  const before = journal.entries.length;
  journal = record(journal, state.loka, el.writerText.value, Date.now());

  if (journal.entries.length === before) {
    // Nothing was written, so nothing is recorded and the gate stays shut.
    el.say.textContent = messageFor(language, 'app.reportEmpty');
    return;
  }

  saveJournal(localStorage, journal);
  clearDraft(localStorage);
  el.writer.close();
  draw();
  el.say.textContent = messageFor(language, 'app.reportSaved');
}

/** Everything the player has written, oldest first. */
function openPath(): void {
  const written = pathOf(journal);
  el.readerTitle.textContent =
    written.length === 0
      ? messageFor(language, 'app.path')
      : messageFor(language, 'app.pathCount', { count: written.length });

  const nodes: HTMLElement[] = [];

  // The intention first, because it is the frame the rest of this is written
  // inside: the game is being played to answer it, and the reports are the
  // answer accumulating. The published app keeps it on the profile, which is
  // where nobody rereads it.
  if (intention !== '') {
    const heading = document.createElement('h3');
    heading.textContent = messageFor(language, 'app.intentionYours');
    const said = document.createElement('p');
    said.textContent = intention;

    const change = document.createElement('button');
    change.type = 'button';
    change.className = 'quiet';
    change.textContent = messageFor(language, 'app.intentionChange');
    change.addEventListener('click', () => {
      el.reader.close();
      askIntention();
    });

    nodes.push(heading, said, change);
  }

  if (written.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = messageFor(language, 'app.pathEmpty');
    nodes.push(empty);
  }

  for (const entry of written) {
    const heading = document.createElement('h3');
    heading.textContent = `${entry.plan}. ${planFor(entry.plan).title}`;
    const body = document.createElement('p');
    body.textContent = entry.text;
    nodes.push(heading, body);
  }

  const note = document.createElement('p');
  note.className = 'hint';
  note.textContent = messageFor(language, 'app.pathLocal');
  nodes.push(note);

  openReader('path', el.readerTitle.textContent ?? '', nodes);
  // Nothing written is nothing to save; the file input stays, because bringing
  // a path back is exactly what an empty journal is for.
  el.pathExport.hidden = written.length === 0;
}

/**
 * Write the path to a file.
 *
 * A download rather than the clipboard: a year of writing should leave the
 * browser as something with a name, which can be kept, mailed, or handed to
 * the bot later. `URL.revokeObjectURL` because a page that never lets go of
 * its blobs holds a copy of everything the player has ever written.
 */
function exportPath(): void {
  const document_ = toDocument(journal);
  const blob = new Blob([JSON.stringify(document_, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName(new Date().toISOString().slice(0, 10));
  link.click();
  URL.revokeObjectURL(url);

  // The file is for coming back; the clipboard is for reading, pasting into a
  // message, or keeping in a notes app. One action, because a second button
  // for the same path is a choice nobody wants to make.
  void navigator.clipboard?.writeText(toText(journal, (plan) => planFor(plan).title)).catch(() => {
    // A browser that refuses the clipboard still downloaded the file, which is
    // the part that matters.
  });

  el.say.textContent = messageFor(language, 'app.pathExported');
}

/** Read one back, adding whatever is new and losing nothing. */
async function importPath(file: File): Promise<void> {
  const incoming = parseDocument(await file.text());

  if (incoming === null) {
    el.say.textContent = messageFor(language, 'app.pathUnreadable');
    return;
  }

  const before = journal.entries.length;
  journal = merge(journal, incoming);
  saveJournal(localStorage, journal);

  const added = journal.entries.length - before;
  el.say.textContent =
    added === 0
      ? messageFor(language, 'app.pathImportedNothing')
      : messageFor(language, 'app.pathImported', { count: added });

  el.reader.close();
  draw();
}

el.roll.addEventListener('click', () => void roll());
el.read.addEventListener('click', () => openPlan(state.loka));
el.rules.addEventListener('click', openRules);
el.plans.addEventListener('click', openPlans);
el.restart.addEventListener('click', startOver);
el.report.addEventListener('click', openWriter);
el.writerSave.addEventListener('click', saveReport);
el.intentionSave.addEventListener('click', saveTheIntention);
el.writerText.addEventListener('input', () => {
  saveDraft(localStorage, state.loka, el.writerText.value);
  showWriterHint();
});
el.path.addEventListener('click', openPath);
el.pathExport.addEventListener('click', exportPath);
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
    if (intention === '') askIntention();
  })
  .catch((error) => {
    el.say.textContent = messageFor(language, 'app.unloadable');
    console.error('[miniapp] failed to load content', error);
  });
