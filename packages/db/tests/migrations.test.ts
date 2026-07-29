import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { chatHistory, gameSteps, players, reports, sessionPlayers, sessions } from '../src';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

function sql(): string {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .join('\n');
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

  it('accepts exactly the four known rule variants', () => {
    const checks = [...all.matchAll(/ruleset IN \(([^)]+)\)/g)].map((m) => m[1]);
    expect(checks.length).toBeGreaterThan(0);
    for (const check of checks) {
      for (const variant of ['classic', 'neuroleela', 'legacy-mobile', 'online']) {
        expect(check, `variant ${variant} is not accepted`).toContain(`'${variant}'`);
      }
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
