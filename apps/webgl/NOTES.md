# The board in three dimensions — where this stands

A browser Leela on the same rules the phone plays. No install, no account.
Built on `@leela/engine`, so the rules are not reimplemented here and cannot
drift from the apps.

**Every number in this file is dated, and none of them is repeated from
somewhere that already guards it.** The version before this one said the
bundle was 490 kB, that three.js dominated it, that splitting three.js was
"not done", that there was no WebGL fallback, that the reflection was a prompt
with no answer, and that 258 tests passed. Six claims, six false, and nothing
in the repository was watching — `audit-claims` reads README and only README.
A count written in a second place is a count that will rot, so the test totals
live in [the README table](../../README.md) and the deployed sizes live in the
deployment check's ceilings, and this file points at them.

## Why a browser at all

Measured 2026-08-11, re-measured 2026-08-22, and the App Store half
re-measured **2026-08-23 through Apple's own lookup API**, which is worth more
than any of the prose: anyone can rerun it and get the same answer.

    curl -s "https://itunes.apple.com/lookup?id=6504097981,1574737998,1296604457"

| first released | app | live version | last updated | ratings | genre |
|---|---|---|---|---|---|
| **2017-10-15** | **Leela Chakra Ai — ours** | 6.10 | 2024-08-12 | 1 | Education |
| 2021-11-16 | Leela: The Game of Knowledge | 2.2.0 | 2024-08-27 | 154 | Lifestyle |
| 2024-09-03 | Leela the Queen: Inner Journey | 1.0.6 | 2025-02-05 | 7 | Games |

Two things fall straight out of it.

**The "first Leela in the store, first AI Leela" claim is true and now has a
citation.** Ours predates *Leela: The Game of Knowledge* by four years and one
month, and *Leela the Queen* — which markets itself as the first AI Leela — by
six years and ten months. That is Apple's record, not ours.

**The whole iOS field is asleep.** Dormant 24, 24 and 19 months respectively,
by last-update date on 2026-08-23. Nobody is shipping there. Which means iOS
is not where this is won or lost, and the browser and the chat are.

The web and chat field, from the 2026-08-22 sweep, with today's re-checks
marked:

| Competitor | Shape | Has of ours | Re-checked |
|---|---|---|---|
| Leela Quest (web/iOS/Android) | browser board, credits ~$4.99/game | link, board | live 200 today; the price is carried from 08-22, not re-confirmed |
| quantumgame.love | browser + AI guide, solo by design | link, AI | **live today, 1490 ₽ still on the page** |
| com.vtm.lila (Android) | 10K+ installs, ads, "Leela Chakra" in its title | distribution | carried from 08-22 |
| LeelaRoom / OMKARA / MAGICLEELA | facilitator businesses, some via Telegram | group (hosted) | carried from 08-22 |
| ChatGPT-prompt Leela (viral, vc.ru 08-2026) | free text-only game master | AI (free) | carried from 08-22 |

The 2026-08-11 claim — *a link that opens a playable board is ours alone* — was
falsified by the second sweep and stays retired: Leela Quest has played in a
browser since 2025-07, and quantumgame.love ships link + AI guide.

What no one else has, singly or combined: **group play in a chat with no human
host**, a companion whose answers stream with visible reasoning and rest on the
vedic texts, a voice that speaks them, and a daily plan-word that respects the
channel — all behind one link. The wedge is the combination.

## Weak points, named honestly

These are the places this can be wrong, listed so the next loop starts from
them rather than rediscovering them. Each says how it was measured.

1. **The shopfront is two years stale and has one rating.** Not the board's
   fault and the sharpest number here: the live App Store listing is 6.10 from
   2024-08-12, while TestFlight carries 7.0(5). Eight years and ten months on
   sale, one rating. Every competitor above is dormant too, so this is a race
   nobody is running — but 1 against 154 is still 1. *Measured by the lookup
   API above, 2026-08-23. Owner-gated: pressing Add for Review is his.*
2. **No shared table.** Seats exist in the model, and two people still cannot
   sit at one board across two devices. The chat has group play; the browser
   board does not. That is the whole of what LeelaRoom sells. *Unchanged and
   re-read in the source, 2026-08-23.*
3. **Nothing is measured.** No analytics, so "does anyone finish a game" is
   unanswerable. Adding it is a privacy decision, not only a technical one.
   *Confirmed by grep, 2026-08-23: no analytics of any kind in this app.*
4. **The tests cannot see the picture.** They cover geometry, rules, text,
   voice and storage — everything except whether the board *looks* right. A
   render regression ships green. *Count in the README table, which is
   audited; not repeated here.*
5. **The voice is 398.6 MB.** Emily is genuinely good and genuinely enormous,
   and the download is one deliberate tap. Nobody on mobile data will take it.
   *Measured in `supertonic.ts`; the progress bar that made it look hung was
   fixed 2026-08-23.*

## What is verified, and by what

- Rules, geometry, text, storage and voice: the suite. Its size is in the
  README table and is audited there.
- Size on the wire: the deployment check's two ceilings — one on the entry,
  one on **what a whole reader downloads**, which is the honest number now
  that the heavy files are chunks the page does not name. Both are measured
  against the live site on every deploy.
- The board plays: a die reported 3 and the board said *"It takes a six to
  enter the game"*. Then, 2026-08-23, a six was thrown in a real browser on
  the live site, the board read «Заблуждение (моха)» in Russian, and the
  companion answered aloud in Emily's voice — four buffers, 20.47 s, and the
  plain fallback voice was never called.

## What the last loop closed

The four items this section used to list are done, which is why they are not
listed any more: three.js split out of the entry (74b1729), the no-WebGL
fallback and its message (`drawable.ts`), the companion wired to a deployed
`/api/ask` with streamed reasoning, and the per-language content split that
took a reader from 7,098,593 bytes to 1,353,972 — 340,683 on the wire.

## The next loop

Ordered by what unblocks the most:

1. A render smoke test: draw one frame headless, hash the pixels, fail on
   drift (weak point 4). Needs a GPU-less renderer in CI, and it is the only
   class of regression nothing here can see.
2. A shared table (2) — the one thing a competitor sells that this cannot do.
   Needs a server holding sessions, which the `/api/ask` deployment already
   proves is affordable.
3. Analytics, if and only if the privacy question in (3) is answered first.
