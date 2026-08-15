import {
  LEGACY_MOBILE,
  WIN_LOKA,
  type MoveEvent,
  MAX_SEATS,
  createSession,
  currentPlayer,
  rollDie,
} from '@leela/engine';

import { directionOf, messageFor, planFor, resolveLanguage, titlesFor } from './canon';
import { describeMove } from '@leela/content';
import { fileName, pathText, revisited, writingsOn, MAX_REPORT_CHARS } from '@leela/journal';

import { Companion, type Line, type Rests } from './companion';
import { DEFAULT_DEITY, DEITIES, deityFor, deityForSeat, seatsOf } from './deities';
import { screenFor, toneOf, turnPassed } from './hud';
import { fanOffset, hopPoint, planPosition } from './layout';
import { browserStore, finishedTable, read, write, type KeptSeat } from './kept';
import { pathOf } from './path';
import {
  asFile,
  add as keepWritten,
  readAll,
  readIntention,
  takeIn,
  writeIntention,
} from './written';
import { isFace, pipsFor } from './die';
import { entered, throwFor, type Hop, type Thrown } from './play';
import type { SeatedPlayer } from '@leela/engine';
import { createBoard } from './scene';
import { atEnd, bringIntoView, dragged, stepped, type Detent, type Heights } from './sheet';
import { css } from './theme';

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

const HOP_MS = 420;

/**
 * The first seat, which is the table until `seatTable` reads what was saved.
 *
 * Not "the one seat this surface plays" any more: the board holds a token per
 * seat, the engine has had `createSession`, `advance` and turn rotation all
 * along, and both halves are now wired to each other. What is left of this
 * constant is a name for the seat a fresh device sits down at.
 *
 * The id is `p1` because that is what `seatId(0)` produces in
 * `apps/miniapp/src/seats.ts`, and a journal kept per seat should find the same
 * name on both surfaces.
 */
const SEAT = 'p1';

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
  planHeading: need<HTMLElement>('#plan-heading'),
  planText: need<HTMLElement>('#plan-text'),
  thread: need<HTMLElement>('#thread'),
  visitingPlan: need<HTMLElement>('#visiting-plan'),
  intention: need<HTMLButtonElement>('#intention'),
  intentionLabel: need<HTMLElement>('#intention-label'),
  intentionText: need<HTMLElement>('#intention-text'),
  save: need<HTMLButtonElement>('#save'),
  bring: need<HTMLButtonElement>('#bring'),
  bringFile: need<HTMLInputElement>('#bring-file'),
  carrySaid: need<HTMLElement>('#carry-said'),
  path: need<HTMLDetailsElement>('#path'),
  pathSummary: need<HTMLElement>('#path-summary'),
  pathList: need<HTMLElement>('#path-list'),
  rests: need<HTMLDetailsElement>('#rests'),
  restsList: need<HTMLElement>('#rests-list'),
  compose: need<HTMLFormElement>('#compose'),
  reply: need<HTMLTextAreaElement>('#reply'),
  send: need<HTMLButtonElement>('#send'),
};

// --- who is reading ---------------------------------------------------------

const language = resolveLanguage(navigator.language);
const titleOf = titlesFor(language);

document.documentElement.lang = language;
document.documentElement.dir = directionOf(language);
el.reply.placeholder = messageFor(language, 'app.reportPlaceholder');
el.die.setAttribute('aria-label', messageFor(language, 'app.play'));
el.visitingBack.textContent = messageFor(language, 'app.read');
el.pathSummary.textContent = messageFor(language, 'app.path');
el.intentionLabel.textContent = messageFor(language, 'app.intention');
el.save.textContent = messageFor(language, 'app.pathExport');
el.bring.textContent = messageFor(language, 'app.pathImport');
el.planTitle.textContent = messageFor(language, 'app.waiting');
el.say.textContent = messageFor(language, 'app.opening');

// --- the pieces -------------------------------------------------------------

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// What the last visit left behind, read before anything is built from it.
const store = browserStore();
const saved = read(store, LEGACY_MOBILE);

const board = createBoard(el.canvas);

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
let lastThrower: number | null = null;
let session = createSession('device', [{ id: SEAT }], LEGACY_MOBILE);

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
  board.setSeats(seated);
};

/** Re-seats the board from the deities the seats now hold. */
const seatBoard = (): void =>
  board.setSeats(
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

const companion = new Companion({ language });

const keep = (): void =>
  write(store, {
    turnIndex: session.turnIndex,
    lastThrower,
    seats: session.players.map((player, at) => ({
      id: player.id,
      deity: deities[at]?.id ?? deityForSeat(at).id,
      state: player.state,
      rolls: rolls[at] ?? [],
    })),
  });

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
  board.resize(window.innerWidth, window.innerHeight, {
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
  const fragment = document.createDocumentFragment();

  for (const line of view.lines) fragment.append(bubble(line));

  if (view.status === 'thinking') {
    const waiting = document.createElement('div');
    waiting.className = 'thinking';
    waiting.append(...['', '', ''].map(() => document.createElement('i')));
    fragment.append(waiting);
  }

  el.thread.replaceChildren(fragment);
  follow(el.sheetBody, el.thread.lastElementChild);

  showRests(view.rests, view.status, view.note);
};

const SOURCE_LABEL: Readonly<Record<Line['source'], string>> = {
  canon: 'from the text',
  model: 'model',
  fallback: 'unanswered',
  player: '',
  // Dated rather than labelled: what matters about your own earlier writing is
  // *when*, and `bubble` fills this in from the line's own timestamp.
  written: '',
};

/** A date a player can place, in their own language. */
const on = (at: number): string =>
  new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(at));

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

// --- carrying the path out, and back ---------------------------------------

el.save.addEventListener('click', () => {
  const file = new Blob([asFile(store)], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  const named = fileName(new Date().toISOString().slice(0, 10));
  link.download = named;
  link.click();
  // Revoked, or every save leaks the whole path for as long as the tab lives.
  URL.revokeObjectURL(url);

  /**
   * The sentence, now that it is true.
   *
   * `app.pathExported` says *saved, and a readable copy is on the clipboard*.
   * This surface used to show a file name instead, because the prose rendering
   * lived in `apps/miniapp/src/journal-file.ts` and could not be reached from
   * here — a key half-used is how `app.gameNotRead` came to promise players
   * accounts this app does not have. `pathText` is in `@leela/journal` now, so
   * the clipboard really does get the readable copy and the sentence says what
   * happened.
   *
   * Announced only once the clipboard has actually taken it. A browser that
   * refuses still downloaded the file, which is the part that matters, and the
   * file name is the honest thing to say in that case.
   */
  void navigator.clipboard
    ?.writeText(pathText(readAll(store), titleOf))
    .then(() => {
      el.carrySaid.textContent = messageFor(language, 'app.pathExported');
    })
    .catch(() => {
      el.carrySaid.textContent = named;
    });
  el.carrySaid.textContent = named;
});

el.bring.addEventListener('click', () => el.bringFile.click());

el.bringFile.addEventListener('change', () => {
  const [chosen] = el.bringFile.files ?? [];
  if (!chosen) return;
  void chosen.text().then((text) => {
    const outcome = takeIn(store, text);
    // Reset, or choosing the same file twice does nothing the second time.
    el.bringFile.value = '';
    if (!outcome) {
      el.carrySaid.textContent = messageFor(language, 'app.pathUnreadable');
      return;
    }
    /**
     * What is *there*, and what it cost.
     *
     * `merged`'s own comment is the reason both numbers are said: the two
     * surfaces before this told the player how many entries arrived while the
     * bound had just thrown that many of their oldest away.
     */
    el.carrySaid.textContent =
      outcome.dropped > 0
        ? `${messageFor(language, 'app.pathImported', { count: outcome.added })} · −${outcome.dropped}`
        : messageFor(language, 'app.pathImported', { count: outcome.added });
    showIntention();
    showThread();
  });
});

/**
 * @param waiting true when the face is being restored rather than thrown.
 *
 * `data-thrown` is not "there is a face"; it is what the stylesheet uses to run
 * the pulse that says the die is a control worth pressing. A returning player
 * has a number to look at and still has to throw, so the two came apart the
 * moment the face survived a reload: the pips come back, the invitation stays.
 */
const showFace = (value: number, waiting = false): void => {
  const cells = pipsFor(value);
  el.die.dataset.thrown = String(isFace(value) && !waiting);
  el.face.replaceChildren(
    ...Array.from({ length: 9 }, (_, at) =>
      document.createElement(cells.includes(at + 1) ? 'i' : 'span'),
    ),
  );
  el.die.setAttribute(
    'aria-label',
    isFace(value)
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
  const standing = screenFor(language, of.state.loka, entered(of), titleOf, event);
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
  board.focus(plan);
  board.draw();
  if (detent === 'peek') showDetent('half');
};

const stopVisiting = (): void => {
  visiting = null;
  el.visiting.hidden = true;
  el.visitingPlan.hidden = true;
  el.thread.hidden = false;
  board.focus(entered(seat()) ? seat().state.loka : null);
  board.draw();
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
  const plan = board.planAt(event.clientX, event.clientY);
  if (plan === null) return;
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
    const piece = board.token(player.id);
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
  if (!visiting) board.focus(entered(seat()) ? seat().state.loka : null);
  board.draw();
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
    board.token(mover)?.position.set(to.x, PIECE_LIFT, to.z);
    board.draw();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const started = performance.now();
    let done = false;

    const land = (): void => {
      if (done) return;
      done = true;
      clearTimeout(backstop);
      board.token(mover)?.position.set(to.x, PIECE_LIFT, to.z);
      board.draw();
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
      board.token(mover)?.position.set(point.x, point.y + PIECE_LIFT, point.z);
      board.draw();
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
  const turn = throwFor(session, rollDie());
  session = turn.session;
  rolls[threw]?.push(turn.roll);
  showFace(turn.roll);
  if (!reducedMotion.matches) {
    el.die.classList.add('rolling');
    el.die.addEventListener('animationend', () => el.die.classList.remove('rolling'), { once: true });
  }
  board.focus(null);

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
  board.focus(entered(moved) ? moved.state.loka : null);
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

  board.draw();
  el.die.disabled = false;
  busy = false;
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
  el.reply.style.height = 'auto';
  el.reply.style.height = `${el.reply.scrollHeight}px`;
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

// --- open -------------------------------------------------------------------

// The throw the player last watched, from the seat that actually made it — not
// from whoever holds the turn now, which after a non-six is somebody else. Zero
// when nothing is known, and zero is no face at all.
showFace(rolls[saved.lastThrower ?? -1]?.at(-1) ?? 0, true);
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
