/** Share-safe plan cards for Telegram Guest and Inline Mode. */

import { messageFor, planFor, type Language } from '@leela/content';
import type { InlineQueryResultArticle } from 'grammy/types';
import { mainMiniAppUrl } from './acquisition';
import { excerptsOf } from './initiative';

export const MAX_DISCOVERY_BRIDGE_CHARS = 800;

/** Model text that is safe to place in an unrelated chat. */
export function discoveryBridge(language: Language, text: string): string {
  const held = text.replace(/\s+/g, ' ').trim();
  if (
    held.length === 0 ||
    held.length > MAX_DISCOVERY_BRIDGE_CHARS ||
    /https?:\/\/|t\.me\//iu.test(held) ||
    /(?:^|\s)\/[a-z_][a-z0-9_-]*/iu.test(held)
  ) {
    return messageFor(language, 'nudge.agentReport');
  }
  return held;
}

export function discoveryPlan(query: string, daily: number): number {
  const written = query.trim();
  if (/^[0-9]{1,2}$/.test(written)) {
    const plan = Number(written);
    if (plan >= 1 && plan <= 72) return plan;
  }
  return daily;
}

export function discoveryText(language: Language, planNumber: number, bridge: string): string {
  const plan = planFor(language, planNumber);
  const excerpt = excerptsOf(plan.body)[0] ?? plan.body.trim().slice(0, 500);
  const text = [
    messageFor(language, 'public.plan', { plan: plan.plan, title: plan.title }),
    excerpt,
    discoveryBridge(language, bridge),
  ].join('\n\n');
  return text.slice(0, 4096);
}

export function discoveryResult({
  language,
  plan,
  bridge,
  username,
  campaign,
}: {
  language: Language;
  plan: number;
  bridge: string;
  username: string;
  campaign: 'guest' | 'inline';
}): InlineQueryResultArticle {
  const canonical = planFor(language, plan);
  const text = discoveryText(language, plan, bridge);
  return {
    type: 'article',
    id: `${campaign}-${plan}`,
    title: `${plan}. ${canonical.title}`,
    description: (excerptsOf(canonical.body)[0] ?? canonical.body).slice(0, 250),
    input_message_content: { message_text: text },
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: messageFor(language, 'public.play'),
            url: mainMiniAppUrl(username, campaign),
          },
        ],
      ],
    },
  };
}

export interface GuestMessage {
  guest_query_id: string;
  text?: string;
  /** The caller on an incoming `guest_message`; Telegram may omit `from`. */
  from?: {
    id: number;
    language_code?: string;
  };
}

export function guestMessageOf(update: unknown): GuestMessage | null {
  if (typeof update !== 'object' || update === null) return null;
  const held = (update as { guest_message?: unknown }).guest_message;
  if (typeof held !== 'object' || held === null) return null;
  const message = held as Partial<GuestMessage>;
  if (typeof message.guest_query_id !== 'string' || !message.guest_query_id) return null;
  if (message.from !== undefined && typeof message.from.id !== 'number') return null;
  return message as GuestMessage;
}

export function guestQuestion(text: string | undefined, username: string): string {
  if (!text) return '';
  const mention = new RegExp(`@${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'igu');
  return text.replace(mention, '').replace(/\s+/g, ' ').trim().slice(0, 512);
}
