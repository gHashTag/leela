# The one invariant held by looking at it

## What is unguarded

`apps/webgl/NOTES.md` carries thirteen invariants, each one a defect that
shipped. Twelve name a test. The thirteenth reads:

| The board renders at all on first paint | looking at it — nothing else can |

Everything the suite can reach is reached: geometry against the engine's own
tables, the hop decomposition, seating, storage, the readout in every
language. What it cannot reach is whether anything was *drawn*. A shader that
fails to compile, a camera pointed at nothing, a scene whose meshes were never
added — all of them ship green.

## Why the suite cannot reach it today

`createBoard` constructs a `THREE.WebGLRenderer` on its first line. There is no
GL context in Node, so the scene cannot even be built headless, let alone read.
Splitting the scene graph from the renderer would make the *assembly* testable
without answering the question this is about, which is whether pixels appeared.

## What it was measured with, on 2026-08-23

The live board, in a real browser, reading its own drawing buffer:

```js
const gl = canvas.getContext('webgl2');
const px = new Uint8Array(320 * 320 * 4);
gl.readPixels(0, 0, 320, 320, gl.RGBA, gl.UNSIGNED_BYTE, px);
```

| what | distinct colours | lit fraction |
|---|---|---|
| the live board at `t27.ai/leela/` | **133** | 0.124 |
| a canvas never drawn into | 1 | 0 |
| a canvas cleared to one solid colour | 1 | **1.0** |

**The obvious metric is the wrong one and the calibration is what says so.**
"How much of the canvas is lit" reads 1.0 for a canvas cleared to a solid
colour — *higher than the real board's 0.124* — so a guard built on it would
pass the exact failure it exists to catch and fail the healthy case. The
discriminator is the count of distinct colours: one for both blank cases, a
hundred and thirty-three for a board that drew something.

## What this proposes

A check that opens the deployed board in a real browser, reads the drawing
buffer, and fails when the sample holds fewer than a handful of distinct
colours. Not a pixel hash — a hash fails on every legitimate change to the
board and gets deleted the first week. The question is *did anything draw*,
and the answer is a count.

## The choice this needs, with what each costs

Three ways to get a GL context into CI, none of them free, and this spec does
not pick one on its own because it is a standing dependency:

1. **Playwright or Puppeteer.** A browser download in CI (~150 MB, cached),
   and it is the only option that exercises the real thing — the deployed
   page, the real shaders, the real driver. The repository carries neither
   today; `happy-dom` in `apps/miniapp` is the closest thing and has no GL.
2. **`headless-gl`.** A native module, compiled at install, historically
   fragile across Node versions and unavailable on some CI images. Cheap when
   it works, an ongoing tax when it does not.
3. **A stubbed context handed to `THREE.WebGLRenderer`.** No dependency, and
   it answers a different question: that the renderer was *asked* to draw, not
   that anything appeared.

   **Measured 2026-08-23, and it is dearer than this spec first said.** The
   file already injects `clock` and `surface` for testability, so injecting a
   renderer alongside them looked like the cheap idiomatic path — and the
   eleven direct uses of `renderer.` are all stubbable. But two lines below the
   constructor sits `new THREE.PMREMGenerator(renderer)` followed by
   `pmrem.fromScene(new RoomEnvironment(), 0.04)`, which **renders** into a
   render target: a stub would have to satisfy PMREM's internals as well, and
   `OrbitControls` wants a real event target beside it. Not one parameter but
   three, two of them inside code that decides how the board is lit.

   So option 3 is not the free consolation prize it reads as. It is a
   refactor of the lighting path to buy an assertion that the renderer was
   called — which is worth less than option 1 and costs more than it looks.

The recommendation, if the owner wants one: **(1), against the deployed URL,
as a step in the deploy workflow rather than in the unit suite.** The
deployment check already runs there and already fetches the live site; this is
one more thing it looks at, and it is the only place where "the real driver"
is available for free.

## Acceptance

- The check fails on a board that drew nothing, proved by pointing it at a
  page whose canvas was never drawn into — not by argument.
- It passes on the live board, and the number it reports is in the report, so
  a drift toward blankness is visible before it reaches one.
- It does not fail on a legitimate visual change: no pixel hash, no colour
  list, no screenshot comparison.
- `NOTES.md`'s thirteenth row stops saying "looking at it".

## What this is not

Not a visual regression test. Whether the board looks *right* is a different
and much harder question, and a guard that claims to answer it while only
counting colours would be the third instrument this project has caught naming
something it does not test.
