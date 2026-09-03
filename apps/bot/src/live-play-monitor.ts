/**
 * What the live game is doing wrong, derived from production state alone.
 *
 * The twenty-eight `audit-*.mjs` scripts read the source: they answer "is this
 * code self-consistent". Every one of them was green on 2026-09-03 while the
 * production database said the game had been thrown seven times in its life and
 * six of those throws moved nothing. **No audit could have found that, because
 * nothing is wrong with the code.** The defect is in what the code does to the
 * people using it, and the only place that is visible is the live state.
 *
 * So this is the other half: a verdict about behaviour rather than about
 * structure. It is pure on purpose — it takes a snapshot and returns findings,
 * so it can be tested against planted damage instead of waiting for real damage
 * to appear. `scripts/monitor-live-play.mjs` is the half that fetches.
 *
 * Every finding carries a `fix`. A monitor that reports a number and leaves the
 * reader to guess what it means gets read once. The rule for writing one: say
 * what a player experienced, not what a counter reached.
 */

/** One throw of the die, as `game_steps` records it. */
export interface Throw {
  readonly userId: string;
  readonly roll: number;
  readonly fromPlan: number;
  readonly toPlan: number;
  /** Epoch milliseconds. */
  readonly at: number;
}

/** A table someone opened. */
export interface Table {
  readonly id: string;
  readonly rollCount: number;
  readonly updatedAt: number;
}

/** A paid period, live or refunded. */
export interface Entitlement {
  readonly userId: string;
  readonly until: number;
  readonly refundedAt: number | null;
}

/** How far a player walked down the paywall funnel. */
export interface FunnelRow {
  readonly userId: string;
  readonly trialAt: number | null;
  readonly paywallAt: number | null;
  readonly invoiceAt: number | null;
  readonly purchaseAt: number | null;
}

/** Everything the monitor is allowed to look at. */
export interface Snapshot {
  readonly throws: readonly Throw[];
  readonly tables: readonly Table[];
  readonly entitlements: readonly Entitlement[];
  readonly funnel: readonly FunnelRow[];
  /** Lines from the running service, newest last. */
  readonly log: readonly string[];
  /** Free moves the paywall grants, or null when no paywall is configured. */
  readonly freeMoves: number | null;
  /** Now, in epoch milliseconds. */
  readonly now: number;
}

export type Severity = 'blocking' | 'costly' | 'watch';

export interface Finding {
  readonly id: string;
  readonly severity: Severity;
  /** What a player experienced. Not a counter. */
  readonly says: string;
  /** The measurement behind it, so nobody has to trust the sentence. */
  readonly evidence: string;
  /** What to change. Concrete enough to start on. */
  readonly fix: string;
}

/** A throw that left the piece where it was. */
const stalled = (t: Throw): boolean => t.fromPlan === t.toPlan;

/** Plan 68 is where a player waits for the six that lets them in. */
const WAITING_PLAN = 68;

/**
 * Players who threw, never once moved, and have not come back.
 *
 * This is the shape of the entry gate as a person meets it: the die turns, the
 * piece does not, and the rule that explains it is a sentence they have to
 * believe. Five sixths of throws do nothing, so a player needs six throws on
 * average and can easily need fifteen.
 */
const QUIET_FOR_MS = 24 * 60 * 60 * 1000;

export function findings(s: Snapshot): Finding[] {
  const out: Finding[] = [];
  const total = s.throws.length;

  // 1. The door.
  if (total > 0) {
    const atDoor = s.throws.filter((t) => t.fromPlan === WAITING_PLAN && stalled(t));
    const share = atDoor.length / total;
    if (share >= 0.5) {
      const byUser = new Map<string, Throw[]>();
      for (const t of s.throws) byUser.set(t.userId, [...(byUser.get(t.userId) ?? []), t]);
      const neverIn = [...byUser.entries()].filter(([, ts]) => ts.every(stalled));
      const lost = neverIn.filter(
        ([, ts]) => s.now - Math.max(...ts.map((t) => t.at)) > QUIET_FOR_MS,
      );
      out.push({
        id: 'entry-gate-eats-the-first-session',
        severity: lost.length > 0 ? 'blocking' : 'costly',
        says:
          `${atDoor.length} of ${total} throws in this game's whole history moved nothing: ` +
          'the player was at the door waiting for a six. ' +
          (lost.length > 0
            ? `${lost.length} player(s) threw, never once moved, and have not come back.`
            : 'Nobody has been lost to it yet.'),
        evidence:
          `stalled-at-${WAITING_PLAN}=${atDoor.length}/${total} (${Math.round(share * 100)}%); ` +
          `never-entered-and-quiet=${lost.map(([u]) => u).join(',') || 'none'}`,
        fix:
          'The rule is canonical and must not change silently — that would be a new RuleSet. ' +
          'What can change is what a refused throw SAYS and SHOWS: name the odds out loud ' +
          '("five throws in six do nothing; keep going"), count the attempts back to the ' +
          'player, and let the board animate the die rather than answering with a line of ' +
          'text that looks like nothing happened.',
      });
    }
  }

  // 2. A paywall nobody has ever paid.
  //
  // Guarded on there having been play at all. A bot deployed an hour ago has no
  // subscriptions and no defect, and a monitor that cannot tell "no evidence"
  // from "damage" produces a wall of alarms on its first run after any
  // migration — which is how a monitor stops being read. Its own test planted
  // an empty database and required silence; this branch failed it.
  if (s.freeMoves !== null && total > 0) {
    const live = s.entitlements.filter((e) => e.refundedAt === null && e.until > s.now);
    if (live.length === 0) {
      const spent = new Map<string, number>();
      for (const t of s.throws) {
        if (!stalled(t)) spent.set(t.userId, (spent.get(t.userId) ?? 0) + 1);
      }
      const blocked = [...spent.entries()].filter(([, n]) => n >= (s.freeMoves as number));
      out.push({
        id: 'paywall-with-no-door-ever-used',
        severity: blocked.length > 0 ? 'blocking' : 'costly',
        says:
          'No subscription has ever been live. ' +
          (blocked.length > 0
            ? `${blocked.length} player(s) have spent all ${s.freeMoves} free moves and cannot throw at all.`
            : `Nobody has reached the ${s.freeMoves}-move limit yet, so the wall is untested in production.`),
        evidence:
          `live-entitlements=0; rows=${s.entitlements.length}; ` +
          `at-or-past-limit=${blocked.map(([u, n]) => `${u}:${n}`).join(',') || 'none'}`,
        fix:
          'Buy the subscription once, end to end, with a real Stars invoice, and keep the ' +
          'receipt as a fixture. A purchase path with zero completions in its entire history ' +
          'is not a price problem yet — it is an untested path, and the first player to ' +
          'reach it is the one who finds out.',
      });
    }
  }

  // 3. Instrumentation that has never fired — WHEN IT SHOULD HAVE.
  //
  // This check used to read `funnel.length === 0 && any real move exists`, and
  // it was wrong. It reported the funnel as broken on one counted move in the
  // whole game's history, when the first funnel row is only written at three.
  // The owner asked me to fix the funnel; there was nothing wrong with it.
  // Nobody had reached the trial threshold and nobody had been refused, so zero
  // rows was the correct answer and **my instrument was the defect.**
  //
  // The rule now: complain only when a row was OWED. A player at or past the
  // free-move limit should have a `trial`; a player who threw and was refused
  // should have a `paywall`. Absent those, an empty funnel is no evidence at
  // all — and reporting no-evidence as damage is how a monitor stops being
  // read, which costs more than the check is worth.
  const counted = new Map<string, number>();
  for (const t of s.throws) {
    if (!stalled(t)) counted.set(t.userId, (counted.get(t.userId) ?? 0) + 1);
  }
  const owedARow =
    s.freeMoves === null
      ? []
      : [...counted.entries()].filter(([, n]) => n >= (s.freeMoves as number));

  if (s.funnel.length === 0 && owedARow.length > 0) {
    out.push({
      id: 'funnel-recorded-nothing',
      severity: 'costly',
      says:
        `${owedARow.length} player(s) reached the ${s.freeMoves}-move limit and the payment ` +
        'funnel has no rows at all. A milestone that was owed was not written, so every ' +
        'question about where players are lost is currently unanswerable.',
      evidence:
        `payment_funnel rows=0; at-or-past-limit=${owedARow.map(([, n]) => n).join(',')}; ` +
        `freeMoves=${s.freeMoves}`,
      fix:
        'The store upserts `WHERE trial_at IS NULL`, so a retry is free and the first ' +
        'timestamp stands — a missing row is the CALLER not writing, not the table ' +
        'refusing. Do NOT start by loosening `markMoveMilestone`\'s `moved === FREE_MOVES` ' +
        'to `>=`: both roll surfaces call accessFor first and refuse when mayMove is false, ' +
        'so a free player is stopped ON the limit and can never take the step that would ' +
        'carry them past it. The two are identical in every reachable state. Look instead ' +
        'at whether the milestone runs at all after the move is durable.',
    });
  }

  // 3b. Where the funnel says people stop.
  //
  // These four columns exist to answer one question — which step loses people —
  // and until now nothing read them, which `audit-unread` said out loud. A
  // funnel written and never read is the same defect as a funnel never written:
  // both leave the question unanswered while looking like it is covered.
  const sawTheWall = s.funnel.filter((r) => r.paywallAt !== null);
  const neverInvoiced = sawTheWall.filter((r) => r.invoiceAt === null);
  const invoicedNeverBought = s.funnel.filter(
    (r) => r.invoiceAt !== null && r.purchaseAt === null,
  );
  if (sawTheWall.length > 0 && neverInvoiced.length === sawTheWall.length) {
    out.push({
      id: 'nobody-gets-past-the-offer',
      severity: 'costly',
      says:
        `${sawTheWall.length} player(s) hit the paywall and not one of them ever saw an ` +
        'invoice. The step that fails is the offer, not the price.',
      evidence: `paywall=${sawTheWall.length}; invoice=0; trial=${s.funnel.filter((r) => r.trialAt !== null).length}`,
      fix:
        'Read what the bot actually sends when the free moves run out, in the language the ' +
        'player is using. A wall with no button on it is indistinguishable from a bug.',
    });
  } else if (invoicedNeverBought.length > 0) {
    out.push({
      id: 'invoices-opened-and-abandoned',
      severity: 'watch',
      says: `${invoicedNeverBought.length} player(s) opened an invoice and did not pay it.`,
      evidence: `invoice-without-purchase=${invoicedNeverBought.length}/${s.funnel.length}`,
      fix:
        'This is the price step, and it is the only one of the five where that is true. ' +
        'Compare the Stars amount against what a player was told before the invoice opened.',
    });
  }

  // 4. Tables opened and never thrown on.
  const cold = s.tables.filter((t) => t.rollCount === 0);
  if (cold.length > 0) {
    out.push({
      id: 'tables-opened-and-never-played',
      severity: 'watch',
      says: `${cold.length} table(s) were opened and the die was never thrown once.`,
      evidence: cold.map((t) => `${t.id}@${new Date(t.updatedAt).toISOString().slice(0, 10)}`).join(','),
      fix:
        'Find what the first screen asks for before it lets someone throw. A table that ' +
        'reaches roll_count 0 was abandoned before the game began, which is a different ' +
        'defect from one abandoned at the door.',
    });
  }

  // 5. The companion.
  const refusals = s.log.filter((l) => /companion silenced|ModelError|429/.test(l));
  if (refusals.length > 0) {
    out.push({
      id: 'companion-is-out-of-quota',
      severity: 'costly',
      says:
        'The AI companion is refusing requests, so the board answers with canonical text ' +
        'where a player was promised a reply.',
      evidence: `${refusals.length} refusal line(s); newest: ${refusals[refusals.length - 1]?.slice(0, 120)}`,
      fix:
        'Quota, not code. Top up the provider or configure a second one; the fallback ' +
        'already works, but it is a different product from the one the copy sells.',
    });
  }

  return out;
}

/** Findings as lines, worst first, for a log or an admin message. */
export function report(f: readonly Finding[]): string[] {
  const rank: Record<Severity, number> = { blocking: 0, costly: 1, watch: 2 };
  const sorted = [...f].sort((a, b) => rank[a.severity] - rank[b.severity]);
  if (sorted.length === 0) return ['live play: nothing to report — every check found the game healthy.'];
  return sorted.flatMap((x) => [
    `[${x.severity}] ${x.id}`,
    `  ${x.says}`,
    `  evidence: ${x.evidence}`,
    `  fix: ${x.fix}`,
  ]);
}
