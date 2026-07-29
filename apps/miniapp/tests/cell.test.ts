// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { ARROWS, BOARD_ROWS, SNAKES, WIN_LOKA } from '@leela/engine';
import { createCell } from '../src/cell';

function cell(plan: number, label = `${plan}. A plan`) {
  const activated = vi.fn();
  const element = createCell({ plan, label, onActivate: activated, document });
  return { element, activated };
}

describe('a square is operable by keyboard', () => {
  // The defect: `<div role="button" tabindex="0">` with a click handler. All
  // 72 squares were reachable by Tab, announced as buttons, and did nothing on
  // Enter or Space. Focusable and inoperable is worse than not focusable.

  it('is a real button, not a div wearing a role', () => {
    const { element } = cell(6);
    expect(element.tagName).toBe('BUTTON');
    expect(element.getAttribute('role')).toBeNull();
  });

  it('does not submit a form it might one day sit inside', () => {
    expect(cell(6).element.type).toBe('button');
  });

  it('is reachable by keyboard without being told to be', () => {
    // A <button> is focusable natively; a tabindex would be a smell here.
    const { element } = cell(6);
    document.body.append(element);
    element.focus();
    expect(document.activeElement).toBe(element);
    expect(element.getAttribute('tabindex')).toBeNull();
  });

  it('activates on the event a keyboard press produces', () => {
    const { element, activated } = cell(23);
    document.body.append(element);
    element.click();
    expect(activated).toHaveBeenCalledWith(23);
  });
});

describe('a square says what it is', () => {
  it('carries a name, because its text is only a number', () => {
    const { element } = cell(6, '6. Delusion (moha)');
    expect(element.getAttribute('aria-label')).toBe('6. Delusion (moha)');
    expect(element.textContent).toContain('6');
  });

  it('hides the decorative marker from assistive technology', () => {
    // The direction is already in the label; an unlabelled glyph would be read
    // out as punctuation.
    const { element } = cell(12);
    const marker = element.querySelector('.mark');
    expect(marker?.getAttribute('aria-hidden')).toBe('true');
  });

  it('marks snakes, arrows and the win square for sighted players', () => {
    expect(cell(12).element.classList.contains('snake')).toBe(true);
    expect(cell(10).element.classList.contains('arrow')).toBe(true);
    expect(cell(WIN_LOKA).element.classList.contains('win')).toBe(true);
  });

  it('gives an ordinary square no marker at all', () => {
    const { element } = cell(11);
    expect(element.querySelector('.mark')).toBeNull();
    expect(element.className).toBe('cell');
  });
});

describe('every square on the board', () => {
  const plans = BOARD_ROWS.flat();

  it('is a button with a name and an activation, all seventy-two of them', () => {
    for (const plan of plans) {
      const { element, activated } = cell(plan, `${plan}. Named`);
      expect(element.tagName, `plan ${plan}`).toBe('BUTTON');
      expect(element.getAttribute('aria-label')).toBeTruthy();

      document.body.append(element);
      element.click();
      expect(activated, `plan ${plan}`).toHaveBeenCalledWith(plan);
    }
  });

  it('marks exactly the squares the engine says are special', () => {
    for (const plan of plans) {
      const { element } = cell(plan);
      const marked =
        element.classList.contains('snake') ||
        element.classList.contains('arrow') ||
        element.classList.contains('win');
      const special = plan in SNAKES || plan in ARROWS || plan === WIN_LOKA;
      expect(marked, `plan ${plan}`).toBe(special);
    }
  });
});
