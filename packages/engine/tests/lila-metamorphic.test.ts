import { describe, expect, it } from 'vitest'
import { applyRoll, initialState, hasWon } from '../src/game'
import type { GameState } from '../src/types'
import { ARROWS, SNAKES, START_LOKA, TOTAL_PLANS, WIN_LOKA, MAX_ROLL } from '../src/board'
import { seededRoller } from '../src/dice'

/**
 * Metamorphic invariants: properties that must hold for EVERY valid state and
 * EVERY die face, not just the scripted examples. These are the properties
 * the T27 spec must reproduce before any migration, so they are written over
 * the engine (the golden master) and kept deliberately exhaustive where the
 * input space is small: every loka × every face is 72 × 6 = 432 transitions —
 * all of them, no sampling.
 */

const loka = (n: number): GameState => ({
  ...initialState(),
  is_finished: false,
  loka: n
})

const allLokas = Array.from({ length: TOTAL_PLANS }, (_, i) => i + 1)
const allFaces = Array.from({ length: MAX_ROLL }, (_, i) => i + 1)

describe('metamorphic: every loka crossed with every face', () => {
  it('never leaves the board, unless the throw is refused', () => {
    for (const l of allLokas) {
      for (const f of allFaces) {
        const result = applyRoll(loka(l), f)
        if (result.event.isBlocked) continue
        expect(result.state.loka).toBeGreaterThanOrEqual(1)
        expect(result.state.loka).toBeLessThanOrEqual(TOTAL_PLANS)
      }
    }
  })

  it('never reports a win from a loka other than the win loka', () => {
    for (const l of allLokas) {
      for (const f of allFaces) {
        const result = applyRoll(loka(l), f)
        if (result.event.isGameFinished) {
          expect(result.state.loka).toBe(WIN_LOKA)
          expect(hasWon(result.state)).toBe(true)
        }
      }
    }
  })

  it('moves a piece only by the face thrown, corrected by exactly one jump', () => {
    for (const l of allLokas) {
      for (const f of allFaces) {
        const result = applyRoll(loka(l), f)
        if (result.event.isBlocked || result.event.isGameStart) continue
        const walked = result.event.from + f
        const jumped =
          result.event.jumpedFrom !== null &&
          result.event.jumpedFrom !== undefined
        if (jumped) {
          // The walk ended at the jump head; the tail is where the player stands.
          expect(result.event.jumpedFrom).toBe(walked)
        } else {
          // No jump: overshoot past the board is refused outright.
          if (walked <= TOTAL_PLANS) {
            expect(result.event.to).toBe(walked)
          }
        }
      }
    }
  })

  it('lowers through a snake and raises through an arrow', () => {
    for (const [headStr, tailStr] of Object.entries(SNAKES)) {
      const head = Number(headStr)
      const face = 1
      const approach = head - face
      if (approach < 1) continue
      const result = applyRoll(loka(approach), face)
      expect(result.state.loka).toBe(tailStr as number)
    }
    for (const [headStr, tailStr] of Object.entries(ARROWS)) {
      const head = Number(headStr)
      const face = 1
      const approach = head - face
      if (approach < 1) continue
      const result = applyRoll(loka(approach), face)
      expect(result.state.loka).toBe(tailStr as number)
    }
  })

  it('never counts three consecutive sixes without resetting the run', () => {
    let state = loka(START_LOKA)
    for (let i = 0; i < 5; i += 1) {
      state = applyRoll(state, 6).state
      expect(state.consecutive_sixes).toBeLessThan(3)
    }
  })

  it('is deterministic: the same seed replays the same 10,000 faces', () => {
    const a = seededRoller(2026_11_13)
    const b = seededRoller(2026_11_13)
    const facesA = Array.from({ length: 10_000 }, () => a())
    const facesB = Array.from({ length: 10_000 }, () => b())
    expect(facesA).toEqual(facesB)
    for (const f of facesA) {
      expect(f).toBeGreaterThanOrEqual(1)
      expect(f).toBeLessThanOrEqual(MAX_ROLL)
    }
  })

  it('refuses every face outside 1..6 from every loka', () => {
    for (const l of allLokas) {
      for (const f of [0, -1, 7, 1.5]) {
        expect(() => applyRoll(loka(l), f)).toThrow(RangeError)
      }
    }
  })
})
