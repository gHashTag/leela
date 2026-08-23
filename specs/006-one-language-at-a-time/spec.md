# The board carries twenty-two languages to a reader of one

## What it costs, measured three ways

The 3D board's entry, live at `t27.ai/leela/`, on 2026-08-23:

| | on the wire | decoded |
|---|---|---|
| `index-*.js` (the board and all its text) | 1,790,343 | 6,624,207 |
| `three-*.js` | 121,381 | 473,971 |

Measured by `curl` with `content-length`, by gunzipping the response, and by
the browser's own `PerformanceResourceTiming` on the live page — the three
agree to the byte. **93.7 per cent of the JavaScript a phone downloads is the
entry, and the entry is almost entirely text the reader cannot read.**

`packages/content/data` is 8,089,297 bytes across 24 files: `rules.json` at
1,514,788 and twenty-two `plans.<lang>.json` from 534,084 (Tamil) down. Every
one of them is a static `import` in `packages/content/src/index.ts`.

**Which of them actually ship was measured, not assumed**, by probing the live
entry for a distinctive string from each file on 2026-08-23:

- all twenty-two plan files are in it — `ta`, `te`, `hi`, `mr`, `ru`, `en`,
  `zh` and `ur` were each found by a fifty-character excerpt of plan 10;
- **`rules.json` is not.** Rollup already drops it: no consumer of the board
  calls `rulesFor`. The 1.5 MB is a docs-generator cost, not a board cost, and
  the earlier version of this spec was wrong to leave it as "the same question
  asked of a different file" — there is no question to ask.

So a Russian player downloads Tamil, Telugu, Marathi, Hindi, Japanese, Korean,
Javanese, Punjabi, Urdu and thirteen more to read Russian.

**This measurement is younger than the instrument that took it.** Until
2026-08-23 the deployment check reported `text.length` — characters — as
bytes, which understated this file by 41 per cent. Every earlier number the
loop's journal quotes about bundle weight is wrong by that much. Do not
compare against them; compare against the table above.

## What this proposes

One language at a time. The board knows its language before it needs any plan
text — Telegram hands it over, or `navigator.language` does — so the plans for
that language can be a chunk fetched on demand, and the other twenty-one need
never be fetched at all.

**This is no longer an estimate.** The experiment was run on 2026-08-23: the
twenty-one non-English static imports were replaced with a map of
`() => import('../data/plans.xx.json')` thunks, English kept static because it
is the fallback and must always be present, and `apps/webgl` was built.

| | decoded | gzip |
|---|---|---|
| the entry today | 6,624,622 | 1,790,216 |
| the entry with only English | **334,820** | **112,100** |

A 95 per cent cut. `plans.en.json` is 208,374 bytes of that, so the board's own
code is about 126 kB. The experiment was then reverted — see below for why —
and both suites are green again at 702 and 907.

Two things the experiment established that no reading of the source would
have:

1. **The chunks were not emitted at all**, because nothing called the loader:
   Rollup treated the whole map as dead. The 334,820 figure is therefore the
   floor — the true post-cut entry is that plus one language, fetched
   separately, so about 430 kB decoded for English or Russian and about 700 kB
   for Tamil.
2. **The blast radius is exactly twenty-four tests**: seventeen in
   `@leela/content` across eight files (`languages-script`, `languages`,
   `corrections`, `numbers`, `arithmetic`, `a-mark-that-closes-nothing`,
   `nowhere-to-rest`) and seven in `@leela/bot` across two (`language`,
   `commands`). Every one of them reads a non-English language through the
   synchronous accessor, which is precisely the set that must await a load.

## The trap, and why it is not the blocker it looks like

The iOS app loads this same build from `file://` inside a `WKWebView`, and a
`file://` page has an origin the fetch specification calls `null`: WebKit
refuses to let it reach any other origin at all, before CORS is consulted. A
dynamic `import()` of a sibling chunk is exactly such a reach, and this is
where a per-language split normally dies.

It does not die here. `src/screens/Tabs/BoardScreen/index.tsx` already sets
all three of `allowFileAccess`, `allowFileAccessFromFileURLs` and
`allowUniversalAccessFromFileURLs`, and scopes `allowingReadAccessToURL` to
the board's directory — they were set for the companion, and they are the
same three flags a chunk fetch needs.

**That is an argument, not a verification.** The acceptance below requires the
simulator, because a flag being present in the source is not a chunk arriving
in a WebView.

## What the implementation must decide, with the reasons found

**The language switch reloads the page** (`main.ts`, and its own comment says
why: every string is read from `language` once at startup, so re-translating
in place would leave a screen half in each). That is a gift — there is exactly
one place a language has to be loaded, before the first read, and no in-place
swap to thread anywhere.

**A silent English fallback for an unloaded language is the bug this project
keeps having.** `planFor` falling back without a word is how the truncating
header and the falling-back voice both survived for weeks. The loader must
make the absence speak — one line naming the language and that English was
served in its place — so a forgotten `await` in some future entry point is
found in a log rather than by a Russian player reading English.

**Node and Metro must load everything.** The bot serves twenty-two languages
from one process and cannot await per request, so it awaits once at startup;
the same for anything else that is not the board. The web board is the only
consumer that wants one.

**One unknown is left, and it is small:** whether the load point can be a
top-level `await` in `main.ts` under Vite's configured target, or whether it
has to be a `.then()` before the rest of the module runs. Try the first; the
second always works.

## Acceptance

- The deployment check reports the entry under 2,000,000 bytes decoded, and
  the number is read from the report rather than asserted here.
- ~~A regression floor exists in CI~~ — **shipped 2026-08-23 (31f3e85)**:
  `maxAssetBytes` on the 3D board's check, inherited by the code files it
  names, set at 7,000,000 which is today and a little. Lowering it to about
  2,000,000 is one line and a test asserts the current value, so the lowering
  is deliberate rather than a drift.
- The board still renders and still speaks its language on the web — smoke-run
  green against the live deployment.
- **The iOS board, built from this bundle and run in the simulator, still
  shows plan text.** If the chunk cannot be fetched over `file://`, the iOS
  build gets `inlineDynamicImports` and the web gets the split; two builds are
  an acceptable answer, a broken iOS board is not.
- No language loses its text: every one of the twenty-two still resolves, by
  test, through whatever the new path is.

## What this is not

Not a change to what the board says, not a change to the twenty-two languages
it offers, and not a font or asset change. `rules.json` needs nothing done to
it: it is already absent from the board's entry, measured above.

## Why the experiment was reverted rather than finished

Twenty-four tests, three packages and two runtimes is more than fitted in the
window left in the iteration that measured it, and the loop's contract prefers
a thing finished to a thing half-done — especially with a cron that may start
the next iteration on top of a working tree. What shipped instead was the
ceiling this spec asks for (`maxAssetBytes`, 7,000,000, one line to lower),
and this section, which turns the remaining work into transcription.
