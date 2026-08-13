import { describe, expect, it } from 'vitest';
import { ARROWS, SNAKES, TOTAL_PLANS, WIN_LOKA } from '@leela/engine';

import {
  UnknownPlanError,
  boardExtent,
  boardIsComplete,
  hasPlan,
  hopHeight,
  hopPoint,
  planPosition,
  planAtPoint,
  plans,
  CELL,
  FAN,
  fanOffset,
} from '../src/layout';

describe('the board', () => {
  it('has a cell for every plan the engine declares', () => {
    expect(boardIsComplete()).toBe(true);
    expect(plans()).toHaveLength(TOTAL_PLANS);
  });

  it('numbers them 1 through 72 with nothing missing', () => {
    expect(plans()[0]).toBe(1);
    expect(plans()[TOTAL_PLANS - 1]).toBe(TOTAL_PLANS);
  });

  it('places every snake head and tail somewhere real', () => {
    for (const [head, tail] of Object.entries(SNAKES)) {
      expect(hasPlan(Number(head))).toBe(true);
      expect(hasPlan(tail)).toBe(true);
    }
  });

  it('places every arrow foot and tip somewhere real', () => {
    for (const [foot, tip] of Object.entries(ARROWS)) {
      expect(hasPlan(Number(foot))).toBe(true);
      expect(hasPlan(tip)).toBe(true);
    }
  });

  it('places the winning plan', () => {
    expect(hasPlan(WIN_LOKA)).toBe(true);
  });
});

describe('planPosition', () => {
  it('gives every plan its own spot', () => {
    const seen = new Set<string>();
    for (const plan of plans()) {
      const { x, z } = planPosition(plan);
      const key = `${x.toFixed(4)}:${z.toFixed(4)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(TOTAL_PLANS);
  });

  it('keeps every piece on the board plane', () => {
    for (const plan of plans()) {
      expect(planPosition(plan).y).toBe(0);
    }
  });

  it('runs the first row left to right', () => {
    // Plan 1 is the bottom-left corner; 2 sits to its right at the same depth.
    const one = planPosition(1);
    const two = planPosition(2);
    expect(two.x).toBeGreaterThan(one.x);
    expect(two.z).toBeCloseTo(one.z, 6);
  });

  it('reverses the next row, which is what boustrophedon means', () => {
    // 10 sits above 9 and the row then runs the other way, so 11 is to the LEFT.
    const ten = planPosition(10);
    const eleven = planPosition(11);
    expect(eleven.x).toBeLessThan(ten.x);
    expect(eleven.z).toBeCloseTo(ten.z, 6);
  });

  it('stacks rows away from the camera as the numbers climb', () => {
    expect(planPosition(10).z).toBeLessThan(planPosition(1).z);
    expect(planPosition(72).z).toBeLessThan(planPosition(10).z);
  });

  it('centres the board on the origin', () => {
    const xs = plans().map((p) => planPosition(p).x);
    const zs = plans().map((p) => planPosition(p).z);
    const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const midZ = (Math.min(...zs) + Math.max(...zs)) / 2;
    expect(midX).toBeCloseTo(0, 6);
    expect(midZ).toBeCloseTo(0, 6);
  });

  it.each([0, -1, 73, 1.5, Number.NaN])(
    'refuses plan %s rather than parking a piece at the origin',
    (plan) => {
      expect(() => planPosition(plan)).toThrow(UnknownPlanError);
    },
  );
});

describe('boardExtent', () => {
  it('covers every cell it reports', () => {
    const { width, depth } = boardExtent();
    const xs = plans().map((p) => planPosition(p).x);
    const zs = plans().map((p) => planPosition(p).z);
    expect(width).toBeGreaterThanOrEqual(Math.max(...xs) - Math.min(...xs));
    expect(depth).toBeGreaterThanOrEqual(Math.max(...zs) - Math.min(...zs));
  });
});

describe('the hop', () => {
  it('starts and lands exactly on the board', () => {
    expect(hopHeight(0)).toBe(0);
    expect(hopHeight(1)).toBe(0);
  });

  it('peaks in the middle', () => {
    expect(hopHeight(0.5, 1)).toBeCloseTo(1, 6);
    expect(hopHeight(0.5)).toBeGreaterThan(hopHeight(0.25));
    expect(hopHeight(0.5)).toBeGreaterThan(hopHeight(0.75));
  });

  it('never dips below the board, whatever it is handed', () => {
    for (const t of [-5, -0.1, 0, 0.3, 1, 1.4, 12]) {
      expect(hopHeight(t)).toBeGreaterThanOrEqual(0);
    }
  });

  it('ends where it was told to, not near it', () => {
    const from = planPosition(1);
    const to = planPosition(23);
    const landed = hopPoint(from, to, 1);
    expect(landed.x).toBeCloseTo(to.x, 6);
    expect(landed.z).toBeCloseTo(to.z, 6);
    expect(landed.y).toBe(0);
  });

  it('leaves from where it was told to', () => {
    const from = planPosition(9);
    const to = planPosition(10);
    const start = hopPoint(from, to, 0);
    expect(start.x).toBeCloseTo(from.x, 6);
    expect(start.z).toBeCloseTo(from.z, 6);
  });

  it('is airborne in between, even between neighbours', () => {
    const from = planPosition(1);
    const to = planPosition(2);
    expect(hopPoint(from, to, 0.5).y).toBeGreaterThan(0);
  });
});

describe('a point on the board', () => {
  /**
   * The board is one surface now, so this is the only thing standing between a
   * tap and the wrong plan's text. Checked over every square rather than at a
   * few: an inverse that is off by one row is off by one row everywhere, and
   * the board still looks like a board.
   */
  it('is the plan whose centre it is', () => {
    for (const plan of plans()) {
      const { x, z } = planPosition(plan);
      expect(planAtPoint(x, z)).toBe(plan);
    }
  });

  it('is the same plan anywhere inside that plan', () => {
    for (const plan of plans()) {
      const { x, z } = planPosition(plan);
      for (const dx of [-0.4, 0, 0.4]) {
        for (const dz of [-0.4, 0, 0.4]) {
          expect(planAtPoint(x + dx * CELL, z + dz * CELL), `${plan} at ${dx},${dz}`).toBe(plan);
        }
      }
    }
  });

  /** A tap on the table is not a tap on the corner square. */
  it('is nothing off the board', () => {
    const { width, depth } = boardExtent();
    expect(planAtPoint(0, depth)).toBeNull();
    expect(planAtPoint(width, 0)).toBeNull();
    expect(planAtPoint(-width, 0)).toBeNull();
    expect(planAtPoint(0, -depth)).toBeNull();
  });

  it('never answers with a plan the board does not carry', () => {
    const known = new Set(plans());
    for (let x = -8; x <= 8; x += 0.37) {
      for (let z = -8; z <= 8; z += 0.37) {
        const plan = planAtPoint(x, z);
        if (plan !== null) expect(known.has(plan)).toBe(true);
      }
    }
  });
});

/**
 * Two players standing on one square used to occupy the same point exactly, so
 * the board drew one token where there were two. Meeting on a square is not an
 * edge case in Leela — the path is sixty-eight squares long and the arrows and
 * snakes keep throwing players back onto the same few plans.
 *
 * What is checked here is what can be checked without a GPU, which is all of
 * the part that can be silently wrong: whether the points are distinct, whether
 * they stay in the cell they belong to, and whether the cluster is still on its
 * square.
 */
describe('sharing a square', () => {
  const spread = (sharing: number) =>
    Array.from({ length: sharing }, (_, at) => fanOffset(at, sharing));

  it('does not move a token that is standing alone', () => {
    for (const sharing of [0, 1]) {
      expect(fanOffset(0, sharing)).toEqual({ x: 0, y: 0, z: 0 });
    }
  });

  it('gives every token sharing a square its own point', () => {
    for (let sharing = 2; sharing <= 6; sharing += 1) {
      const points = spread(sharing).map((point) => `${point.x.toFixed(6)},${point.z.toFixed(6)}`);
      expect(new Set(points).size).toBe(sharing);
    }
  });

  /** Otherwise a crowded square drags its pieces off itself. */
  it('keeps the cluster centred on the square it is on', () => {
    for (let sharing = 2; sharing <= 6; sharing += 1) {
      const points = spread(sharing);
      const sum = (pick: (point: { x: number; z: number }) => number) =>
        points.reduce((total, point) => total + pick(point), 0);
      expect(sum((point) => point.x)).toBeCloseTo(0, 10);
      expect(sum((point) => point.z)).toBeCloseTo(0, 10);
    }
  });

  /**
   * The bound that matters, checked against the board rather than against the
   * constant: `planAtPoint` decides which cell a point belongs to, and an
   * anchor nudged past half a pitch answers with the neighbouring plan. A token
   * that reports the wrong square when tapped is worse than two tokens in one
   * place.
   */
  it('never fans a token out of its own cell, on any square', () => {
    for (const plan of plans()) {
      const centre = planPosition(plan);
      for (let sharing = 2; sharing <= 6; sharing += 1) {
        for (const point of spread(sharing)) {
          expect(planAtPoint(centre.x + point.x, centre.z + point.z)).toBe(plan);
        }
      }
    }
  });

  it('arranges the same table the same way every time', () => {
    expect(spread(4)).toEqual(spread(4));
  });

  /** Two is the common case, and depth is the direction the camera flattens. */
  it('sets two players across the board rather than one behind the other', () => {
    const [left, right] = spread(2);
    expect(Math.abs(left!.x - right!.x)).toBeCloseTo(FAN * 2, 10);
    expect(left!.z).toBeCloseTo(0, 10);
    expect(right!.z).toBeCloseTo(0, 10);
  });

  it('treats an index outside the ring as standing alone', () => {
    expect(fanOffset(4, 4)).toEqual({ x: 0, y: 0, z: 0 });
    expect(fanOffset(-1, 3)).toEqual({ x: 0, y: 0, z: 0 });
  });
});
