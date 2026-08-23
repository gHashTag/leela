/**
 * Choosing where games live, and surviving the choice going wrong.
 *
 * `index.ts` did this inline: with `LEELA_DB` set it built a SQLite store and
 * with it unset a memory one. There was no third case, and there is one — the
 * database cannot be opened. Pointed at `/data/leela.db` with no volume
 * mounted, the bot died on startup with `SQLITE_CANTOPEN` and was restarted
 * into dying again, while its own README promised it would run and say it was
 * holding games in memory.
 *
 * A store that cannot be opened is not a reason to refuse to play. It is a
 * reason to say so, loudly and once, and to play without it.
 */

import { DatabaseRoomStore } from './persistence';
import {
  SqliteRoomQueries,
  sqliteEntitlements,
  sqliteNudgeStore,
  sqliteReportSink,
  sqliteStepSink,
} from './sqlite';
import {
  MemoryEntitlementStore,
  MemoryNudgeStore,
  MemoryReportSink,
  MemoryRoomStore,
  type EntitlementStore,
  type NudgeStore,
  type ReportSink,
  type RoomStore,
  type StepSink,
} from './store';

/** How long a finished table is kept before it is forgotten. */
export const KEEP_FINISHED_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How often a running bot looks for tables to forget.
 *
 * Once a day. The age filter is a week, so nothing is deleted sooner for being
 * checked more often — and a deployment that is up for months would otherwise
 * never check at all.
 */
export const PRUNE_EVERY_MS = 24 * 60 * 60 * 1000;

export interface Storage {
  store: RoomStore;
  reports: ReportSink;
  steps?: StepSink;
  /**
   * The initiative's per-player memory. Always present, unlike `steps`: the
   * daily word must not knock twice in one morning even when nothing is kept,
   * so the memory fallback is a working store rather than an absence.
   */
  nudges: NudgeStore;
  /**
   * What players have paid for in Telegram Stars. Always present, like
   * `nudges` and for a sharper version of the same reason: a payment that
   * cannot be recorded must not be a payment that is silently taken, so the
   * fallback is a working store rather than an absence — and the startup line
   * says which of the two this deployment has.
   */
  entitlements: EntitlementStore;
  /** Whether games survive a restart. */
  durable: boolean;
  /**
   * The last daily word, and where to keep the next one.
   *
   * Two functions rather than a store, because there is exactly one row and
   * two things anybody does with it. Absent when nothing durable is open: an
   * in-memory deployment forgets its tick at the same moment it forgets its
   * games, and pretending otherwise would put a sentence in the banner that
   * the next restart makes a lie.
   */
  lastTick?: () => { at: number; sent: number; skipped: Record<string, number> } | null;
  rememberTick?: (at: number, sent: number, skipped: Record<string, number>) => void;
  /**
   * Why they do not, when a path was given and could not be used.
   *
   * Absent when no path was asked for: choosing not to keep games is not a
   * failure, and reporting it as one trains people to ignore the line.
   */
  failure?: string;
  /**
   * Stop the periodic cleanup.
   *
   * Absent when there is nothing to stop — games in memory are forgotten by
   * the process ending, which is the only cleanup they need.
   */
  stopPruning?: () => void;
}

export interface StorageOptions {
  /** `LEELA_DB`. Undefined means games are held in memory on purpose. */
  path?: string;
  log?: (message: string) => void;
  /** Injected so a test does not need a real database. */
  openQueries?: (path: string) => SqliteRoomQueries;
  /** Injected so a test does not wait a day. */
  schedule?: (run: () => void, everyMs: number) => () => void;
}

/**
 * Where games live.
 *
 * @returns a working store in every case. The caller is never handed a reason
 *          to exit, because a bot that will not start is worse at keeping a
 *          game than one that forgets it.
 */
export function openStorage({
  path,
  log = console.error,
  openQueries = (at) => new SqliteRoomQueries({ path: at }),
  schedule = (run, everyMs) => {
    const timer = setInterval(run, everyMs);
    // A cleanup is not a reason to keep the process alive.
    timer.unref?.();
    return () => clearInterval(timer);
  },
}: StorageOptions): Storage {
  if (!path) {
    return {
      store: new MemoryRoomStore(),
      reports: new MemoryReportSink(),
      nudges: new MemoryNudgeStore(),
      entitlements: new MemoryEntitlementStore(),
      durable: false,
    };
  }

  try {
    const queries = openQueries(path);

    // Nothing deleted a finished game, so every table ever opened stayed.
    //
    // This ran at startup and nowhere else, under a comment saying that "a bot
    // that is never restarted is not accumulating tables either" — which is
    // false, and was measured: twelve games played and finished over twelve
    // weeks in one process leave twelve tables, because tables come from play
    // and not from restarts. A deployment that is up for months never looked.
    const sweep = () => {
      const forgotten = queries.pruneFinished(KEEP_FINISHED_MS);
      if (forgotten > 0) {
        log(`Forgot ${forgotten} finished table(s) older than a week. Reports kept.`);
      }
    };

    sweep();
    const stopPruning = schedule(sweep, PRUNE_EVERY_MS);

    return {
      store: new DatabaseRoomStore(queries, log),
      reports: sqliteReportSink(queries),
      steps: sqliteStepSink(queries),
      nudges: sqliteNudgeStore(queries),
      entitlements: sqliteEntitlements(queries),
      lastTick: () => queries.lastTick(),
      rememberTick: (at, sent, skipped) => queries.recordTick(at, sent, skipped),
      durable: true,
      stopPruning,
    };
  } catch (error) {
    // The path is in the message because the answer is almost always a mount
    // point that is not there.
    const why = error instanceof Error ? error.message : String(error);
    const failure = `could not open ${path}: ${why}`;
    log(`[bot] ${failure} — games are held in memory and will not survive a restart`);

    return {
      store: new MemoryRoomStore(),
      reports: new MemoryReportSink(),
      nudges: new MemoryNudgeStore(),
      entitlements: new MemoryEntitlementStore(),
      durable: false,
      failure,
    };
  }
}
