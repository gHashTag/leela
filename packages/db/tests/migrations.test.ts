import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { RULESETS } from '@leela/engine';
import { chatHistory, gameSteps, players, reports, sessionPlayers, sessions } from '../src';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function sql(): string {
  return migrationFiles()
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .join('\n');
}

/**
 * Every `ruleset IN (...)` list in the migrations, with the file and the
 * constraint it belongs to so a failure names the line to open.
 *
 * Parsed rather than line-matched: the list is written across two lines in all
 * three places, and a search for the literal four names would have gone quiet
 * the moment somebody reformatted it.
 */
function rulesetChecks(): { where: string; accepts: string[] }[] {
  const found: { where: string; accepts: string[] }[] = [];

  for (const file of migrationFiles()) {
    const text = readFileSync(join(MIGRATIONS, file), 'utf8');

    for (const match of text.matchAll(/ruleset\s+IN\s*\(([^)]*)\)/gi)) {
      // The constraint this list sits inside is the last one named above it.
      const named = [...text.slice(0, match.index ?? 0).matchAll(/ADD CONSTRAINT\s+([a-z_]+)/gi)];
      found.push({
        where: `${file}: ${named.length ? named[named.length - 1][1] : 'an unnamed constraint'}`,
        accepts: [...match[1].matchAll(/'([^']*)'/g)].map((m) => m[1]).sort(),
      });
    }
  }

  return found;
}

/** Column names declared for a table anywhere in the migration files. */
function columnsInSql(all: string, table: string): Set<string> {
  const found = new Set<string>();

  const create = all.match(
    new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i'),
  );
  if (create) {
    for (const line of create[1].split('\n')) {
      const name = line.trim().match(/^([a-z_]+)\s+[a-z]/i);
      // Skip table-level constraints, which start with a keyword.
      if (name && !/^(primary|unique|check|constraint|foreign)$/i.test(name[1])) {
        found.add(name[1]);
      }
    }
  }

  const added = all.matchAll(
    new RegExp(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS\\s+([a-z_]+)`, 'gi'),
  );
  for (const match of added) found.add(match[1]);

  return found;
}

const TABLES = [
  ['players', players],
  ['game_steps', gameSteps],
  ['sessions', sessions],
  ['session_players', sessionPlayers],
  ['reports', reports],
  ['chat_history', chatHistory],
] as const;

describe('migrations match the schema', () => {
  const all = sql();

  it.each(TABLES)('%s declares every column the schema defines', (name, table) => {
    const declared = columnsInSql(all, name);
    const expected = getTableConfig(table).columns.map((c) => c.name);

    for (const column of expected) {
      expect(declared, `${name}.${column} is missing from the migrations`).toContain(column);
    }
  });

  it.each(TABLES)('%s declares no column the schema does not have', (name, table) => {
    const declared = columnsInSql(all, name);
    const expected = new Set(getTableConfig(table).columns.map((c) => c.name));

    for (const column of declared) {
      expect(expected.has(column), `${name}.${column} exists only in the migrations`).toBe(true);
    }
  });
});

describe('migrations are safe to re-run', () => {
  const all = sql();

  it('guards every CREATE TABLE', () => {
    const creates = all.match(/CREATE TABLE(?! IF NOT EXISTS)/gi) ?? [];
    expect(creates).toEqual([]);
  });

  it('guards every CREATE INDEX', () => {
    const creates = all.match(/CREATE (UNIQUE )?INDEX(?! IF NOT EXISTS)/gi) ?? [];
    expect(creates).toEqual([]);
  });

  it('drops a constraint before adding it, so a second run does not fail', () => {
    const added = [...all.matchAll(/ADD CONSTRAINT ([a-z_]+)/gi)].map((m) => m[1]);
    const dropped = [...all.matchAll(/DROP CONSTRAINT IF EXISTS ([a-z_]+)/gi)].map((m) => m[1]);

    for (const constraint of added) {
      expect(dropped, `${constraint} is added without being dropped first`).toContain(constraint);
    }
  });

  it('never drops a table or a column', () => {
    expect(all).not.toMatch(/DROP TABLE/i);
    expect(all).not.toMatch(/DROP COLUMN/i);
  });
});

describe('constraints encode the rules', () => {
  const all = sql();

  it('confines a plan to the board', () => {
    expect(all).toMatch(/plan BETWEEN 1 AND 72/);
  });

  it('confines a roll to the faces of the die', () => {
    expect(all).toMatch(/roll BETWEEN 1 AND 6/);
  });

  /**
   * A CHECK constraint is a list restated in a second language, and this
   * repository's signature defect is a restated list. This one went stale
   * twice without anybody noticing, and the test written to prevent exactly
   * that could not see it happen.
   *
   * WHAT WAS MEASURED, on 2026-08-06. `@leela/engine` declares six rule sets
   * in `RULESETS`. The three CHECK constraints in these migrations
   * (`0000_initial.sql` on `players` and on `sessions`,
   * `0001_adopt_existing_installs.sql` on `players` again) each named four:
   * `onchain` was added to the engine and not here, then `telegram` was added
   * to the engine and not here either. `isRuleSetId('telegram')` is true,
   * `ruleSetById('telegram')` returns a rule set, and `roomToRows` writes
   * `session.rules.id` into the column — so the schema an adoption dump would
   * land in refuses two variants the engine considers shipped.
   *
   * WHY THE OLD GUARD COULD NOT SEE IT. The case here used to be called
   * "accepts exactly the four known rule variants", hard-code those four
   * names, and assert only `toContain`. Containment is blind in both
   * directions that matter: it cannot see a variant the engine has and the
   * SQL lacks (the four it looks for are all present, so it passes), and it
   * cannot see a name in the SQL that the engine no longer declares (it never
   * looks at the other direction at all). Run against the SQL as committed,
   * against SQL with a nonsense variant inserted, and against SQL with
   * `telegram` and `onchain` added, it passed all three. The word "exactly"
   * in its own name was false.
   *
   * So the list is no longer retyped. It is taken from `RULESETS` and
   * compared as a SET, in both directions, for every constraint found; and
   * the count of constraints found is asserted, so renaming the SQL out from
   * under the parser empties the loop into a red test rather than a green
   * one.
   *
   * TWO THINGS MEASURED AND DELIBERATELY NOT CHANGED HERE:
   *
   *   - `apps/bot/src/sqlite.ts` has no CHECK constraint of any kind — zero
   *     matches for `CHECK (` in the whole schema. So SQLite accepts a game
   *     stored under `telegram` that Postgres would refuse, and the bot's own
   *     variant was the one Postgres could not hold. The asymmetry is the
   *     point: the surface that plays `telegram` is the surface with no guard,
   *     and the guard that exists is on the side that never saw the name.
   *   - `game_steps.ruleset` (`0000_initial.sql:59`) is a `text` column with
   *     no CHECK at all, unlike `players.ruleset` and `sessions.ruleset`. The
   *     move log will therefore accept any string. Recorded, not fixed: adding
   *     a constraint to a table that never had one is a schema decision, not
   *     the correction of a stale list.
   */
  it('accepts exactly the rule variants the engine declares, whatever they are', () => {
    const declared = Object.keys(RULESETS).sort();
    const checks = rulesetChecks();

    expect(
      checks.length,
      'no `ruleset IN (...)` list was found in any migration — either the constraint ' +
        'was renamed and this guard is now checking nothing, or it was dropped',
    ).toBeGreaterThan(0);

    // Parsed a second way, so a rename that hides a list from the parser above
    // cannot pass by simply reducing the number of things it has to check.
    const namedConstraints = [...all.matchAll(/ADD CONSTRAINT\s+[a-z_]*ruleset[a-z_]*/gi)];
    expect(
      checks.length,
      `${namedConstraints.length} ruleset constraints are declared but ${checks.length} ` +
        'carry a parsable `IN (...)` list',
    ).toBe(namedConstraints.length);

    for (const check of checks) {
      expect(
        check.accepts,
        `${check.where} accepts ${check.accepts.join(', ')}; the engine declares ${declared.join(', ')}`,
      ).toEqual(declared);
    }
  });

  it('keeps a migrated account mapped to exactly one row', () => {
    expect(all).toMatch(/UNIQUE INDEX IF NOT EXISTS players_legacy_id_key/);
  });

  it('keeps seats unique within a session, in both directions', () => {
    expect(all).toMatch(/session_players_seat_key[\s\S]*?\(session_id, seat\)/);
    expect(all).toMatch(/session_players_user_key[\s\S]*?\(session_id, user_id\)/);
  });
});

describe('adopting an existing install', () => {
  const adopt = readFileSync(join(MIGRATIONS, '0001_adopt_existing_installs.sql'), 'utf8');

  it('defaults existing players to the rules they were already playing', () => {
    expect(adopt).toMatch(/ruleset\s+text NOT NULL DEFAULT 'neuroleela'/);
  });

  it('backfills last_roll_at only for players who have actually moved', () => {
    expect(adopt).toMatch(/previous_plan <> 0/);
  });

  it('adds the board constraint as NOT VALID so a live migration cannot block', () => {
    expect(adopt).toMatch(/plan BETWEEN 1 AND 72\) NOT VALID/);
  });
});
