# Payment fix progress

Original prompt: «Сделай в мини аппе чтобы работало».

## Baseline reproduction

On the original `915da65` implementation, a simulated menu launch returned
`true` from `askTelegramToSubscribe` and recorded
`["unsupported-sendData", "close"]`, not an invoice opening. The original
file was extracted from Git for this check, not reconstructed by hand.

## Implementation boundary

The implementation separates server-owned offers and invoice creation from a
client state machine. It does not reimplement settlement, modify prices,
introduce recurring billing or grant access from an SDK callback.

## Independent review follow-ups

- A completed purchase must remain confirmable if prices are removed while
  settlement is in flight. Offer lookup must still read entitlement with an
  empty tier list; invoice creation remains unavailable.
- Dismissing the purchase panel during invoice preparation must invalidate
  the operation, so a late response cannot open checkout behind the player's
  back. An invoice already opened retains confirmation-only retry behavior.

## Verification status

Local ordinary and strict typechecks across all twelve workspaces, ESLint,
unused-field/export and configuration audits have passed during development.
These are intermediate measurements, not a release claim; final results and
the exact commit are recorded after the two review fixes and complete gates.

Initial real-control browser QA on a simulated Telegram menu launch verified
unchecked consent, server-priced choices, one request for a double tap,
`openInvoice`, cancellation feedback and zero `sendData`/`close` calls.
This is not a real Telegram payment or an iOS crash reproduction.

Node 20 in the cloud environment could not load the pre-existing TypeScript
import in Vite configuration. Node 22 successfully built the board; no
unrelated runtime/configuration patch was made to the repository.

## Final local verification

- `node scripts/audit-claims.mjs --write`: measured 5,247 tests across twelve
  workspaces and mechanically updated README (bot 1,234; WebGL 715).
- `bun run test`: 5,246 passed and one existing mobile test skipped.
- `bun run audit`: all twenty runnable audits passed. The repository's eight
  existing exemptions were not changed.
- Both typechecks across twelve workspaces, ESLint, knip, dependency-cruiser,
  actionlint, `git diff --check` and the WebGL production build passed.
- The two independent review findings were reproduced, repaired and
  independently rechecked; no remaining blocker was found in that review.

`bun run verify` itself is **not green**: its first step, `content:build`,
refuses to overwrite the committed dataset because `../leela-src` is absent
in this clean cloud checkout. No `--force` was used and no dataset file was
changed. The remaining phases were run independently; this limitation must
not be relabeled as a successful content rebuild.

## Pull request verification

PR #46 was opened from `fix-miniapp-invoice-payment`. The first CI run
caught this progress document missing from the audited command-document
registry: the final evidence section had been added after the local suites.
The registry now includes this document; no test or audit was weakened.
Final documentation edits must be included before the runnable-document
regression check, not appended after verification.

## Browser QA

On the built static artifact, real form interactions with simulated Telegram
confirmed consent gating, a single request for a double click, cancellation
feedback, and invoice opening with zero `sendData`/`close` calls. With the SDK
reporting `paid` but the server reporting no access, the controller remained
`checking` and the paywall's hidden flag stayed false. After the server
returned entitlement, the flag changed to true and the typed draft remained
`Заметка не должна потеряться`.

The payment panel was visually inspected at 390×844 and 1280×900; tier
choices, terms, consent and payment button fit the panel and there was no
horizontal document overflow. The displayed example prices are fixtures,
not measurements of current production prices.

Headless desktop cold-start attempts intermittently failed to adopt the
mocked game before the existing startup timeout. The successful responsive
inspection adopted at phone size before resizing. This is a QA limitation,
not evidence that desktop cold-start reliability was repaired by this patch.

Production, real Telegram iOS behavior, and successful settlement of a real
charge remain unverified pending merge approval and deployment. No money
was charged during implementation or tests.
