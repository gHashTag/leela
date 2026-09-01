/**
 * One square of the board, as a DOM element.
 *
 * Split out of `main.ts` so it can be tested. The defect that prompted it: the
 * cells were `<div role="button" tabindex="0">` with only a click handler, so
 * a keyboard user could reach all 72 squares and open none of them, while a
 * screen reader announced each one as a button. Focusable and inoperable is
 * worse than not focusable at all — it promises something and withholds it.
 */

import { ARROWS, SNAKES, WIN_LOKA } from '@leela/engine';

export interface CellOptions {
  plan: number;
  /** `"6. Delusion (moha)"` — what a screen reader should read out. */
  label: string;
  onActivate: (plan: number) => void;
  document: Document;
}

/**
 * Build a square.
 *
 * A real `<button>`, never a div with a role: native elements bring their
 * keyboard behaviour with them and cannot drift away from it.
 */
export function createCell({ plan, label, onActivate, document }: CellOptions): HTMLButtonElement {
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = 'cell';
  cell.dataset.plan = String(plan);
  cell.textContent = String(plan);

  // The visible text is a bare number; the name has to come from somewhere.
  cell.title = label;
  cell.setAttribute('aria-label', label);

  if (plan === WIN_LOKA) cell.classList.add('win');
  else if (plan in SNAKES) {
    cell.classList.add('snake');
    cell.append(mark(document, '↓'));
  } else if (plan in ARROWS) {
    cell.classList.add('arrow');
    cell.append(mark(document, '↑'));
  }

  cell.addEventListener('click', () => onActivate(plan));
  return cell;
}

/**
 * The little arrow or snake marker.
 *
 * Hidden from assistive technology: the direction is already in the label, and
 * an unlabelled glyph would be read out as punctuation.
 */
function mark(document: Document, glyph: string): HTMLElement {
  const span = document.createElement('span');
  span.className = 'mark';
  span.textContent = glyph;
  span.setAttribute('aria-hidden', 'true');
  return span;
}
