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
import { SqliteRoomQueries, sqliteReportSink, sqliteStepSink } from './sqlite';
import {
  MemoryReportSink,
  MemoryRoomStore,
  type ReportSink,
  type RoomStore,
  type StepSink,
} from './store';

/** How long a finished table is kept before it is forgotten. */
export const KEEP_FINISHED_MS = 7 * 24 * 60 * 60 * 1000;

export interface Storage {
  store: RoomStore;
  reports: ReportSink;
  steps?: StepSink;
  /** Whether games survive a restart. */
  durable: boolean;
  /**
   * Why they do not, when a path was given and could not be used.
   *
   * Absent when no path was asked for: choosing not to keep games is not a
   * failure, and reporting it as one trains people to ignore the line.
   */
  failure?: string;
}

export interface StorageOptions {
  /** `LEELA_DB`. Undefined means games are held in memory on purpose. */
  path?: string;
  log?: (message: string) => void;
  /** Injected so a test does not need a real database. */
  openQueries?: (path: string) => SqliteRoomQueries;
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
}: StorageOptions): Storage {
  if (!path) {
    return { store: new MemoryRoomStore(), reports: new MemoryReportSink(), durable: false };
  }

  try {
    const queries = openQueries(path);

    // Nothing deleted a finished game, so every table ever opened stayed. Done
    // at startup rather than on a timer: a bot that is never restarted is not
    // accumulating tables either.
    const forgotten = queries.pruneFinished(KEEP_FINISHED_MS);
    if (forgotten > 0) {
      log(`Forgot ${forgotten} finished table(s) older than a week. Reports kept.`);
    }

    return {
      store: new DatabaseRoomStore(queries, log),
      reports: sqliteReportSink(queries),
      steps: sqliteStepSink(queries),
      durable: true,
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
      durable: false,
      failure,
    };
  }
}
