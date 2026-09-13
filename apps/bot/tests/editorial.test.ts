import { mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { recordingModel } from '@leela/ai';
import { loadLanguage, messageFor, planFor } from '@leela/content';
import { createBot } from '../src/bot';
import { editorialOwners, type EditorialOptions } from '../src/editorial';
import { openEditorialStore, type EditorialStore } from '../src/editorial-store';
import { loadEditorialKit } from '../src/editorial-kit';
import { MemoryEntitlementStore, MemoryReportSink } from '../src/store';
import { openDatabase } from '../src/sqlite';
import { offering } from '../src/stars';
import { blank } from '../../../scripts/lib/source.mjs';

const BOT_INFO = {
  id: 1, is_bot: true as const, first_name: 'Leela', username: 'leela_test_bot',
  can_join_groups: true, can_read_all_group_messages: false,
  supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false,
  has_topics_enabled: false, allows_users_to_create_topics: false,
  can_manage_bots: false, supports_join_request_queries: false,
};
const closed: EditorialStore[] = [];
let nextUpdate = 10_000;
beforeAll(async () => { await loadLanguage('ru'); });
afterEach(() => { for (const store of closed.splice(0)) store.close(); });

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'leela-editorial-'));
  mkdirSync(join(root, 'skills', 'draft'), { recursive: true });
  writeFileSync(join(root, 'SOUL.md'), '# SOUL\nFixture editorial identity; never a therapist.');
  writeFileSync(join(root, 'CONTENT_PLAN.md'), Array.from({ length: 30 }, (_, i) =>
    `## День ${i + 1} — Тема ${i + 1}\nplan: ${i === 29 ? 'none' : i + 1}\nExclusive slot ${i + 1} end.\n`).join('\n'));
  writeFileSync(join(root, 'skills', 'draft', 'SKILL.md'), '# Draft skill\nFixture reusable instruction.');
  return root;
}

function setup(overrides: Partial<EditorialOptions> = {}, root = fixture(), paid = false) {
  const path = join(root, 'editorial.db');
  const store = openEditorialStore({ path, durable: true });
  if (!store) throw new Error('fixture storage failed');
  closed.push(store);
  let time = 1_800_000_000_000;
  const model = recordingModel('Крючок\nТекст\nПрактика\nВопрос\nВизуал\nМягкий CTA');
  const sent: { method: string; payload: Record<string, unknown> }[] = [];
  const logs: string[] = [];
  const reports = new MemoryReportSink();
  const entitlements = new MemoryEntitlementStore();
  const paymentRead = vi.spyOn(entitlements, 'of');
  const history = vi.spyOn(reports, 'history');
  const readFile = vi.fn(async () => 'PLAYER_JOURNAL_CANARY');
  const options: EditorialOptions = {
    store, owners: ['900'], model, kitRoot: root, now: () => time, ...overrides,
  };
  const bot = createBot({
    token: '1:TEST', botInfo: BOT_INFO,
    stars: paid ? offering({ LEELA_STARS_MONTH: '150' }) : null, operators: ['900'],
    editorial: options, reports, entitlements, readFile, log: (text) => logs.push(text),
  });
  bot.api.config.use(async (_prev, method, payload) => {
    sent.push({ method, payload: payload as Record<string, unknown> });
    return { ok: true, result: { message_id: 1 } } as never;
  });
  async function send(text: string, user = 101, username: string | undefined = 'playom',
    type: 'private' | 'group' | 'supergroup' = 'private', updateId = ++nextUpdate, caption = false) {
    const entities = [{ type: 'bot_command' as const, offset: 0, length: text.split(/\s/)[0]!.length }];
    const first = sent.length;
    await bot.handleUpdate({
      update_id: updateId,
      message: {
        message_id: updateId, date: 1, from: { id: user, is_bot: false, first_name: 'Not identity', username },
        chat: type === 'private' ? { id: user, type, first_name: 'User' } : { id: -222, type, title: 'Group' },
        ...(caption ? {
          caption: text, caption_entities: entities,
          document: { file_id: 'secret', file_unique_id: 'secret', file_name: 'journal.json' },
        } : { text, entities }),
      },
    });
    return sent.slice(first).filter((s) => s.method === 'sendMessage')
      .map((s) => String(s.payload.text)).join('\n');
  }
  // Plain words, no bot_command entity: what an administrator types when she
  // talks to the agent rather than commands it.
  async function say(text: string, user = 101, username: string | undefined = 'playom',
    type: 'private' | 'group' | 'supergroup' = 'private', updateId = ++nextUpdate) {
    const first = sent.length;
    await bot.handleUpdate({
      update_id: updateId,
      message: {
        message_id: updateId, date: 1, from: { id: user, is_bot: false, first_name: 'Not identity', username },
        chat: type === 'private' ? { id: user, type, first_name: 'User' } : { id: -222, type, title: 'Group' },
        text,
      },
    });
    return sent.slice(first).filter((s) => s.method === 'sendMessage')
      .map((s) => String(s.payload.text)).join('\n');
  }
  async function approve() {
    const claimReply = await send('/agent_claim');
    const claim = claimReply.match(/\b[a-f0-9]{32}\b/)?.[0];
    expect(claim).toBeTruthy();
    const reply = await send(`/agent_approve ${claim}`, 900, 'owner');
    expect(reply).toContain('одобрен');
    return claim!;
  }
  return { bot, options, store, path, root, model, sent, send, say, approve, history, readFile, logs, paymentRead,
    advance: (ms: number) => { time += ms; } };
}

describe('editorial private trust boundary through the real bot', () => {
  it('only trusts explicit numeric owners, with fallback only when the variable is absent', () => {
    expect(editorialOwners({ LEELA_STARS_OPERATORS: '900,901' })).toEqual(['900', '901']);
    expect(editorialOwners({ LEELA_AGENT_OWNERS: '', LEELA_STARS_OPERATORS: '900' })).toEqual([]);
    expect(editorialOwners({ LEELA_AGENT_OWNERS: '902', LEELA_STARS_OPERATORS: '900' })).toEqual(['902']);
    for (const bad of ['playom', '-1', '1e3', '0123', '0', '1.5', '9007199254740992', '900,bogus']) {
      expect(editorialOwners({ LEELA_AGENT_OWNERS: bad })).toEqual([]);
    }
  });

  it.each(['group', 'supergroup'] as const)('denies every editorial command in %s without touching player/model data', async (type) => {
    const h = setup();
    for (const command of ['/agent', '/agent status', '/agent_claim', '/agent_claims',
      '/agent_approve 123', '/agent_revoke 101', '/content_plan', '/content_draft 1',
      '/agent_999 status', '/agent_sync999']) {
      expect(await h.send(command, 900, 'playom', type)).toContain('личном');
    }
    expect(h.model.calls).toHaveLength(0);
    expect(h.history).not.toHaveBeenCalled();
    expect(h.readFile).not.toHaveBeenCalled();
  });

  it('does not turn a username, display name, claim argument or owner into a grant', async () => {
    const h = setup();
    for (const username of [undefined, 'somebody', 'play0m']) {
      expect(await h.send('/agent_claim @playom 999', 101, username)).not.toMatch(/[a-f0-9]{32}/);
      expect(await h.send('/content_draft 1', 101, username)).toContain('доступ');
    }
    expect(await h.send('/agent_claim 999')).toContain('/agent_claim');
    expect(await h.send('/agent_claim', 900, 'playom')).toContain('владелец');
    expect(await h.send('/content_draft 1', 900, 'owner')).toContain('доступ');
    const pending = await h.send('/agent_claim');
    expect(pending).toMatch(/[a-f0-9]{32}/);
    expect(await h.send('/agent_claim')).toContain(pending.match(/[a-f0-9]{32}/)![0]);
    expect(await h.send('/agent_claims', 102, 'intruder')).toContain('доступ');
    expect(await h.send('/content_draft 1')).toContain('доступ');
    expect(h.model.calls).toHaveLength(0);
  });

  it('requires a separate current owner, then grants only the recorded sender ID', async () => {
    const h = setup();
    const pending = await h.send('/agent_claim', 101, 'PLAYOM');
    const id = pending.match(/[a-f0-9]{32}/)![0];
    expect(await h.send('/agent_claims', 900, 'owner')).toContain(`101`);
    expect(await h.send(`/agent_approve ${id}`, 101)).toContain('доступ');
    expect(await h.send(`/agent_approve ${id}`, 902, 'owner')).toContain('доступ');
    expect(await h.send(`/agent_approve ${id}`, 900, 'owner')).toContain('одобрен');
    expect(await h.send(`/agent_approve ${id}`, 900, 'owner')).not.toContain('одобрен');
    expect(await h.send('/content_draft 1', 102, 'playom')).toContain('доступ');
    expect(await h.send('/agent status', 101, 'renamed')).toContain('администратор контента');
    expect(h.model.calls).toHaveLength(0);
  });

  it('rejects expired pending claims and expired grants, and revoke invalidates old approval', async () => {
    const h = setup();
    const pending = (await h.send('/agent_claim')).match(/[a-f0-9]{32}/)![0];
    h.advance(24 * 3600_000);
    expect(await h.send(`/agent_approve ${pending}`, 900, 'owner')).not.toContain('одобрен');
    const approved = await h.approve();
    h.advance(30 * 24 * 3600_000);
    expect(await h.send('/content_draft 1')).toContain('доступ');
    await h.approve();
    expect(await h.send('/agent_revoke 101', 900, 'owner')).toContain('отозван');
    expect(await h.send(`/agent_approve ${approved}`, 900, 'owner')).not.toContain('одобрен');
    expect(await h.send('/content_draft 1')).toContain('доступ');
  });

  it('survives restart with grants, revocation and request dedup intact', async () => {
    const h = setup();
    await h.approve();
    await h.send('/content_draft 1', 101, 'playom', 'private', 500);
    const restarted = setup({}, h.root);
    expect(await restarted.send('/agent status')).toContain('администратор контента');
    expect(await restarted.send('/content_draft 1', 101, 'playom', 'private', 500)).toContain('повтор');
    expect(restarted.model.calls).toHaveLength(0);
    await restarted.send('/agent_revoke 101', 900, 'owner');
    expect(await h.send('/content_draft 2')).toContain('доступ');
    const changedOwners = setup({ owners: ['901'] }, h.root);
    expect(await changedOwners.send('/content_plan')).toContain('доступ');
  });

  it('fails closed without durable storage or owner configuration but leaves gameplay operational', async () => {
    for (const options of [{ store: undefined }, { owners: [] }]) {
      const h = setup(options);
      expect(await h.send('/agent_claim')).toContain('недоступ');
      expect(await h.send('/content_draft 1')).toContain('недоступ');
      expect(await h.send('/new')).not.toBe('');
      expect(h.model.calls).toHaveLength(0);
    }
    for (const path of [undefined, ':memory:', 'file::memory:', 'file:x?mode=memory']) {
      expect(openEditorialStore({ path, durable: true, log: () => undefined })).toBeUndefined();
    }
    expect(openEditorialStore({ path: '/dev/null/no.sqlite', durable: true, log: () => undefined })).toBeUndefined();
  });

  it('blocks caption commands before the gameplay attachment importer', async () => {
    const h = setup();
    await h.approve();
    expect(await h.send('/content_draft 1', 101, 'playom', 'private', 222, true)).toContain('текст');
    expect(h.model.calls).toHaveLength(0);
    expect(h.readFile).not.toHaveBeenCalled();
    expect(h.history).not.toHaveBeenCalled();
  });

  it('uses configured target only as a claim prerequisite and never as authority', async () => {
    const h = setup({ targetUsername: '@another_name' });
    expect(await h.send('/agent_claim')).toContain('доступ');
    const claimed = await h.send('/agent_claim', 202, 'another_name');
    const nonce = claimed.match(/[a-f0-9]{32}/)![0];
    expect(nonce).toBeTruthy();
    expect(await h.send('/content_draft 1', 202, 'another_name')).toContain('доступ');
    expect(await h.send(`/agent_approve ${nonce}`, 900, 'owner')).toContain('одобрен');
    expect(await h.send('/agent status', 202, 'renamed')).toContain('администратор контента');
    expect(await h.send('/content_plan', 203, 'another_name')).toContain('доступ');
  });

  it('an approved content administrator does not inherit the actual paid refund route', async () => {
    const h = setup({}, fixture(), true);
    await h.approve();
    await h.send('/refund payment-canary');
    expect(h.paymentRead).not.toHaveBeenCalled();
    expect(h.sent.some((s) => s.method === 'refundStarPayment')).toBe(false);
    await h.send('/refund payment-canary', 900, 'owner');
    expect(h.paymentRead).toHaveBeenCalledWith('payment-canary');
    expect(h.model.calls).toHaveLength(0);
  });

  it('rejects caller promotion to owner and owner removal even for a previously valid grant', async () => {
    const h = setup();
    const pending = (await h.send('/agent_claim')).match(/[a-f0-9]{32}/)![0];
    const promoted = setup({ owners: ['900', '101'] }, h.root);
    expect(await promoted.send(`/agent_approve ${pending}`, 900, 'owner')).not.toContain('одобрен');
    await h.send(`/agent_approve ${pending}`, 900, 'owner');
    const noApprover = setup({ owners: ['901'] }, h.root);
    expect(await noApprover.send('/content_draft 1')).toContain('доступ');
    expect(noApprover.model.calls).toHaveLength(0);
    expect(promoted.model.calls).toHaveLength(0);
  });

  it('refuses malformed persisted authority in every trust-bearing field', async () => {
    const h = setup();
    await h.approve();
    const db = openDatabase(h.path);
    try {
      const row = db.prepare("SELECT * FROM editorial_claims WHERE state = 'approved'").get() as Record<string, unknown>;
      const damages: Array<[string, unknown]> = [
        ['id', 'non-random'], ['userId', '1e3'], ['username', 'other_user'],
        ['issuedAt', -1], ['issuedAt', 'not-a-date'], ['expiresAt', Number(row.issuedAt) + 25 * 3600_000],
        ['approvedBy', '101'], ['approvedBy', '901'], ['approvedBy', null],
        ['approvedAt', Number(row.expiresAt)], ['approvedAt', null], ['grantUntil', null],
        ['grantUntil', Number(row.approvedAt) + 31 * 24 * 3600_000],
        ['state', 'pending'], ['state', 'revoked'], ['state', 'administrator'],
      ];
      for (const [field, value] of damages) {
        db.prepare(`UPDATE editorial_claims SET ${field} = ?`).run(value);
        expect(await h.send('/content_draft 1')).toContain('доступ');
        db.prepare(`UPDATE editorial_claims SET ${field} = ?`).run(row[field]);
      }
      expect(h.model.calls).toHaveLength(0);
    } finally { db.close(); }
  });

  it('refuses via-bot, anonymous, missing, bot and mismatched-chat sender shapes', async () => {
    const h = setup();
    const senders = [
      { id: 101, is_bot: false, first_name: 'playom' },
      { id: 101, is_bot: true, first_name: 'playom', username: 'playom' },
      { id: -101, is_bot: false, first_name: 'playom', username: 'playom' },
      undefined,
    ];
    for (const from of senders) {
      // Runtime boundary deliberately receives malformed external update shapes.
      await h.bot.handleUpdate({
        update_id: ++nextUpdate,
        message: {
          message_id: nextUpdate, date: 1, from,
          chat: { id: 101, type: 'private', first_name: 'playom' },
          text: '/agent_claim', entities: [{ type: 'bot_command', offset: 0, length: 12 }],
        },
      } as unknown as Parameters<typeof h.bot.handleUpdate>[0]);
    }
    for (const extra of [
      { sender_chat: { id: -123, type: 'channel' as const, title: 'playom' } },
      { via_bot: { id: 23, is_bot: true, first_name: 'forwarder' } },
      { chat: { id: 102, type: 'private' as const, first_name: 'playom' } },
    ]) {
      await h.bot.handleUpdate({
        update_id: ++nextUpdate,
        message: {
          message_id: nextUpdate, date: 1, from: { id: 101, is_bot: false, first_name: 'User', username: 'playom' },
          chat: { id: 101, type: 'private', first_name: 'User' }, ...extra,
          text: '/agent_claim', entities: [{ type: 'bot_command', offset: 0, length: 12 }],
        },
      });
    }
    expect(h.store.pending('playom', 1_800_000_000_000)).toHaveLength(0);
    expect(h.model.calls).toHaveLength(0);
  });
});

describe('private 999 command integration remains explicitly bounded', () => {
  it('never calls the bridge for unapproved users or group commands and sends only actual approved ID and public kit', async () => {
    const bridge = { status: vi.fn(async () => '999 identity verified'), sync: vi.fn(async () => '999 private drafts imported') };
    const h = setup({ bridge });
    for (const command of ['/agent_999 status', '/agent_sync999']) {
      expect(await h.send(command)).toContain('доступ');
      expect(await h.send(command, 900, 'owner')).toContain('доступ');
      expect(await h.send(command, 101, 'playom', 'group')).toContain('личном');
    }
    expect(bridge.status).not.toHaveBeenCalled();
    expect(bridge.sync).not.toHaveBeenCalled();
    await h.approve();
    expect(await h.send('/agent_999 status')).toContain('verified');
    expect(bridge.status).toHaveBeenCalledWith(101, expect.objectContaining({
      signal: expect.any(AbortSignal), isAuthorized: expect.any(Function),
    }));
    h.advance(10_001);
    expect(await h.send('/agent_sync999', 101, 'playom', 'private', 700)).toContain('imported');
    expect(bridge.sync).toHaveBeenCalledWith(101,
      expect.objectContaining({ skills: expect.any(Array), days: expect.any(Array) }),
      expect.objectContaining({ signal: expect.any(AbortSignal), isAuthorized: expect.any(Function) }));
    expect(JSON.stringify(bridge.sync.mock.calls)).not.toContain('PLAYER_JOURNAL_CANARY');
    expect(await h.send('/agent_sync999', 101, 'playom', 'private', 700)).toContain('повтор');
    expect(bridge.sync).toHaveBeenCalledTimes(1);
    expect(h.model.calls).toHaveLength(0);
    expect(h.history).not.toHaveBeenCalled();
  });

  it('never imports from help/status; names missing bridge and recovers from bridge failure', async () => {
    const h = setup();
    await h.approve();
    expect(await h.send('/agent_999 status')).toContain('недоступна');
    const bridge = {
      status: vi.fn(async () => { throw new Error('PRIVATE_KEY_CANARY'); }),
      sync: vi.fn(async () => 'unused'),
    };
    const error = setup({ bridge });
    await error.approve();
    await error.send('/agent help');
    await error.send('/agent status');
    expect(bridge.status).not.toHaveBeenCalled();
    expect(bridge.sync).not.toHaveBeenCalled();
    expect(await error.send('/agent_999 status')).toContain('не удалось');
    expect(error.logs.join('\n')).not.toContain('PRIVATE_KEY_CANARY');
    expect(await error.send('/new')).not.toBe('');
  });

  it('does not deliver a bridge result after owner revocation', async () => {
    let resolve!: (value: string) => void;
    let operation: { signal: AbortSignal; isAuthorized: () => boolean } | undefined;
    const status = vi.fn((_id: number, context?: typeof operation) => {
      operation = context;
      return new Promise<string>((done) => { resolve = done; });
    });
    const h = setup({ bridge: { status, sync: async () => 'unused' } });
    await h.approve();
    const pending = h.send('/agent_999 status');
    await vi.waitFor(() => expect(status).toHaveBeenCalledOnce());
    expect(operation?.signal.aborted).toBe(false);
    expect(operation?.isAuthorized()).toBe(true);
    await h.send('/agent_revoke 101', 900, 'owner');
    expect(operation?.signal.aborted).toBe(true);
    expect(operation?.isAuthorized()).toBe(false);
    resolve('PRIVATE_REMOTE_CANARY');
    await pending;
    expect(h.sent.some((s) => String(s.payload.text).includes('PRIVATE_REMOTE_CANARY'))).toBe(false);
  });

  it('passes a live authority check that observes expiry and another instance’s revocation', async () => {
    let operation: { signal: AbortSignal; isAuthorized: () => boolean } | undefined;
    let resolve!: (value: string) => void;
    const sync = vi.fn((_id: number, _kit: unknown, context?: typeof operation) => {
      operation = context;
      return new Promise<string>((done) => { resolve = done; });
    });
    for (const mode of ['expiry', 'other-instance'] as const) {
      const h = setup({ bridge: { status: async () => 'unused', sync } });
      await h.approve();
      const pending = h.send('/agent_sync999');
      await vi.waitFor(() => expect(operation?.isAuthorized()).toBe(true));
      if (mode === 'expiry') h.advance(30 * 24 * 3600_000);
      else {
        const other = openEditorialStore({ path: h.path, durable: true })!;
        closed.push(other);
        other.revoke('101');
      }
      expect(operation?.isAuthorized()).toBe(false);
      resolve('UNAUTHORIZED_REMOTE_CANARY');
      await pending;
      expect(h.sent.some((s) => String(s.payload.text).includes('UNAUTHORIZED_REMOTE_CANARY'))).toBe(false);
    }
  });
});

describe('editorial generation is bounded and has only public context', () => {
  it('reads the selected day, actual kit skills and Russian canon, not other slots or journal', async () => {
    const h = setup();
    await h.approve();
    expect(await h.send('/content_plan')).toContain('30');
    expect(await h.send('/content_plan 2')).toContain('Exclusive slot 2 end.');
    const reply = await h.send('/content_draft 2 Пиши спокойно');
    expect(reply).toContain('Черновик');
    const prompt = JSON.stringify(h.model.calls[0].messages);
    for (const text of ['Fixture editorial identity', 'Fixture reusable instruction',
      'Exclusive slot 2 end.', 'Пиши спокойно', planFor('ru', 2).title, planFor('ru', 2).body]) {
      expect(prompt).toContain(JSON.stringify(text).slice(1, -1));
    }
    expect(prompt).not.toContain('Exclusive slot 1 end.');
    expect(prompt).not.toContain('PLAYER_JOURNAL_CANARY');
    expect(h.history).not.toHaveBeenCalled();
    expect(h.model.calls[0].options?.signal).toBeInstanceOf(AbortSignal);
    expect(h.model.calls[0].options?.maxTokens).toBeLessThanOrEqual(8000);
    const payload = h.sent[h.sent.length - 1].payload;
    expect(payload.chat_id).toBe(101);
    expect(payload.parse_mode).toBeUndefined();
  });

  it('does not invent a canonical square for a plan:none day', async () => {
    const h = setup();
    await h.approve();
    await h.send('/content_draft 30');
    const prompt = JSON.stringify(h.model.calls[0].messages);
    expect(prompt).toContain('plan: none');
    expect(prompt).not.toContain(planFor('ru', 30).body.slice(0, 100));
  });

  it('includes the selected and at most two explicit related canonical texts, not other days', async () => {
    const root = fixture();
    const path = join(root, 'CONTENT_PLAN.md');
    writeFileSync(path, readFileSync(path, 'utf8').replace('plan: 2\n', 'plan: 2\nrelated_plans: 6, 8\n'));
    const h = setup({}, root);
    await h.approve();
    await h.send('/content_draft 2');
    const prompt = h.model.calls[0].messages.map((message) => message.content).join('\n');
    for (const plan of [2, 6, 8]) expect(prompt).toContain(planFor('ru', plan).body);
    expect(prompt).not.toContain(planFor('ru', 3).body);
    expect(prompt).not.toContain('Exclusive slot 6 end.');
    expect(loadEditorialKit(root).days[1].relatedPlans).toEqual([6, 8]);
  });

  it('rejects a combined prompt above the context ceiling before spending a model call', async () => {
    const root = fixture();
    writeFileSync(join(root, 'SOUL.md'), 's'.repeat(47_000));
    writeFileSync(join(root, 'skills', 'draft', 'SKILL.md'), 'd'.repeat(23_000));
    mkdirSync(join(root, 'skills', 'extra'));
    writeFileSync(join(root, 'skills', 'extra', 'SKILL.md'), 'e'.repeat(23_000));
    const h = setup({}, root);
    await h.approve();
    expect(await h.send('/content_draft 1')).toContain('не удалось');
    expect(h.model.calls).toHaveLength(0);
  });

  it('rejects invalid day/brief shapes and does not spend model calls', async () => {
    const h = setup();
    await h.approve();
    for (const day of ['', '0', '31', '-1', '1.5', '1e1', '01']) {
      expect(await h.send(`/content_draft ${day}`)).toContain('/content_draft');
    }
    expect(await h.send(`/content_draft 1 ${'x'.repeat(2001)}`)).toContain('2000');
    expect(await h.send('/content_plan 2 garbage')).toContain('/content_plan');
    expect(h.model.calls).toHaveLength(0);
  });

  it('deduplicates Telegram updates and rate-limits a user, independently of other commands', async () => {
    const h = setup();
    await h.approve();
    await h.send('/content_draft 1', 101, 'playom', 'private', 1010);
    expect(await h.send('/content_draft 1', 101, 'playom', 'private', 1010)).toContain('повтор');
    expect(await h.send('/content_draft 2')).toContain('лимит');
    expect(await h.send('/content_plan 2')).toContain('День 2');
    expect(h.model.calls).toHaveLength(1);
  });

  it('bounds calls to six hourly attempts per user and allows recovery after the window', async () => {
    const h = setup();
    await h.approve();
    for (let attempt = 0; attempt < 6; attempt++) {
      h.advance(10_001);
      expect(await h.send('/content_draft 1')).toContain('Черновик');
    }
    h.advance(10_001);
    expect(await h.send('/content_draft 1')).toContain('лимит');
    expect(h.model.calls).toHaveLength(6);
    h.advance(3600_000);
    expect(await h.send('/content_draft 1')).toContain('Черновик');
    expect(h.model.calls).toHaveLength(7);
  });

  it.each([null, { tool_calls: [{ name: 'publish' }] }, '', ' ', 'x'.repeat(4001)])(
    'recovers from malformed output %# without exposing it', async (output) => {
      const h = setup({ model: { id: 'bad', complete: async () => output as string } });
      await h.approve();
      expect(await h.send('/content_draft 1')).toContain('не удалось');
      expect(await h.send('/new')).not.toBe('');
    });

  it('names missing model/kit without breaking game commands or reading player data', async () => {
    for (const overrides of [{ model: undefined }, { kitRoot: '/not/a/kit' }]) {
      const h = setup(overrides);
      await h.approve();
      expect(await h.send('/content_draft 1')).toContain('недоступ');
      expect(await h.send('/new')).not.toBe('');
    }
  });

  it('times out even a model ignoring cancellation and recovers without logging provider secrets', async () => {
    let signal: AbortSignal | undefined;
    const h = setup({ timeoutMs: 5, model: {
      id: 'hung',
      complete: (_messages, options) => { signal = options?.signal; return new Promise(() => undefined); },
    } });
    await h.approve();
    expect(await h.send('/content_draft 1')).toContain('время');
    expect(signal?.aborted).toBe(true);
    expect(await h.send('/new')).not.toBe('');
    const error = setup({ model: { id: 'broken', complete: async () => { throw new Error('SECRET_PROVIDER_KEY'); } } });
    await error.approve();
    expect(await error.send('/content_draft 1')).toContain('не удалось');
    expect(error.logs.join('\n')).not.toContain('SECRET_PROVIDER_KEY');
  });

  it('rechecks revoked authority after a model finishes and does not leak its draft', async () => {
    let resolve!: (value: string) => void;
    const complete = vi.fn(() => new Promise<string>((done) => { resolve = done; }));
    const h = setup({ model: { id: 'slow', complete } });
    await h.approve();
    const pending = h.send('/content_draft 1');
    await vi.waitFor(() => expect(complete).toHaveBeenCalledOnce());
    expect(await h.send('/content_draft 2')).toMatch(/лимит|готовится/);
    await h.send('/agent_revoke 101', 900, 'owner');
    resolve('PRIVATE_DRAFT_CANARY');
    await pending;
    expect(h.sent.some((s) => String(s.payload.text).includes('PRIVATE_DRAFT_CANARY'))).toBe(false);
  });
});

describe('the administrator talks to the agent in free text, and nobody else does', () => {
  const gameAnswer = messageFor('en', 'chat.noTableHelp');

  it('answers an approved administrator from the kit and keeps a short private memory of the talk', async () => {
    const h = setup();
    await h.approve();
    expect(await h.send('/agent help')).toContain('обычным текстом');
    const reply = await h.say('Какой день плана лучше открыть первым?');
    expect(reply).toBe('Крючок\nТекст\nПрактика\nВопрос\nВизуал\nМягкий CTA');
    expect(h.model.calls).toHaveLength(1);
    const first = h.model.calls[0];
    const prompt = first.messages.map((message) => message.content).join('\n');
    for (const text of ['Fixture editorial identity', 'Fixture reusable instruction', 'День 1 — Тема 1', 'День 30 — Тема 30',
      'Какой день плана лучше открыть первым?', 'не публикация', '/content_draft']) {
      expect(prompt).toContain(text);
    }
    // Titles, not slots: a whole day is what /content_draft is for.
    expect(prompt).not.toContain('Exclusive slot 1 end.');
    expect(prompt).not.toContain('PLAYER_JOURNAL_CANARY');
    expect(first.messages[0].role).toBe('system');
    expect(first.messages[first.messages.length - 1]).toEqual({ role: 'user', content: 'Какой день плана лучше открыть первым?' });
    expect(first.options?.signal).toBeInstanceOf(AbortSignal);
    expect(first.options?.maxTokens).toBeLessThanOrEqual(8000);
    const payload = h.sent[h.sent.length - 1].payload;
    expect(payload.chat_id).toBe(101);
    expect(payload.parse_mode).toBeUndefined();
    expect(h.history).not.toHaveBeenCalled();
    expect(h.readFile).not.toHaveBeenCalled();

    // The next question carries the previous exchange; the memory is capped at
    // twelve exchanges and the oldest falls off first.
    await h.say('А второй?');
    const second = h.model.calls[1].messages;
    expect(second.slice(1)).toEqual([
      { role: 'user', content: 'Какой день плана лучше открыть первым?' },
      { role: 'assistant', content: 'Крючок\nТекст\nПрактика\nВопрос\nВизуал\nМягкий CTA' },
      { role: 'user', content: 'А второй?' },
    ]);
    for (let turn = 3; turn <= 15; turn++) {
      h.advance(2_500);
      await h.say(`Вопрос ${turn}`);
    }
    const last = h.model.calls[h.model.calls.length - 1].messages;
    expect(last).toHaveLength(1 + 2 * 12 + 1);
    expect(last[1]).toEqual({ role: 'user', content: 'Вопрос 3' });
    expect(last[last.length - 1]).toEqual({ role: 'user', content: 'Вопрос 15' });
  });

  it('leaves every other text to the game: strangers, owners, groups, commands', async () => {
    const h = setup();
    expect(await h.say('Привет, агент')).toBe(gameAnswer);
    expect(await h.say('Привет, агент', 900, 'owner')).toBe(gameAnswer);
    await h.approve();
    expect(await h.say('Привет, агент', 102, 'playom')).toBe(gameAnswer);
    expect(await h.say('Привет, агент', 101, 'playom', 'group')).toBe(gameAnswer);
    expect(await h.say('Привет, агент', 101, 'playom', 'supergroup')).toBe(gameAnswer);
    expect(await h.say('/unknown_command')).toBe(messageFor('en', 'chat.unknown'));
    expect(await h.send('/new')).not.toBe('');
    expect(h.model.calls).toHaveLength(0);
    expect(h.history).not.toHaveBeenCalled();
  });

  it('steps aside for an administrator who holds a table, through the injected hook and the real store', async () => {
    const hook = setup({ seated: async () => true });
    await hook.approve();
    expect(await hook.say('Привет, агент')).toBe(gameAnswer);
    expect(hook.model.calls).toHaveLength(0);

    const failing = setup({ seated: async () => { throw new Error('TABLE_STORE_CANARY'); } });
    await failing.approve();
    expect(await failing.say('Привет, агент')).toBe(gameAnswer);
    expect(failing.model.calls).toHaveLength(0);
    expect(failing.logs.join('\n')).not.toContain('TABLE_STORE_CANARY');

    const real = setup();
    await real.approve();
    expect(await real.say('До стола')).not.toBe(gameAnswer);
    expect(real.model.calls).toHaveLength(1);
    expect(await real.send('/new')).not.toBe('');
    const atTable = await real.say('Слова за столом');
    expect(atTable).not.toBe('Крючок\nТекст\nПрактика\nВопрос\nВизуал\nМягкий CTA');
    expect(real.model.calls).toHaveLength(1);
    expect(await real.send('/end')).not.toBe('');
    expect(await real.say('После стола')).toBe('Крючок\nТекст\nПрактика\nВопрос\nВизуал\nМягкий CTA');
    expect(real.model.calls).toHaveLength(2);
  });

  it('deduplicates, rate-limits in the cheap class and never blocks a draft', async () => {
    const h = setup();
    await h.approve();
    // The claim itself spent one request; let its minute pass so the count below is the talk's own.
    h.advance(60_001);
    await h.say('Первый', 101, 'playom', 'private', 3010);
    expect(await h.say('Первый', 101, 'playom', 'private', 3010)).toContain('повтор');
    expect(await h.send('/content_draft 1')).toContain('Черновик');
    expect(await h.say('Сразу после черновика')).not.toContain('лимит');
    expect(h.model.calls).toHaveLength(3);
    for (let count = h.model.calls.length; count < 30; count++) {
      h.advance(1_000);
      expect(await h.say(`Вопрос ${count}`)).not.toContain('лимит');
    }
    expect(h.model.calls).toHaveLength(30);
    h.advance(1_000);
    expect(await h.say('Тридцать первый')).toContain('лимит');
    expect(h.model.calls).toHaveLength(30);
    expect(await h.send('/agent status')).toContain('администратор контента');
    h.advance(60_001);
    expect(await h.say('Через минуту')).not.toContain('лимит');
    expect(h.model.calls).toHaveLength(31);
    expect(await h.say('x'.repeat(2001))).toContain('2000');
    expect(h.model.calls).toHaveLength(31);
  });

  it.each([null, { tool_calls: [{ name: 'publish' }] }, '', ' ', 'x'.repeat(3501), 'bad\u0007bell'])(
    'recovers from malformed chat output %# without exposing it or remembering it', async (output) => {
      let calls = 0;
      const h = setup({ model: { id: 'bad', complete: async () => { calls++; return output as string; } } });
      await h.approve();
      expect(await h.say('Вопрос')).toContain('не удалось');
      expect(h.sent.some((s) => String(s.payload.text).includes('bell'))).toBe(false);
      expect(await h.send('/new')).not.toBe('');
      expect(calls).toBe(1);
    });

  it('names a missing model or kit, times out, and never logs the provider', async () => {
    const noModel = setup({ model: undefined });
    await noModel.approve();
    expect(await noModel.say('Вопрос')).toContain('недоступ');
    const noKit = setup({ kitRoot: '/not/a/kit' });
    await noKit.approve();
    expect(await noKit.say('Вопрос')).toContain('недоступ');
    expect(noKit.model.calls).toHaveLength(0);
    let signal: AbortSignal | undefined;
    const hung = setup({ timeoutMs: 5, model: {
      id: 'hung',
      complete: (_messages, options) => { signal = options?.signal; return new Promise(() => undefined); },
    } });
    await hung.approve();
    expect(await hung.say('Вопрос')).toContain('время');
    expect(signal?.aborted).toBe(true);
    const broken = setup({ model: { id: 'broken', complete: async () => { throw new Error('SECRET_PROVIDER_KEY'); } } });
    await broken.approve();
    expect(await broken.say('Вопрос')).toContain('не удалось');
    expect(broken.logs.join('\n')).not.toContain('SECRET_PROVIDER_KEY');
    expect(await broken.send('/new')).not.toBe('');
  });

  it('revocation cancels an answer in flight, forgets the talk, and a new grant starts clean', async () => {
    let resolve!: (value: string) => void;
    const complete = vi.fn(() => new Promise<string>((done) => { resolve = done; }));
    const h = setup({ model: { id: 'slow', complete } });
    await h.approve();
    const pending = h.say('Первый вопрос');
    await vi.waitFor(() => expect(complete).toHaveBeenCalledOnce());
    expect(await h.say('Второй, пока первый готовится')).toContain('готовится');
    await h.send('/agent_revoke 101', 900, 'owner');
    resolve('PRIVATE_CHAT_CANARY');
    expect(await pending).toContain('отозван');
    expect(h.sent.some((s) => String(s.payload.text).includes('PRIVATE_CHAT_CANARY'))).toBe(false);
    expect(await h.say('После отзыва')).toBe(gameAnswer);
    expect(complete).toHaveBeenCalledTimes(1);

    // A finished exchange is remembered; the owner's revoke erases it.
    const remembered = setup();
    await remembered.approve();
    await remembered.say('Запомни это');
    await remembered.send('/agent_revoke 101', 900, 'owner');
    await remembered.approve();
    await remembered.say('Что я просила запомнить?');
    expect(remembered.model.calls).toHaveLength(2);
    expect(remembered.model.calls[1].messages).toHaveLength(2);
    expect(JSON.stringify(remembered.model.calls[1].messages)).not.toContain('Запомни это');
  });
});

describe('kit loader validates the whole plan shape rather than one happy day', () => {
  it('loads 30 unique ordered days and every packaged skill', () => {
    const kit = loadEditorialKit(fixture());
    expect(kit.days.map((d) => d.day)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(kit.days[29].plan).toBeNull();
    expect(kit.skills.map((skill) => skill.content).join('\n')).toContain('Fixture reusable instruction');
  });

  it.each([
    (text: string) => text.replace('## День 30', '## День 29'),
    (text: string) => text.replace('plan: 2', 'plan: 73'),
    (text: string) => text.replace('plan: 2', 'plan: 1.5'),
    (text: string) => text.replace('plan: 2', ''),
    (text: string) => text.replace('plan: 2', 'plan: 2\nplan: 3'),
    (text: string) => text.replace('## День 30', '## Day 30'),
  ])('refuses malformed or incomplete editorial plan %#', (damage) => {
    const root = fixture();
    const text = Array.from({ length: 30 }, (_, i) => `## День ${i + 1}\nplan: ${i + 1}\nTopic\n`).join('\n');
    writeFileSync(join(root, 'CONTENT_PLAN.md'), damage(text));
    expect(() => loadEditorialKit(root)).toThrow();
  });

  it.each([
    '', 'none', '0', '-1', '73', '1.5', '01', '1e1',
    '6, 6', '2', '6, 8, 12', '6,', '6 8', '6\nrelated_plans: 8',
  ])('refuses invalid, duplicate or excessive related plan references: %s', (related) => {
    const root = fixture();
    const path = join(root, 'CONTENT_PLAN.md');
    writeFileSync(path, readFileSync(path, 'utf8').replace('plan: 2\n', `plan: 2\nrelated_plans: ${related}\n`));
    expect(() => loadEditorialKit(root)).toThrow();
  });

  it('does not attach canonical dependencies to a plan:none day', () => {
    const root = fixture();
    const path = join(root, 'CONTENT_PLAN.md');
    writeFileSync(path, readFileSync(path, 'utf8').replace('plan: none\n', 'plan: none\nrelated_plans: 6\n'));
    expect(() => loadEditorialKit(root)).toThrow();
  });

  it('refuses empty, oversized and out-of-root assets', () => {
    for (const content of ['', 'x'.repeat(48_001), 'invalid\0content']) {
      const root = fixture();
      writeFileSync(join(root, 'SOUL.md'), content);
      expect(() => loadEditorialKit(root)).toThrow();
    }
    const root = fixture();
    const outside = fixture();
    symlinkSync(join(outside, 'SOUL.md'), join(root, 'skills', 'draft', 'leak'));
    // Make a second skill whose content points at a sibling's private file.
    mkdirSync(join(root, 'skills', 'external'));
    symlinkSync(join(outside, 'SOUL.md'), join(root, 'skills', 'external', 'SKILL.md'));
    expect(() => loadEditorialKit(root)).toThrow();
  });

  it('keeps package-relative runtime assets in the Docker bot COPY boundary', () => {
    const docker = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
    expect(docker).toMatch(/^COPY apps\/bot apps\/bot$/m);
    const index = blank(readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8'));
    expect(index).toContain('store: openEditorialStore({ path: databasePath, durable: storage.durable })');
    expect(index).toContain('owners: editorialOwners(process.env)');
    expect(index).toContain('bridge: editorial999FromEnvironment(process.env)');
    expect(index).toMatch(/editorial:\s*\{[\s\S]*?\bmodel,/);
  });

  it('loads the actual packaged soul, complete unscheduled plan and three skills', () => {
    const kit = loadEditorialKit();
    expect(kit.days.map((day) => day.day)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(kit.skills).toHaveLength(3);
    expect(kit.skills.map((skill) => skill.name).sort()).toEqual([
      'leela-999-sync', 'leela-canon-review', 'leela-content-drafting',
    ]);
    expect(kit.soul).toContain('classic');
    expect(kit.soul).toContain('planFor');
    for (const day of kit.days) {
      expect(day.title).toContain(`День ${day.day}`);
      expect(day.content).toMatch(/^plan:\s*(none|[1-9]\d*)\s*$/m);
      if (day.plan !== null) expect(planFor('ru', day.plan).title).not.toBe('');
    }
    const game = blank(readFileSync(new URL('../src/commands.ts', import.meta.url), 'utf8'));
    expect(game).toContain("options.ruleset ?? 'classic'");
  });

  it('feeds actual packaged kit text into the configured model, not merely a fixture kit', async () => {
    const kit = loadEditorialKit();
    const h = setup({ kitRoot: undefined });
    await h.approve();
    expect(await h.send('/content_draft 1')).toContain('Черновик');
    const prompt = h.model.calls[0].messages.map((message) => message.content).join('\n');
    expect(prompt).toContain(kit.soul);
    for (const skill of kit.skills) expect(prompt).toContain(skill.content);
    expect(prompt).toContain(kit.days[0].content);
    expect(prompt).not.toContain(kit.days[29].content);
    expect(h.history).not.toHaveBeenCalled();
  });

  it('fulfils every actual day’s text dependencies, including five ready texts and comparison canon', async () => {
    const kit = loadEditorialKit();
    expect(kit.days[8].relatedPlans).toEqual([6]);
    expect(kit.days[9].relatedPlans).toEqual([8]);
    const h = setup({ kitRoot: undefined });
    await h.approve();
    for (const day of kit.days) {
      h.advance(3600_001);
      expect(await h.send(`/content_draft ${day.day}`)).toContain('Черновик');
      const prompt = h.model.calls[day.day - 1].messages.map((message) => message.content).join('\n');
      expect(prompt).toContain(day.content);
      const references = day.plan === null ? [] : [day.plan, ...day.relatedPlans];
      const requested = [...day.content.matchAll(/planFor\(\s*['"]ru['"]\s*,\s*(\d+)\s*\)/g)]
        .map((match) => Number(match[1]));
      for (const reference of requested) {
        expect(references, `Day ${day.day} must declare each canonical text its brief requires`).toContain(reference);
      }
      for (const reference of references) expect(prompt).toContain(planFor('ru', reference).body);
      expect(prompt.length).toBeLessThan(85_000);
      expect(prompt).not.toContain('PLAYER_JOURNAL_CANARY');
    }
    for (const [day, letter] of [[1, 'A'], [2, 'B'], [3, 'C'], [5, 'D'], [12, 'E']] as const) {
      const content = kit.days[day - 1].content;
      const ready = new RegExp(`^### (?:Готовый текст )?${letter} ·[^\\n]*\\n([\\s\\S]+)$`, 'm').exec(content)?.[1]?.trim();
      expect(ready, `Day ${day} must carry ready text ${letter}, not an unresolved instruction to retrieve it`).toBeTruthy();
      expect(ready!.length).toBeGreaterThan(800);
      const prompt = h.model.calls[day - 1].messages.map((message) => message.content).join('\n');
      expect(prompt).toContain(ready!);
    }
    expect(h.history).not.toHaveBeenCalled();
  });
});
