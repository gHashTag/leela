/**
 * Who each reply is for.
 *
 * `Reply.broadcast` has been set on every reply since the command layer was
 * written, and the transport ignored it: everything went to the chat the
 * command came from. In a private chat that is harmless. In a group it means a
 * player's `/path` — their own reflections on themselves — is read out to
 * everyone at the table, along with the gate telling them to write one.
 *
 * The decision is a pure function so it can be tested; sending is not.
 */

import { type Language, messageFor } from '@leela/content';

export type Destination =
  /** Send to the chat the command came from. */
  | { kind: 'chat' }
  /** Send to the player directly, and say nothing in the group. */
  | { kind: 'direct'; userId: string }
  /**
   * Send to the chat, because there is nowhere private to send it.
   * The caller should keep it short: the content is the thing being exposed.
   */
  | { kind: 'chat-fallback'; reason: 'no-private-channel' };

export interface DeliveryContext {
  /** Telegram chat type. Only `private` is one-to-one. */
  chatType: 'private' | 'group' | 'supergroup' | 'channel';
  /** Who asked. */
  userId: string;
  /** Whether the bot has ever managed to write to this user directly. */
  canWriteDirectly: boolean;
}

/**
 * Where a reply should go.
 *
 * In a private chat there is no distinction to make. In a group, a reply marked
 * private goes to the player — unless the bot has never been able to reach
 * them, in which case there is a real choice between exposing the content and
 * withholding it, and the caller is told which situation it is in rather than
 * having one silently picked.
 */
export function destinationFor(
  reply: { broadcast: boolean },
  context: DeliveryContext,
): Destination {
  if (context.chatType === 'private') return { kind: 'chat' };
  if (reply.broadcast) return { kind: 'chat' };

  return context.canWriteDirectly
    ? { kind: 'direct', userId: context.userId }
    : { kind: 'chat-fallback', reason: 'no-private-channel' };
}

/**
 * What to say in the group when a private reply could not be sent privately.
 *
 * Deliberately does not include the content: the whole point of the reply being
 * private is that the group should not read it.
 */
export function nudgeToPrivate(language: Language, command: string): string {
  return messageFor(language, 'chat.private', { command });
}

/**
 * Remembers which users the bot has managed to reach directly.
 *
 * Telegram refuses a message to anyone who has not started a chat with the bot
 * (403), and there is no way to ask in advance — the only way to know is to
 * try. So: assume it works, and remember the refusal.
 */
export class DirectChannels {
  private readonly refused = new Set<string>();

  canWrite(userId: string): boolean {
    return !this.refused.has(userId);
  }

  /** Called after a 403, so the next reply does not try and fail again. */
  refuse(userId: string): void {
    this.refused.add(userId);
  }

  /** Called when a direct message succeeds, in case they have since started one. */
  allow(userId: string): void {
    this.refused.delete(userId);
  }

  get refusedCount(): number {
    return this.refused.size;
  }
}

/** True when a Telegram error means "this user cannot be messaged directly". */
export function isBlockedByUser(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { error_code?: unknown }).error_code;
  const description = String((error as { description?: unknown }).description ?? '');

  // 403 covers both "bot was blocked" and "chat not found" for a user who has
  // never started a conversation.
  return code === 403 || /bot can't initiate|chat not found|blocked/i.test(description);
}
