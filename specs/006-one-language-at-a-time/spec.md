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
one of them is a static `import` in `packages/content/src/index.ts`, so every
one is in the entry, so a Russian player downloads Tamil, Telugu, Marathi,
Hindi, Japanese, Korean, Javanese, Punjabi, Urdu and thirteen more to read
Russian.

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

Expected after the cut, if the code and one language are all that remains:
roughly 1.5 MB decoded for a Latin-script language and under 2 MB for
Devanagari or Tamil, against 6.6 MB — and on the wire, something near 400 kB
against 1.79 MB. Those are estimates and the acceptance below is what makes
them numbers.

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

## Acceptance

- The deployment check reports the entry under 2,000,000 bytes decoded, and
  the number is read from the report rather than asserted here.
- A regression floor exists in CI: a `maxBytes` on the entry's check, so a
  later change that puts all twenty-two languages back is a red build and not
  a discovery six weeks later.
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
it offers, and not a font or asset change. The `rules.json` at 1.5 MB is the
same question asked of a different file and is deliberately left for after
this: one cut, measured, before the next.
