/**
 * One daily invitation from Leela's public channel into a private game.
 *
 * Telegram mirrors every channel post into its linked discussion group, so
 * this engine sends exactly once: to the configured channel. The post carries
 * canonical teaching, one bounded reflective question and one deep link. It
 * never receives a reader id, report, intention or private game state.
 */

import { engagementFallbackText, type Guide } from '@leela/ai';
import {
  LANGUAGES,
  messageFor,
  planFor,
  resolveLanguage,
  type Language,
  type Plan,
} from '@leela/content';
import type { InlineKeyboardMarkup } from 'grammy/types';
import { excerptsOf, msUntilHour } from './initiative';
import { DAY_MS } from './stars';
import type { PublicBridge, PublicOutreachStore } from './store';

export const DEFAULT_PUBLIC_HOUR = 7;
export const DEFAULT_PUBLIC_LANGUAGE: Language = 'ru';

/** Public channel usernames only. IDs and links are deliberately not guessed. */
export function publicChannel(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const value = env.LEELA_PUBLIC_CHANNEL?.trim();
  return value && /^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(value) ? value : null;
}

/** The UTC hour for the daily post. */
export function publicHour(env: Record<string, string | undefined> = process.env): number {
  const value = env.LEELA_PUBLIC_HOUR?.trim();
  if (!value) return DEFAULT_PUBLIC_HOUR;
  const hour = Number(value);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_PUBLIC_HOUR;
}

/** Public copy defaults to Russian; an unknown locale does not silently switch it. */
export function publicLanguage(
  env: Record<string, string | undefined> = process.env,
): Language {
  const value = env.LEELA_PUBLIC_LANGUAGE?.trim();
  if (!value) return DEFAULT_PUBLIC_LANGUAGE;
  const primary = value.toLowerCase().split(/[-_]/)[0] ?? '';
  return (LANGUAGES as readonly string[]).includes(primary)
    ? resolveLanguage(primary)
    : DEFAULT_PUBLIC_LANGUAGE;
}

/** UTC day number: both the idempotency key and the anonymous attribution cohort. */
export function publicDay(at: number): number {
  return Math.floor(at / DAY_MS);
}

/** Deterministic 72-day rotation, so every plan is heard before one repeats. */
export function planOfDay(at: number): number {
  const day = publicDay(at);
  return ((day % 72) + 72) % 72 + 1;
}

export function publicStartPayload(day: number): string {
  if (!Number.isSafeInteger(day) || day < 0) throw new Error('public day must be non-negative');
  return `public_${day.toString(36)}`;
}

/** Parse only payloads this module can have issued. */
export function startedFromPublic(payload: string | undefined | null): number | null {
  const match = payload?.trim().match(/^public_([0-9a-z]+)$/);
  if (!match) return null;
  const encoded = match[1] ?? '';
  const day = Number.parseInt(encoded, 36);
  if (!Number.isSafeInteger(day) || day < 0 || day.toString(36) !== encoded) return null;
  return day;
}

export function publicStartUrl(username: string, day: number): string {
  const name = username.replace(/^@/, '');
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(name)) throw new Error('invalid bot username');
  return `https://t.me/${name}?start=${publicStartPayload(day)}`;
}

export interface PublicPost {
  text: string;
  plan: Plan;
  excerpt: string;
}

/** Canonical body plus one reflection. The button carries the only link. */
export function composePublicPost(
  language: Language,
  planNumber: number,
  bridge: string,
): PublicPost {
  const plan = planFor(language, planNumber);
  const excerpt = excerptsOf(plan.body)[0] ?? plan.body.trim().slice(0, 500);
  const text = [
    messageFor(language, 'public.plan', { plan: plan.plan, title: plan.title }),
    excerpt,
    messageFor(language, 'public.question'),
    bridge.trim(),
    messageFor(language, 'public.invitation'),
  ].join('\n\n');

  if (text.length > 4096) throw new Error('public post exceeds Telegram limit');
  return { text, plan, excerpt };
}

interface PublicApi {
  sendMessage(
    chatId: string,
    text: string,
    other?: {
      reply_markup?: InlineKeyboardMarkup;
      link_preview_options?: { is_disabled: boolean };
    },
  ): Promise<unknown>;
}

export interface PublicOutreachOptions {
  api: PublicApi;
  posts: PublicOutreachStore;
  companion?: Pick<Guide, 'engage' | 'status'>;
  channel: string | null;
  language: Language;
  hour?: number;
  now?: () => number;
  schedule?: (run: () => void, inMs: number) => () => void;
  log?: (message: string) => void;
}

export type PublicTick =
  | { posted: true; bridge: PublicBridge }
  | { posted: false; because: 'disabled' | 'already-posted' | 'undelivered' };

export interface PublicOutreach {
  runTick(at: number, username: string): Promise<PublicTick>;
  start(username: string): Promise<void>;
  stop(): void;
}

export function createPublicOutreach({
  api,
  posts,
  companion,
  channel,
  language,
  hour = DEFAULT_PUBLIC_HOUR,
  now = Date.now,
  schedule = (run, inMs) => {
    const timer = setTimeout(run, inMs);
    timer.unref?.();
    return () => clearTimeout(timer);
  },
  log = console.log,
}: PublicOutreachOptions): PublicOutreach {
  let armed = false;
  let cancel: (() => void) | undefined;
  const sending = new Set<number>();
  const delivered = new Set<number>();

  const runTick = async (at: number, username: string): Promise<PublicTick> => {
    if (!channel) return { posted: false, because: 'disabled' };
    const day = publicDay(at);
    let already: boolean;
    try {
      already = (await posts.of(day)) !== null;
    } catch {
      // Without the marker there is no safe answer to "already sent?". Stay
      // quiet instead of risking a duplicate, and do not block bot startup.
      log('[public] daily marker could not be read; no post was attempted.');
      return { posted: false, because: 'undelivered' };
    }
    if (sending.has(day) || delivered.has(day) || already) {
      return { posted: false, because: 'already-posted' };
    }
    sending.add(day);

    try {
      const plan = planOfDay(at);
      const options = { language, plan, reportOwed: true } as const;
      let reflection = { text: engagementFallbackText(options), fromModel: false };

      try {
        if (companion?.status().available) reflection = await companion.engage(options);
      } catch {
        // A public invitation remains useful without the optional model. Error
        // contents are intentionally not logged: provider responses may echo data.
        reflection = { text: engagementFallbackText(options), fromModel: false };
      }

      const bridge: PublicBridge = reflection.fromModel ? 'model' : 'canonical';
      const post = composePublicPost(language, plan, reflection.text);
      const reply_markup: InlineKeyboardMarkup = {
        inline_keyboard: [
          [
            {
              text: messageFor(language, 'public.play'),
              url: publicStartUrl(username, day),
            },
          ],
        ],
      };

      try {
        await api.sendMessage(channel, post.text, {
          reply_markup,
          link_preview_options: { is_disabled: true },
        });
      } catch {
        log(`[public] plan ${plan} was not delivered; the day remains available for retry.`);
        return { posted: false, because: 'undelivered' };
      }

      // Remember in-process before the durable write. If storage fails after
      // Telegram accepted the post, retrying would create the spam this cap is
      // meant to prevent. The next clean start can reconcile from durable data.
      delivered.add(day);
      try {
        await posts.record({ day, plan, sentAt: at, bridge });
      } catch {
        log(`[public] posted plan ${plan}, but its daily marker could not be kept.`);
      }
      log(`[public] posted plan ${plan}; bridge=${bridge}.`);
      return { posted: true, bridge };
    } finally {
      sending.delete(day);
    }
  };

  const arm = (username: string): void => {
    cancel = schedule(() => {
      void runTick(now(), username).finally(() => arm(username));
    }, msUntilHour(now(), hour));
  };

  return {
    runTick,
    async start(username): Promise<void> {
      if (armed) return;
      armed = true;
      if (!channel) return;
      await runTick(now(), username);
      arm(username);
    },
    stop(): void {
      cancel?.();
      cancel = undefined;
      armed = false;
    },
  };
}
