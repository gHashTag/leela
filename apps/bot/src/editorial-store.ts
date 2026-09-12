/** Editorial authority only. This connection never reads a game or journal table. */
import { randomBytes } from 'node:crypto';
import { openDatabase, type Database } from './sqlite';

// Editorial retention policy, deliberately independent of payment durations.
const EDITORIAL_DAY_MS = 24 * 60 * 60 * 1000;
const CLAIM_TTL_MS = EDITORIAL_DAY_MS;
const GRANT_TTL_MS = 30 * EDITORIAL_DAY_MS;

export function editorialUserId(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9]\d{0,15}$/.test(value) &&
    Number.isSafeInteger(Number(value));
}

interface Claim {
  id: string;
  userId: string;
  username: string;
  issuedAt: number;
  expiresAt: number;
  state: 'pending' | 'approved' | 'revoked';
  approvedBy: string | null;
  approvedAt: number | null;
  grantUntil: number | null;
}

/** Rows are untrusted too. Malformed authority never becomes a role. */
function claimOf(raw: unknown): Claim | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const { id, userId, username, issuedAt, expiresAt, state, approvedBy, approvedAt, grantUntil } = row;
  if (typeof id !== 'string' || !/^[a-f0-9]{32}$/.test(id) || !editorialUserId(userId) ||
    typeof username !== 'string' || !/^[a-z][a-z0-9_]{3,31}$/.test(username) ||
    typeof issuedAt !== 'number' || !Number.isSafeInteger(issuedAt) || issuedAt < 0 ||
    typeof expiresAt !== 'number' || !Number.isSafeInteger(expiresAt) ||
    expiresAt <= issuedAt || expiresAt - issuedAt > CLAIM_TTL_MS ||
    (state !== 'pending' && state !== 'approved' && state !== 'revoked')) return null;
  const identity = { id, userId, username, issuedAt, expiresAt };
  if (approvedBy === null && approvedAt === null && grantUntil === null) {
    if (state === 'approved') return null;
    return {
      ...identity, state: state === 'pending' ? 'pending' : 'revoked',
      approvedBy: null, approvedAt: null, grantUntil: null,
    };
  }
  if (state === 'pending' || !editorialUserId(approvedBy) || approvedBy === userId ||
    typeof approvedAt !== 'number' || !Number.isSafeInteger(approvedAt) ||
    approvedAt < issuedAt || approvedAt >= expiresAt ||
    typeof grantUntil !== 'number' || !Number.isSafeInteger(grantUntil) ||
    grantUntil <= approvedAt || grantUntil - approvedAt > GRANT_TTL_MS) return null;
  // Explicit canonical reconstruction: a database string is never cast into a role.
  return {
    ...identity, state: state === 'approved' ? 'approved' : 'revoked',
    approvedBy, approvedAt, grantUntil,
  };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS editorial_claims (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  username TEXT NOT NULL,
  issuedAt INTEGER NOT NULL,
  expiresAt INTEGER NOT NULL,
  state TEXT NOT NULL,
  approvedBy TEXT,
  approvedAt INTEGER,
  grantUntil INTEGER
);
CREATE INDEX IF NOT EXISTS editorial_claims_subject ON editorial_claims(userId, state);
CREATE TABLE IF NOT EXISTS editorial_requests (
  userId TEXT NOT NULL,
  updateId INTEGER NOT NULL,
  kind TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY(userId, updateId)
);
CREATE INDEX IF NOT EXISTS editorial_requests_window ON editorial_requests(userId, at);
`;

export class EditorialStore {
  constructor(private readonly db: Database) {
    db.exec('PRAGMA busy_timeout = 1000;');
    db.exec(SCHEMA);
  }

  close(): void { this.db.close(); }

  private atomic<T>(run: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = run();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  claim(userId: string, username: string, now: number): Claim {
    if (!editorialUserId(userId) || !/^[a-z][a-z0-9_]{3,31}$/.test(username)) {
      throw new Error('invalid editorial claimant');
    }
    return this.atomic(() => {
      const held = claimOf(this.db.prepare(
        "SELECT * FROM editorial_claims WHERE userId = ? AND username = ? AND state = 'pending' AND expiresAt > ? ORDER BY issuedAt DESC LIMIT 1",
      ).get(userId, username, now));
      if (held && held.issuedAt <= now) return held;
      const claim: Claim = {
        id: randomBytes(16).toString('hex'), userId, username,
        issuedAt: now, expiresAt: now + CLAIM_TTL_MS, state: 'pending',
        approvedBy: null, approvedAt: null, grantUntil: null,
      };
      this.db.prepare(
        "INSERT INTO editorial_claims (id, userId, username, issuedAt, expiresAt, state) VALUES (?, ?, ?, ?, ?, 'pending')",
      ).run(claim.id, userId, username, now, claim.expiresAt);
      return claim;
    });
  }

  pending(target: string, now: number): Claim[] {
    return this.db.prepare(
      "SELECT * FROM editorial_claims WHERE username = ? AND state = 'pending' AND expiresAt > ? ORDER BY issuedAt DESC LIMIT 20",
    ).all(target, now).map(claimOf).filter((c): c is Claim => c !== null && c.issuedAt <= now);
  }

  approve(id: string, owner: string, owners: readonly string[], target: string, now: number): boolean {
    if (!owners.includes(owner)) return false;
    return this.atomic(() => {
      const claim = claimOf(this.db.prepare('SELECT * FROM editorial_claims WHERE id = ?').get(id));
      if (!claim || claim.state !== 'pending' || claim.expiresAt <= now || claim.issuedAt > now ||
        claim.username !== target || owners.includes(claim.userId) || claim.userId === owner) return false;
      this.db.prepare(
        "UPDATE editorial_claims SET state = 'approved', approvedBy = ?, approvedAt = ?, grantUntil = ? WHERE id = ? AND state = 'pending'",
      ).run(owner, now, now + GRANT_TTL_MS, id);
      return true;
    });
  }

  active(userId: string, owners: readonly string[], target: string, now: number): Claim | null {
    const rows = this.db.prepare(
      "SELECT * FROM editorial_claims WHERE userId = ? AND state = 'approved' AND grantUntil > ? ORDER BY approvedAt DESC LIMIT 20",
    ).all(userId, now);
    return rows.map(claimOf).find((c) => c !== null && c.username === target &&
      c.approvedBy !== null && owners.includes(c.approvedBy) &&
      !owners.includes(userId) && c.approvedAt !== null && c.approvedAt <= now &&
      c.grantUntil !== null && c.grantUntil > now) ?? null;
  }

  revoke(userId: string): void {
    // Invalidate pending claims too: a remembered old nonce cannot revive a revoked role.
    this.db.prepare("UPDATE editorial_claims SET state = 'revoked' WHERE userId = ?").run(userId);
  }

  /** Durable dedup + rate caps survive a process restart. A failed call spends its allowance. */
  request(userId: string, updateId: number, kind: string, now: number): 'ok' | 'duplicate' | 'rate' {
    return this.atomic(() => {
      this.db.prepare('DELETE FROM editorial_requests WHERE at < ?').run(now - EDITORIAL_DAY_MS);
      if (this.db.prepare('SELECT 1 FROM editorial_requests WHERE userId = ? AND updateId = ?')
        .get(userId, updateId)) return 'duplicate';
      const rows = this.db.prepare(
        'SELECT kind, at FROM editorial_requests WHERE userId = ? AND at > ? ORDER BY at DESC',
      ).all(userId, now - 3600_000) as Array<{ kind: unknown; at: unknown }>;
      if (rows.some((r) => typeof r.at !== 'number' || typeof r.kind !== 'string' || r.at > now)) {
        return 'rate';
      }
      const recent = rows.filter((r) => typeof r.at === 'number' && r.at > now - 60_000);
      const expensive = rows.filter((r) => ['content_draft', 'agent_sync999', 'agent_999'].includes(String(r.kind)));
      if (recent.length >= 30 || (['content_draft', 'agent_sync999', 'agent_999'].includes(kind) &&
        (expensive.length >= 6 || expensive.some((r) => typeof r.at === 'number' && r.at > now - 10_000)))) {
        return 'rate';
      }
      this.db.prepare('INSERT INTO editorial_requests (userId, updateId, kind, at) VALUES (?, ?, ?, ?)')
        .run(userId, updateId, kind, now);
      return 'ok';
    });
  }
}

/** LEELA_DB is the only production path; no durable storage means no editorial authority. */
export function openEditorialStore({
  path, durable, log = console.error,
}: {
  path?: string; durable: boolean; log?: (text: string) => void;
}): EditorialStore | undefined {
  if (!durable || !path?.trim() || path.includes(':memory:') || path.startsWith('file:')) return undefined;
  let db: Database | undefined;
  try {
    db = openDatabase(path);
    return new EditorialStore(db);
  } catch {
    db?.close();
    log('[editorial] Durable authority storage unavailable; editorial access is disabled.');
    return undefined;
  }
}
