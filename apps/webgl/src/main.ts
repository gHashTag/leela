import { LEGACY_MOBILE, WIN_LOKA, type MoveEvent } from '@leela/engine';

import { directionOf, messageFor, planFor, resolveLanguage, titlesFor } from './canon';
import { describeMove } from '@leela/content';
import { fileName, revisited, writingsOn, MAX_REPORT_CHARS } from '@leela/journal';

import { Companion, type Line, type Rests } from './companion';
import { DEITIES, deityFor } from './deities';
import { screenFor, toneOf } from './hud';
import { hopPoint, planPosition } from './layout';
import { browserStore, read, write } from './kept';
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
import { Play, type Hop } from './play';
import { createBoard } from './scene';
import { dragged, stepped, type Detent, type Heights } from './sheet';
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
const saved = read(store);

const board = createBoard(el.canvas);
// `undefined` takes the default roller; the third argument is the resumed game,
// and `Play` falls back to `initialState()` when there is none.
const play = new Play(LEGACY_MOBILE, undefined, saved.state ?? undefined);

/**
 * Every throw of this game, in order — the history, and the only copy of it.
 *
 * The squares are not stored: replaying these through the engine is what says
 * where the player has been, so the history cannot drift from the rules. The
 * screen that reads them back does not exist yet; the record does.
 */
const rolls: number[] = [...saved.rolls];
const companion = new Companion({ language });

const keep = (): void => write(store, { state: play.state, deity: deity.id, rolls });

// --- who is playing ---------------------------------------------------------

// Who was playing last time. One record holds the deity and the game, because
// two keys is two things to keep in step — and the deity outliving the board it
// was standing on is exactly the state that reads as a bug.
let deity = deityFor(saved.deity);

/** Open or shut the roster, and say which it is for a screen reader. */
const showRoster = (open: boolean): void => {
  el.who.hidden = !open;
  el.lotus.setAttribute('aria-expanded', String(open));
};

const chooseDeity = (next: (typeof DEITIES)[number]): void => {
  deity = next;
  keep();
  board.setDeity(next);
  el.lotusMark.style.setProperty('--lotus', css(next.colour));
  el.lotus.setAttribute('aria-label', `${next.latin} — ${messageFor(language, 'app.play')}`);
  for (const button of el.who.querySelectorAll<HTMLElement>('.deity')) {
    button.setAttribute('aria-checked', String(button.dataset.deity === next.id));
  }
  // Chosen is chosen: the roster is a menu, and a menu that stays open after a
  // choice is a menu the player has to dismiss for no reason.
  showRoster(false);
};

el.lotus.addEventListener('click', () => showRoster(el.who.hidden));

// Anywhere else shuts it, which is what every other menu on a phone does.
document.addEventListener('pointerdown', (event) => {
  if (el.who.hidden) return;
  const on = event.target as Node;
  if (!el.who.contains(on) && !el.lotus.contains(on)) showRoster(false);
});

for (const each of DEITIES) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'deity';
  button.role = 'radio';
  button.dataset.deity = each.id;
  button.setAttribute('aria-checked', String(each.id === deity.id));
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
  el.who.append(button);
}

board.setDeity(deity);
el.lotusMark.style.setProperty('--lotus', css(deity.colour));
el.lotus.setAttribute('aria-label', `${deity.latin} — ${messageFor(language, 'app.play')}`);

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
  el.thread.lastElementChild?.scrollIntoView({
    block: 'nearest',
    behavior: reducedMotion.matches ? 'auto' : 'smooth',
  });

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
const showPath = (): void => {
  const steps = pathOf(rolls, LEGACY_MOBILE);
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
   * The file name, not `app.pathExported`.
   *
   * That sentence says *saved, and a readable copy is on the clipboard*, and it
   * is true on the mini app because it copies `toText(...)` — a prose rendering
   * — a line before it announces. `toText` lives in `apps/miniapp/src/journal-file.ts`
   * and not in `@leela/journal`, so this surface cannot make the second half of
   * that sentence true, and a message key borrowed for its first half only is
   * how `app.gameNotRead` came to promise this app's players that accounts it
   * does not have were untouched.
   *
   * A file name is language-neutral and it is a fact. Moving `toText` into the
   * package — where `REPORTS_KEY` and `isIntention` already are, for exactly
   * this reason — is the fix, and it is another app's file to move.
   */
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

const showFace = (value: number): void => {
  const cells = pipsFor(value);
  el.die.dataset.thrown = String(isFace(value));
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

const showStanding = (event: MoveEvent | null): void => {
  const standing = screenFor(language, play.plan, play.entered, titleOf, event);
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
  board.focus(play.entered ? play.plan : null);
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
  if (play.entered && plan === play.plan) stopVisiting();
  else visit(plan);
});

// --- the throw --------------------------------------------------------------

const settle = (): void => {
  const { x, z } = planPosition(play.plan);
  board.piece.position.set(x, PIECE_LIFT, z);
  if (!visiting) board.focus(play.entered ? play.plan : null);
  board.draw();
};

/** Walks one hop, resolving when the piece has landed. */
const walk = (hop: Hop): Promise<void> => {
  const from = planPosition(hop.from);
  const to = planPosition(hop.to);

  if (reducedMotion.matches || hop.from === hop.to) {
    board.piece.position.set(to.x, PIECE_LIFT, to.z);
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
      board.piece.position.set(to.x, PIECE_LIFT, to.z);
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
      board.piece.position.set(point.x, point.y + PIECE_LIFT, point.z);
      board.draw();
      if (t < 1) requestAnimationFrame(frame);
      else land();
    };
    requestAnimationFrame(frame);
  });
};

let busy = false;

const takeTurn = async (): Promise<void> => {
  if (busy) return;
  busy = true;
  el.die.disabled = true;
  if (visiting) stopVisiting();

  const turn = play.roll();
  rolls.push(turn.roll);
  showFace(turn.roll);
  if (!reducedMotion.matches) {
    el.die.classList.add('rolling');
    el.die.addEventListener('animationend', () => el.die.classList.remove('rolling'), { once: true });
  }
  board.focus(null);

  for (const hop of turn.hops) await walk(hop);

  board.focus(play.entered ? play.plan : null);
  showStanding(turn.event);

  // The companion speaks on every landing, not on request. The game's own loop
  // puts a reflection between one throw and the next; a companion that waits to
  // be addressed turns that into a form nobody fills in.
  if (play.entered) {
    companion.arrived(
      play.plan,
      turn.event,
      el.say.textContent ?? '',
      writingsOn(readAll(store), play.plan),
    );
    showThread();
  }
  showPath();

  if (turn.won) {
    // Won, and still standing on 68 until the next throw. Say so, keep the
    // text of the winning plan on screen, and let the player start again when
    // they are ready rather than resetting the board underneath them.
    el.say.textContent = messageFor(language, 'app.won');
    el.say.dataset.tone = 'win';
    play.reset();
    companion.reset();
    rolls.length = 0;
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
  }

  // Written after the turn has fully resolved, not after the roll: a game saved
  // mid-hop is a game that resumes having taken a snake it was still sliding
  // down, and `play.state` is only the whole truth once the walk is over.
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
  if (play.entered) keepWritten(store, { plan: play.plan, text: said, at: Date.now() });

  void companion.say(said).then(showThread);
  showThread();
});

// --- open -------------------------------------------------------------------

showFace(0);
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
if (saved.state && play.entered) {
  companion.arrived(
    play.plan,
    null,
    messageFor(language, 'app.standing', { plan: play.plan, title: titleOf(play.plan) }),
    writingsOn(readAll(store), play.plan),
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
