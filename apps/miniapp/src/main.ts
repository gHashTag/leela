/**
 * Leela as a Telegram mini app.
 *
 * The same engine the bot uses, drawn as the board players know. State lives
 * in memory and in `localStorage`, so a game survives closing the app; nothing
 * here talks to a server, which is what lets it be opened and played without
 * any deployment beyond static files.
 */

import {
  ARROWS,
  BOARD_ROWS,
  CLASSIC,
  SNAKES,
  TOTAL_PLANS,
  WIN_LOKA,
  applyRoll,
  initialState,
  rollDie,
  type GameState,
  type MoveEvent,
} from '@leela/engine';
import { resolveLanguage, type Language } from '@leela/content';
import { loadPlans, plan as planFor } from './content';
import { describeMove } from './describe';
import { createCell } from './cell';

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

// --- state -------------------------------------------------------------------

const STORAGE_KEY = 'leela.game.v1';

const language: Language = resolveLanguage(
  telegram?.initDataUnsafe?.user?.language_code ?? navigator.language,
);

function load(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as GameState;
    // Trust nothing from storage: a hand-edited or stale value must not put a
    // player on a square that does not exist.
    if (
      !Number.isInteger(parsed.loka) ||
      parsed.loka < 1 ||
      parsed.loka > TOTAL_PLANS
    ) {
      return initialState();
    }
    return parsed;
  } catch {
    return initialState();
  }
}

function save(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A private window with storage disabled still plays; it just forgets.
  }
}

let state = load();

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

  el.board.append(fragment);
}

// --- drawing --------------------------------------------------------------------

/** True while the player waits on the win square for a six to let them in. */
function waitingToEnter(current: GameState): boolean {
  return current.is_finished;
}

function draw(event?: MoveEvent): void {
  for (const cell of cells.values()) cell.classList.remove('here', 'from');

  if (!waitingToEnter(state)) {
    cells.get(state.loka)?.classList.add('here');
    if (state.previous_loka >= 1 && state.previous_loka !== state.loka) {
      cells.get(state.previous_loka)?.classList.add('from');
    }
  }

  const plan = planFor(state.loka);
  el.planNumber.textContent = waitingToEnter(state) ? '—' : String(state.loka);
  el.planTitle.textContent = waitingToEnter(state)
    ? 'Throw a six to enter the game'
    : plan.title;
  el.progress.value = waitingToEnter(state) ? 0 : Math.min(state.loka, WIN_LOKA);

  el.say.className = 'say';
  if (event) {
    el.say.textContent = describeMove(event, (plan) => planFor(plan).title);
    if (event.direction === 'snake 🐍') el.say.classList.add('snake');
    if (event.direction === 'arrow 🏹') el.say.classList.add('arrow');
    if (event.isGameFinished && !event.isBlocked) el.say.classList.add('win');
  }

  el.read.disabled = waitingToEnter(state);
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

let rolling = false;

async function roll(): Promise<void> {
  if (rolling) return;
  rolling = true;
  el.roll.disabled = true;
  el.roll.classList.add('rolling');
  telegram?.HapticFeedback?.impactOccurred('medium');

  // A beat between the press and the result — the throw should be felt.
  await new Promise((resolve) => setTimeout(resolve, 450));

  const value = rollDie();
  const { state: next, event } = applyRoll(state, value, CLASSIC);
  state = next;
  save(state);

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
loadPlans(language)
  .then(() => {
    buildBoard();
    draw();
  })
  .catch((error) => {
    el.say.textContent = 'The plan texts could not be loaded. Reopening the app usually fixes it.';
    console.error('[miniapp] failed to load content', error);
  });
