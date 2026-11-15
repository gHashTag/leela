# t27b: wrapping multiply loses low 32 bits via f64

## Summary

`a *% b` on `u32` does not produce the low 32 bits of the full product. On real
operands the multiply appears to be computed through f64, which represents
integers exactly only up to 2^53. A full 32x32-bit product needs up to 64
significant bits, so the bits between 2^53 and 2^64 (which include the low 32
bits of the wrapped result whenever the product exceeds 2^53) are corrupted.

## Minimal repro

```t27
module repro;

pub fn mul32(a: u32, b: u32) -> u32 {
    // reference implementation: 16-bit split; every partial product is
    // < 2^32 and exact in u32 (and in f64).
    let al: u32 = a & 65535;
    let ah: u32 = a >> 16;
    let bl: u32 = b & 65535;
    let bh: u32 = b >> 16;
    let ll: u32 = al * bl;
    let mid: u32 = (ah * bl).+% (al * bh);
    ll.+% (mid << 16)
}

pub fn broken(a: u32, b: u32) -> u32 { a *% b }

test imul_equivalence {
    // Math.imul(2423512478, 1831565815) == 2736030066
    assert mul32(2423512478, 1831565815) == 2736030066;
    assert broken(2423512478, 1831565815) != 2736030066;  // <- fails the other way
}
```

Observed: `broken(2423512478, 1831565815) == 2736030066` is false — the `*%`
result differs from the true low-32 product. `mul32` (16-bit split) matches
`Math.imul` on every operand pair checked, including extremes:

- `mul32(4294967295, 2) == 4294967294`
- `mul32(1831576480, 1831565815) == 2438037344`
- `mul32(0, 4294967295) == 0`

## Expected

`a *% b` (u32) == low 32 bits of the full product == `Math.imul(a, b)`.

## Actual

Diverges from `Math.imul` on operands whose full product exceeds 2^53.

## Impact

Any bit-exact port of 32-bit hashing / PRNG code (mulberry32, xxhash, SHA-256
round constants, LCGs) silently produces wrong sequences instead of failing.
Found while porting `seededRoller` from
`packages/engine/src/dice.ts` (Leela) to `specs/game/dice.t27` — the spec
failed its engine-derived test vectors until the multiply was replaced with
the 16-bit split.

## Affected spec

`specs/game/dice.t27` (worktree `ios-nemotron-release` of `gHashTag/leela`),
header comment documents the defect alongside the workaround.
