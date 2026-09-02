import { describe, expect, it } from 'vitest';
import { Guide, fixedModel } from '@leela/ai';
import { DAY_MS } from '../src/stars';
import { MemoryPublicOutreachStore } from '../src/store';
import {
  DEFAULT_PUBLIC_HOUR,
  composePublicPost,
  createPublicOutreach,
  planOfDay,
  publicChannel,
  publicDay,
  publicHour,
  publicLanguage,
  publicStartPayload,
  publicStartUrl,
  startedFromPublic,
} from '../src/public-outreach';

const AT = Date.UTC(2026, 8, 2, 10, 0, 0);

describe('public outreach configuration', () => {
  it('is dark without an explicit channel and refuses malformed targets', () => {
    expect(publicChannel({})).toBeNull();
    expect(publicChannel({ LEELA_PUBLIC_CHANNEL: 'GAIA' })).toBeNull();
    expect(publicChannel({ LEELA_PUBLIC_CHANNEL: 'https://t.me/leelachakraapp' })).toBeNull();
    expect(publicChannel({ LEELA_PUBLIC_CHANNEL: '@leelachakraapp' })).toBe('@leelachakraapp');
  });

  it('has one bounded UTC hour and a Russian default without guessing', () => {
    expect(publicHour({})).toBe(DEFAULT_PUBLIC_HOUR);
    expect(publicHour({ LEELA_PUBLIC_HOUR: '0' })).toBe(0);
    expect(publicHour({ LEELA_PUBLIC_HOUR: '23' })).toBe(23);
    expect(publicHour({ LEELA_PUBLIC_HOUR: '24' })).toBe(DEFAULT_PUBLIC_HOUR);
    expect(publicHour({ LEELA_PUBLIC_HOUR: 'soon' })).toBe(DEFAULT_PUBLIC_HOUR);
    expect(publicLanguage({})).toBe('ru');
    expect(publicLanguage({ LEELA_PUBLIC_LANGUAGE: 'en-US' })).toBe('en');
    expect(publicLanguage({ LEELA_PUBLIC_LANGUAGE: 'unknown' })).toBe('ru');
  });
});

describe('the public plan and link', () => {
  it('visits every plan exactly once before repeating', () => {
    const plans = Array.from({ length: 72 }, (_, offset) => planOfDay(AT + offset * DAY_MS));
    expect([...new Set(plans)].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 72 }, (_, index) => index + 1),
    );
    expect(planOfDay(AT + 72 * DAY_MS)).toBe(planOfDay(AT));
  });

  it('round-trips only its own bounded deep-link payload', () => {
    const day = publicDay(AT);
    const payload = publicStartPayload(day);
    expect(startedFromPublic(payload)).toBe(day);
    expect(startedFromPublic('public_')).toBeNull();
    expect(startedFromPublic('public_not-a-day')).toBeNull();
    expect(startedFromPublic('somebody_else')).toBeNull();
    expect(publicStartUrl('leela_test_bot', day)).toBe(
      `https://t.me/leela_test_bot?start=${payload}`,
    );
  });

  it('keeps canonical teaching, one question and a single invitation', () => {
    const post = composePublicPost('ru', planOfDay(AT), 'Что вы готовы увидеть без оправданий?');
    expect(post.text).toContain(post.plan.title);
    expect(post.text).toContain(post.excerpt);
    expect(post.text.match(/\?/g)).toHaveLength(1);
    expect(post.text.length).toBeLessThanOrEqual(4096);
    expect(post.text).not.toContain('/roll');
    expect(post.text).not.toContain('http');
  });
});

describe('one public post per UTC day', () => {
  function harness(options: { fail?: boolean; answer?: string } = {}) {
    const sent: Array<{ chatId: string; text: string; other: Record<string, unknown> }> = [];
    const posts = new MemoryPublicOutreachStore();
    const guide = new Guide({
      model: fixedModel(options.answer ?? 'Заметьте, где ясность уже присутствует. Что она просит увидеть?'),
      log: () => undefined,
    });
    const api = {
      async sendMessage(chatId: string, text: string, other: Record<string, unknown>) {
        sent.push({ chatId, text, other });
        if (options.fail) throw new Error('offline');
        return { message_id: 1 };
      },
    };
    const outreach = createPublicOutreach({
      api,
      posts,
      companion: guide,
      channel: '@leelachakraapp',
      language: 'ru',
      now: () => AT,
      log: () => undefined,
    });
    return { outreach, posts, sent };
  }

  it('publishes once, records success and does not send directly to the linked group', async () => {
    const { outreach, posts, sent } = harness();
    const first = await outreach.runTick(AT, 'leela_test_bot');
    const second = await outreach.runTick(AT + 1_000, 'leela_test_bot');

    expect(first).toMatchObject({ posted: true, bridge: 'model' });
    expect(second).toEqual({ posted: false, because: 'already-posted' });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.chatId).toBe('@leelachakraapp');
    expect(JSON.stringify(sent[0]?.other)).toContain(
      publicStartUrl('leela_test_bot', publicDay(AT)),
    );
    expect((await posts.of(publicDay(AT)))?.starts).toBe(0);
  });

  it('falls back to canonical wording when the public bridge is unsafe', async () => {
    const { outreach, sent } = harness({ answer: 'Срочно бросьте кубик и продолжайте игру?' });
    await expect(outreach.runTick(AT, 'leela_test_bot')).resolves.toMatchObject({
      posted: true,
      bridge: 'canonical',
    });
    expect(sent[0]?.text).toContain('Что этот план просит вас честно заметить прямо сейчас?');
  });

  it('does not spend the day when Telegram refuses the send', async () => {
    const { outreach, posts } = harness({ fail: true });
    await expect(outreach.runTick(AT, 'leela_test_bot')).resolves.toEqual({
      posted: false,
      because: 'undelivered',
    });
    expect(await posts.of(publicDay(AT))).toBeNull();
  });

  it('stays quiet without a readable daily marker instead of blocking startup', async () => {
    let sends = 0;
    const outreach = createPublicOutreach({
      api: {
        async sendMessage() {
          sends += 1;
          return { message_id: 1 };
        },
      },
      posts: {
        async of() {
          throw new Error('database unavailable');
        },
        async record() {},
        async started() {},
      },
      channel: '@leelachakraapp',
      language: 'ru',
      log: () => undefined,
    });

    await expect(outreach.runTick(AT, 'leela_test_bot')).resolves.toEqual({
      posted: false,
      because: 'undelivered',
    });
    expect(sends).toBe(0);
  });

  it('keeps concurrent ticks inside the same daily cap', async () => {
    const posts = new MemoryPublicOutreachStore();
    const sent: string[] = [];
    let release: () => void = () => undefined;
    let entered: () => void = () => undefined;
    const enteredSend = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const mayFinish = new Promise<void>((resolve) => {
      release = resolve;
    });
    const outreach = createPublicOutreach({
      api: {
        async sendMessage(_chatId, text) {
          sent.push(text);
          entered();
          await mayFinish;
          return { message_id: 1 };
        },
      },
      posts,
      channel: '@leelachakraapp',
      language: 'ru',
      log: () => undefined,
    });

    const first = outreach.runTick(AT, 'leela_test_bot');
    await enteredSend;
    await expect(outreach.runTick(AT, 'leela_test_bot')).resolves.toEqual({
      posted: false,
      because: 'already-posted',
    });
    release();
    await expect(first).resolves.toMatchObject({ posted: true });
    expect(sent).toHaveLength(1);
  });

  it('runs immediately once, then arms the configured daily hour', async () => {
    const scheduled: Array<{ run: () => void; inMs: number }> = [];
    const { posts, sent } = harness();
    const outreach = createPublicOutreach({
      api: {
        async sendMessage(chatId: string, text: string, other: Record<string, unknown>) {
          sent.push({ chatId, text, other });
          return { message_id: 1 };
        },
      },
      posts,
      channel: '@leelachakraapp',
      language: 'ru',
      hour: 7,
      now: () => AT,
      schedule: (run, inMs) => {
        scheduled.push({ run, inMs });
        return () => undefined;
      },
      log: () => undefined,
    });

    await outreach.start('leela_test_bot');
    await outreach.start('leela_test_bot');

    expect(sent).toHaveLength(1);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]?.inMs).toBeGreaterThan(0);
    expect(scheduled[0]?.inMs).toBeLessThanOrEqual(DAY_MS);
  });
});
