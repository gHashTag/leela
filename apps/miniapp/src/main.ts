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
  rollDie,
  rollerFor,
  type MoveEvent,
} from '@leela/engine';
import { messageFor, resolveLanguage, type Language } from '@leela/content';
import { loadPlans, plan as planFor } from './content';
import { applyChrome } from './chrome';
import { describeMove } from './describe';
import { createCell } from './cell';
import { loadState, saveState } from './state';
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

  el.say.className = 'say';
  if (event) {
    el.say.textContent = describeMove(language, event, (plan) => planFor(plan).title);
    if (event.direction === 'snake 🐍') el.say.classList.add('snake');
    if (event.direction === 'arrow 🏹') el.say.classList.add('arrow');
    if (event.isGameFinished && !event.isBlocked) el.say.classList.add('win');
  }
}

/** Show a plan's text. Paragraphs are built as nodes, never as innerHTML. */
function openPlan(plan: number): void {
  const found = planFor(plan);
  el.readerTitle.textContent = `${plan}. ${found.title}`;
  el.readerBody.replaceChildren(
    ...found.body
      .split(/\n{2,}/)
      .filter((paragraph) => paragraph.trim().length > 0)
      .map((paragraph) => {
        const node = document.createElement('p');
        node.textContent = paragraph.trim();
        return node;
      }),
  );
  el.reader.showModal();
}

// --- playing ----------------------------------------------------------------------

/**
 * The die this app plays with — the variant's own, not always a fair one.
 * Created once so a re-rolling variant can remember its previous value.
 */
const die = rollerFor(CLASSIC, rollDie);

let rolling = false;

async function roll(): Promise<void> {
  if (rolling) return;
  rolling = true;
  el.roll.disabled = true;
  el.roll.classList.add('rolling');
  telegram?.HapticFeedback?.impactOccurred('medium');

  // A beat between the press and the result — the throw should be felt.
  await new Promise((resolve) => setTimeout(resolve, 450));

  const { state: next, event } = applyRoll(state, die(), CLASSIC);
  state = next;
  saveState(localStorage, state);

  el.roll.classList.remove('rolling');
  el.roll.disabled = false;
  rolling = false;

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

el.roll.addEventListener('click', () => void roll());
el.read.addEventListener('click', () => openPlan(state.loka));

// Nothing can be drawn before the texts arrive: the board labels every square
// with its title. Failing loudly beats an empty grid that looks like a bug.
applyChrome(document, language);

loadPlans(language)
  .then(() => {
    buildBoard();
    draw();
  })
  .catch((error) => {
    el.say.textContent = messageFor(language, 'app.unloadable');
    console.error('[miniapp] failed to load content', error);
  });
