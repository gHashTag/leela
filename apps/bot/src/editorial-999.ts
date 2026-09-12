/**
 * Spec 029: a server-to-server draft importer, NOT an agent/tool loop.
 *
 * The caller has already authorized the actual private Telegram sender. This
 * boundary independently binds that numeric sender to the scoped 999 key.
 * Never pass a chat-provided key, URL, tool name, or SOUL to this module.
 *
 * Remote contract: agent/{routes,tools,plan-tools}.ts in 999. Skills are private
 * by DEFAULT; plan_item_add has no status argument and defaults to idea. The
 * scoped server must preserve those invariants and advertise draft-only-v1.
 *
 * Reconciliation is NOT exactly-once delivery. The current remote card table
 * has no unique (goal_id, title) constraint or idempotency key. Before listing,
 * acquire/fsync an exclusive .leela-999-<key fingerprint>.pending sentinel in
 * the existing LEELA_DB directory. This is NOT a game DB or identity lookup.
 * Missing/unwritable durable storage disables writes, not status.
 *
 * A failed write is never automatically retried. In-process reconciliation can
 * clear uncertainty only after the exact record is visible. After a restart,
 * the retained sentinel blocks new writes: an operator must STOP ALL importers,
 * reconcile remote drafts, then remove that sentinel on the durable volume.
 * A second process sharing this volume also fails closed. Separate volumes/
 * replicas still need remote uniqueness; deploy a single importer. No secrets,
 * personal content or raw errors enter the sentinel. No production calls in tests.
 */
import { createHash } from 'node:crypto';
import { closeSync, fsyncSync, openSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';

export interface Editorial999Kit {
  readonly skills: readonly { readonly name: string; readonly content: string }[];
  readonly days: readonly { readonly day: number; readonly title: string; readonly content: string }[];
}

export interface Editorial999 {
  status(userId: number, context?: OperationContext): Promise<string>;
  sync(userId: number, kit: Editorial999Kit, context?: OperationContext): Promise<string>;
}

type OperationContext = { readonly signal?: AbortSignal; readonly isAuthorized?: () => boolean };
const ENDPOINT = 'https://vibee-render-production.up.railway.app/mcp';
const SCOPE = 'draft-only-v1';
const GOAL = 'Leela: 30-day editorial drafts v1';
const MAX_BODY = 512 * 1024;
const REQUEST_MS = 8_000;
const OPERATION_MS = 45_000;
const TOOLS = ['whoami', 'skills_list', 'skills_create', 'plan_list', 'plan_goal_create', 'plan_item_add'] as const;
type Tool = (typeof TOOLS)[number];
type ObjectValue = Record<string, unknown>;
type Entry = { name: string; content: string; evidence: string };
type Prepared = { skills: Entry[]; days: Entry[]; goal: Entry };
type State = { busy: boolean; uncertain: string | undefined; journal: string | undefined };

// Key fingerprints only, never raw credentials or remote personal content.
const states = new Map<string, State>();
const messages = {
  identity: '999 недоступен: ключ не привязан к вашему подтверждённому Telegram ID. Нужен отдельный ключ для этого администратора.',
  scope: '999 недоступен: сервер не подтвердил ограниченный draft-only-v1. Владелец должен настроить отдельный LEELA_EDITORIAL_AGENT_KEYS; полный ключ не подходит.',
  invalid: '999 недоступен: ответ не соответствует безопасному контракту. Проверьте совместимость сервера.',
  transport: '999 недоступен: безопасный запрос не завершён. Проверьте доступность сервера и серверную конфигурацию.',
  timeout: '999 недоступен: истёк срок безопасного запроса.',
  kit: '999: комплект не прошёл проверку. Нужны 3 навыка и 30 уникальных дней 1–30 в пределах размера 999.',
  conflict: '999: конфликт имён или содержимого Leela. Проверьте целевые навыки и план в 999 вручную; мост ничего не перезаписывает.',
  rejected: '999 отклонил создание записи. Проверьте целевой план, совпадения имён и лимиты в 999; подтверждённые записи сохраняются.',
  uncertain: '999: результат предыдущей записи неизвестен. Автоповтор заблокирован, чтобы не создать дубликат. Проверьте 999 вручную; повторная сверка продолжит работу только если запись уже видна с точным содержимым. Не перезапускайте импортёр до проверки.',
  journal: '999: создание записей заблокировано защитой от дубликатов. Нужен доступный постоянный том LEELA_DB без оставшейся блокировки импорта. После сбоя владелец должен остановить импортёры, сверить 999 и только затем снять серверную блокировку.',
  revoked: '999: запрос остановлен — доступ редактора отозван, истёк или запрос отменён. Новые записи не отправляются.',
  busy: '999: синхронизация уже выполняется. Дождитесь её результата.',
} as const;

class BridgeFailure extends Error {
  constructor(readonly kind: keyof typeof messages) { super(kind); }
}

function fail(kind: keyof typeof messages): never { throw new BridgeFailure(kind); }
function object(value: unknown): value is ObjectValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function positiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function claimJournal(path: string | undefined, state: State): void {
  if (!path || (state.journal !== undefined && state.journal !== path)) fail('journal');
  if (state.journal === path) return; // Same-process recovery, already exclusive.
  let file: number | undefined;
  let directory: number | undefined;
  try {
    directory = openSync(dirname(path), 'r');
    // wx refuses both existing locks and symlinks. No timestamp/lease expiry
    // may turn an unknown remote write into permission to retry it.
    file = openSync(path, 'wx', 0o600);
    writeFileSync(file, 'Leela draft import incomplete. Stop all importers and reconcile 999 before removing this sentinel.\n');
    fsyncSync(file);
    fsyncSync(directory);
    state.journal = path;
  } catch {
    fail('journal');
  } finally {
    if (file !== undefined) closeSync(file);
    if (directory !== undefined) closeSync(directory);
  }
}
function releaseJournal(state: State): void {
  if (state.journal === undefined) return;
  let directory: number | undefined;
  try {
    directory = openSync(dirname(state.journal), 'r');
    unlinkSync(state.journal);
    state.journal = undefined;
    fsyncSync(directory);
  } catch {
    fail('journal');
  } finally {
    if (directory !== undefined) closeSync(directory);
  }
}
function evidence(kind: string, name: string, content: string): string {
  return digest(JSON.stringify([kind, name, content]));
}
function entry(kind: string, name: string, content: string): Entry {
  const marked = `<!-- leela.editorial:${SCOPE}:${kind}:${digest(JSON.stringify([name, content]))} -->\n${content}`;
  return { name, content: marked, evidence: evidence(kind, name, marked) };
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0')) fail('kit');
  return value.trim();
}
function prepare(kit: Editorial999Kit): Prepared {
  if (!object(kit) || !Array.isArray(kit.skills) || kit.skills.length !== 3
    || !Array.isArray(kit.days) || kit.days.length !== 30) fail('kit');
  const skills = kit.skills.map((skill: unknown) => {
    if (!object(skill)) fail('kit');
    const name = `Leela: ${text(skill.name, 93)}`;
    const prepared = entry('skill', name, text(skill.content, 8192));
    if (prepared.content.length > 8192 || /[\r\n]/u.test(name)) fail('kit');
    return prepared;
  });
  const days = kit.days.map((day: unknown) => {
    if (!object(day) || !positiveId(day.day) || day.day > 30) fail('kit');
    const name = `Leela: Day ${String(day.day).padStart(2, '0')} — ${text(day.title, 180)}`;
    const prepared = entry('day', name, text(day.content, 4096));
    if (name.length > 200 || prepared.content.length > 4096 || /[\r\n]/u.test(name)) fail('kit');
    return { day: day.day, entry: prepared };
  }).sort((a, b) => a.day - b.day);
  if (new Set(skills.map((skill) => skill.name)).size !== 3
    || days.some((day, index) => day.day !== index + 1)) fail('kit');
  const dayEntries = days.map((day) => day.entry);
  const prepared = {
    skills,
    days: dayEntries,
    goal: entry('plan', GOAL, `Unscheduled private Leela editorial drafts. No automatic publication.\nKit: ${digest(JSON.stringify(dayEntries))}`),
  };
  // 999 duplicates structured values in its JSON-text content block. Reserve
  // room for that escaping and row metadata so our own kit stays readable
  // under the response cap on a later reconciliation.
  if (Buffer.byteLength(JSON.stringify(prepared), 'utf8') > MAX_BODY / 4) fail('kit');
  return prepared;
}

function requireTime(deadline: number, signal?: AbortSignal): void {
  if (signal?.aborted || Date.now() >= deadline) fail('timeout');
}
function requireAuthority(context?: OperationContext): void {
  try {
    if (context?.signal?.aborted || (context?.isAuthorized && context.isAuthorized() !== true)) fail('revoked');
  } catch { fail('revoked'); }
}

/** Streaming byte cap and one deadline include download, decoding AND JSON. */
async function boundedJson(response: Response, deadline: number, signal: AbortSignal): Promise<unknown> {
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/u.test(length) || Number(length) > MAX_BODY)) fail('invalid');
  if (!/^application\/json(?:\s*;|$)/iu.test(response.headers.get('content-type') ?? '') || !response.body) fail('invalid');
  const reader = response.body.getReader();
  const cancel = (): void => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let bytes = 0;
    let body = '';
    for (;;) {
      requireTime(deadline, signal);
      const chunk = await reader.read();
      requireTime(deadline, signal);
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BODY) fail('invalid');
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    requireTime(deadline, signal);
    const parsed: unknown = JSON.parse(body);
    requireTime(deadline, signal);
    return parsed;
  } finally {
    signal.removeEventListener('abort', cancel);
    cancel();
  }
}

function application(result: ObjectValue): ObjectValue {
  if (result.isError !== undefined && result.isError !== false) fail('invalid');
  // 999 sends both text and structuredContent. Do not interpret its prose,
  // instructions, image blocks, links, or fallback "agent" suggestions.
  const value = result.structuredContent;
  if (!object(value) || 'error' in value || 'ошибка' in value || value.isError === true) fail('invalid');
  return value;
}

function validateTools(result: ObjectValue): void {
  if (!Array.isArray(result.tools) || result.tools.length !== TOOLS.length || 'nextCursor' in result) fail('scope');
  const names = new Set<string>();
  const properties: Record<Tool, Record<string, string>> = {
    whoami: {}, skills_list: {}, plan_list: {},
    skills_create: { name: 'string', content: 'string' },
    plan_goal_create: { title: 'string', intent: 'string' },
    plan_item_add: { goal_id: 'integer', title: 'string', note: 'string' },
  };
  const required: Record<Tool, string[]> = {
    whoami: [], skills_list: [], plan_list: [],
    skills_create: ['name', 'content'], plan_goal_create: ['title'], plan_item_add: ['goal_id', 'title'],
  };
  for (const descriptor of result.tools) {
    if (!object(descriptor) || typeof descriptor.name !== 'string' || !TOOLS.some((name) => name === descriptor.name)
      || names.has(descriptor.name)) fail('scope');
    names.add(descriptor.name);
    const name = descriptor.name as Tool;
    const schema = descriptor.inputSchema;
    if (!object(schema) || schema.type !== 'object' || schema.additionalProperties !== false || !object(schema.properties)) fail('scope');
    const fields = Object.keys(schema.properties);
    if (fields.length !== Object.keys(properties[name]).length) fail('scope');
    for (const field of fields) {
      const definition = schema.properties[field];
      if (!object(definition) || definition.type !== properties[name][field] || !(field in properties[name])) fail('scope');
    }
    const mandatory = schema.required ?? [];
    if (!Array.isArray(mandatory) || mandatory.length !== required[name].length
      || new Set(mandatory).size !== mandatory.length || mandatory.some((field: unknown) => typeof field !== 'string' || !required[name].includes(field))) fail('scope');
  }
}

function records(value: ObjectValue, field: string, count: string): unknown[] {
  const rows = value[field];
  if (!Array.isArray(rows) || rows.length > 1000 || value[count] !== rows.length || 'nextCursor' in value) fail('invalid');
  return rows;
}

/** Only exact target names survive this function; unrelated content is unread. */
function matching(rows: unknown[], field: string, names: Set<string>): Map<string, ObjectValue> {
  const found = new Map<string, ObjectValue>();
  for (const row of rows) {
    if (!object(row) || typeof row[field] !== 'string') fail('invalid');
    const name = row[field];
    if (!names.has(name)) continue;
    if (found.has(name) || !positiveId(row.id)) fail('conflict');
    found.set(name, row);
  }
  return found;
}

function reconcile(skills: Map<string, ObjectValue>, goals: Map<string, ObjectValue>, kit: Prepared): {
  missingSkills: Entry[]; missingDays: Entry[]; goalId: number | undefined; present: Set<string>;
} {
  const present = new Set<string>();
  const missingSkills = kit.skills.filter((skill) => {
    const remote = skills.get(skill.name);
    if (!remote) return true;
    if (remote.content !== skill.content || (remote.is_public !== undefined && remote.is_public !== false)) fail('conflict');
    present.add(skill.evidence);
    return false;
  });
  const goal = goals.get(GOAL);
  if (!goal) return { missingSkills, missingDays: kit.days, goalId: undefined, present };
  if (goal.зачем !== kit.goal.content || !Array.isArray(goal.карточки) || goal.карточки.length > 200) fail('conflict');
  present.add(kit.goal.evidence);
  const cards = matching(goal.карточки, 'название', new Set(kit.days.map((day) => day.name)));
  const missingDays = kit.days.filter((day) => {
    const remote = cards.get(day.name);
    if (!remote) return true;
    if (remote.заметка !== day.content || !['idea', 'замысел'].includes(String(remote.статус))
      || (remote.ролик !== undefined && remote.ролик !== null && remote.ролик !== '')) fail('conflict');
    present.add(day.evidence);
    return false;
  });
  // matching() has already checked this is a positive safe integer.
  return { missingSkills, missingDays, goalId: goal.id as number, present };
}

/** A missing/invalid credential disables only this optional integration. */
export function editorial999FromEnvironment(env: Record<string, string | undefined>): Editorial999 | undefined {
  const key = env.LEELA_999_AGENT_KEY?.trim();
  if (!key || key.length > 4096 || !/^[\x21-\x7e]+$/u.test(key)) return undefined;
  const fingerprint = digest(key);
  const databasePath = env.LEELA_DB?.trim();
  const journal = databasePath && isAbsolute(databasePath) && !databasePath.includes('\0')
    ? join(dirname(databasePath), `.leela-999-${fingerprint}.pending`) : undefined;
  const state = states.get(fingerprint) ?? { busy: false, uncertain: undefined, journal: undefined };
  states.set(fingerprint, state);
  let nextId = 0;

  async function rpc(method: 'initialize' | 'tools/list' | 'tools/call', params: ObjectValue, operationDeadline: number, context?: OperationContext): Promise<ObjectValue> {
    requireTime(operationDeadline);
    requireAuthority(context);
    const deadline = Math.min(operationDeadline, Date.now() + REQUEST_MS);
    const controller = new AbortController();
    const id = ++nextId;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      onAbort = () => {
        controller.abort();
        reject(new BridgeFailure('revoked'));
      };
      context?.signal?.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => {
        controller.abort();
        reject(new BridgeFailure('timeout'));
      }, Math.max(1, deadline - Date.now()));
    });
    const request = async (): Promise<ObjectValue> => {
      const response = await globalThis.fetch(ENDPOINT, {
        method: 'POST', redirect: 'error', credentials: 'omit',
        referrerPolicy: 'no-referrer', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Cache-Control': 'no-store', 'X-Agent-Key': key! },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      });
      try {
        requireAuthority(context);
        requireTime(deadline, controller.signal);
        if (!response.ok || response.redirected || (response.url && response.url !== ENDPOINT)) fail('transport');
        const body = await boundedJson(response, deadline, controller.signal);
        requireAuthority(context);
        if (!object(body) || body.jsonrpc !== '2.0' || body.id !== id || 'error' in body || !object(body.result)) fail('invalid');
        if ('error' in body.result || 'ошибка' in body.result
          || (body.result.isError !== undefined && body.result.isError !== false)) fail('invalid');
        return body.result;
      } finally {
        if (response.body && !response.body.locked) void response.body.cancel().catch(() => undefined);
      }
    };
    try {
      return await Promise.race([request(), timeout]);
    } catch (error) {
      if (error instanceof BridgeFailure) throw error;
      return fail('transport');
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (onAbort !== undefined) context?.signal?.removeEventListener('abort', onAbort);
      controller.abort();
    }
  }

  const call = async (name: Tool, args: ObjectValue, deadline: number, context?: OperationContext): Promise<ObjectValue> =>
    application(await rpc('tools/call', { name, arguments: args }, deadline, context));

  async function authorize(userId: number, deadline: number, context?: OperationContext): Promise<void> {
    if (!positiveId(userId)) fail('identity');
    const initialized = await rpc('initialize', {
      protocolVersion: '2024-11-05', capabilities: {},
      clientInfo: { name: 'leela-editorial', version: '1.0.0' },
    }, deadline, context);
    if (initialized.protocolVersion !== '2024-11-05' || !object(initialized._meta)
      || initialized._meta['leela.editorial.scope'] !== SCOPE) fail('scope');
    validateTools(await rpc('tools/list', {}, deadline, context));
    const identity = await call('whoami', {}, deadline, context);
    const owner = identity.telegram_id;
    // Actual 999 uses ctx.telegramId (a string). No parseInt/coercion: only the
    // canonical decimal representation or an exact safe-integer JSON number.
    if (owner !== userId && (typeof owner !== 'string' || owner !== String(userId))) fail('identity');
  }

  async function mutate(name: 'skills_create' | 'plan_goal_create' | 'plan_item_add', args: ObjectValue, target: Entry, deadline: number, context?: OperationContext): Promise<number> {
    requireTime(deadline);
    requireAuthority(context);
    state.uncertain = target.evidence;
    const result = await call(name, args, deadline, context);
    const flag = name === 'plan_item_add' ? 'добавлено' : 'создано';
    if (result[flag] === false) {
      state.uncertain = undefined; // Explicit application-level non-creation.
      fail('rejected');
    }
    if (result[flag] !== true || !positiveId(result.id)
      || (name === 'skills_create' && result.имя !== target.name)
      || (name !== 'skills_create' && result.цель !== GOAL)) fail('invalid');
    state.uncertain = undefined;
    return result.id;
  }

  const safeMessage = (error: unknown): string =>
    messages[error instanceof BridgeFailure ? error.kind : 'transport'];

  return {
    async status(userId, context) {
      try {
        await authorize(userId, Date.now() + OPERATION_MS, context);
        return '999: подтверждены ваш Telegram ID и draft-only-v1. Доступны только частные навыки и черновой план; модель, SOUL и публикация не вызываются.';
      } catch (error) { return safeMessage(error); }
    },
    async sync(userId, input, context) {
      if (state.busy) return messages.busy;
      state.busy = true;
      try {
        const deadline = Date.now() + OPERATION_MS;
        const kit = prepare(input);
        await authorize(userId, deadline, context);
        requireAuthority(context);
        // The cross-process lock MUST precede lists, not merely the first write:
        // otherwise a second process could act on a stale pre-lock snapshot.
        claimJournal(journal, state);
        // Drop unrelated list rows immediately, before awaiting another call.
        const skills = matching(
          records(await call('skills_list', {}, deadline, context), 'скиллы', 'всего'),
          'name', new Set(kit.skills.map((skill) => skill.name)),
        );
        const goals = matching(
          records(await call('plan_list', {}, deadline, context), 'цели', 'целей'),
          'цель', new Set([GOAL]),
        );
        const existing = reconcile(skills, goals, kit);
        if (state.uncertain !== undefined) {
          if (!existing.present.has(state.uncertain)) fail('uncertain');
          state.uncertain = undefined;
        }
        let created = 0;
        for (const skill of existing.missingSkills) {
          await mutate('skills_create', { name: skill.name, content: skill.content }, skill, deadline, context);
          created++;
        }
        const goalId = existing.goalId ?? await mutate('plan_goal_create', { title: GOAL, intent: kit.goal.content }, kit.goal, deadline, context);
        if (existing.goalId === undefined) created++;
        for (const day of existing.missingDays) {
          // No status/publication/template_id arguments exist on this path.
          await mutate('plan_item_add', { goal_id: goalId, title: day.name, note: day.content }, day, deadline, context);
          created++;
        }
        releaseJournal(state);
        return `999: сверены частные навыки (3) и черновые карточки (30). Новых записей: ${created}. Публикация не выполнялась.`;
      } catch (error) {
        let message = safeMessage(error);
        if (state.uncertain === undefined) {
          try { releaseJournal(state); } catch { message = messages.journal; }
        }
        return `${message}\nСинхронизация остановлена; подтверждённые записи сохранены.${state.uncertain ? `\n${messages.uncertain}` : ''}`;
      } finally { state.busy = false; }
    },
  };
}
