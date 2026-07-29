import { describe, expect, it } from 'vitest';
import {
  DirectChannels,
  destinationFor,
  isBlockedByUser,
  nudgeToPrivate,
  type DeliveryContext,
} from '../src/delivery';

const inGroup: DeliveryContext = {
  chatType: 'group',
  userId: 'u1',
  canWriteDirectly: true,
};

const alone: DeliveryContext = { ...inGroup, chatType: 'private' };

describe('a private reply in a group goes to the player', () => {
  // The flag was set on every reply from the start and the transport ignored
  // it, so a player's /path — their own reflections on themselves — was read
  // out to everyone at the table.

  it('sends a private reply directly', () => {
    expect(destinationFor({ broadcast: false }, inGroup)).toEqual({
      kind: 'direct',
      userId: 'u1',
    });
  });

  it('sends a broadcast reply to the group, where it belongs', () => {
    expect(destinationFor({ broadcast: true }, inGroup)).toEqual({ kind: 'chat' });
  });

  it('makes no distinction in a private chat, where there is none to make', () => {
    expect(destinationFor({ broadcast: false }, alone)).toEqual({ kind: 'chat' });
    expect(destinationFor({ broadcast: true }, alone)).toEqual({ kind: 'chat' });
  });

  it('treats a supergroup like a group', () => {
    const supergroup: DeliveryContext = { ...inGroup, chatType: 'supergroup' };
    expect(destinationFor({ broadcast: false }, supergroup).kind).toBe('direct');
  });
});

describe('when there is nowhere private to send it', () => {
  const unreachable: DeliveryContext = { ...inGroup, canWriteDirectly: false };

  it('says so, rather than silently choosing to expose it', () => {
    expect(destinationFor({ broadcast: false }, unreachable)).toEqual({
      kind: 'chat-fallback',
      reason: 'no-private-channel',
    });
  });

  it('offers a nudge that carries none of the content', () => {
    const nudge = nudgeToPrivate('/path');
    expect(nudge).toContain('/path');
    expect(nudge).toContain('/start');
    // The reply's own text must not leak into the group.
    expect(nudge).not.toMatch(/plan \d+/);
  });

  it('still sends a broadcast reply to the group', () => {
    expect(destinationFor({ broadcast: true }, unreachable)).toEqual({ kind: 'chat' });
  });
});

describe('DirectChannels', () => {
  // Telegram refuses a message to anyone who has not started a chat, and there
  // is no way to ask in advance. So: assume it works, remember the refusal.

  it('assumes a user can be reached until proven otherwise', () => {
    expect(new DirectChannels().canWrite('u1')).toBe(true);
  });

  it('remembers a refusal, so the next reply does not try and fail again', () => {
    const channels = new DirectChannels();
    channels.refuse('u1');
    expect(channels.canWrite('u1')).toBe(false);
    expect(channels.canWrite('u2')).toBe(true);
  });

  it('forgets a refusal once a message gets through', () => {
    // A player who starts a chat later must not stay locked out.
    const channels = new DirectChannels();
    channels.refuse('u1');
    channels.allow('u1');
    expect(channels.canWrite('u1')).toBe(true);
  });

  it('counts who it has given up on, for a health check', () => {
    const channels = new DirectChannels();
    channels.refuse('u1');
    channels.refuse('u2');
    channels.refuse('u1');
    expect(channels.refusedCount).toBe(2);
  });
});

describe('isBlockedByUser', () => {
  it('recognises a 403', () => {
    expect(isBlockedByUser({ error_code: 403, description: 'Forbidden: bot was blocked' })).toBe(
      true,
    );
  });

  it('recognises the wording for a user who never started a chat', () => {
    expect(
      isBlockedByUser({ error_code: 400, description: "Bad Request: chat not found" }),
    ).toBe(true);
    expect(
      isBlockedByUser({
        error_code: 400,
        description: "Bad Request: bot can't initiate conversation with a user",
      }),
    ).toBe(true);
  });

  it('does not mistake other failures for a blocked user', () => {
    // Retrying elsewhere is right for these; giving up on the user is not.
    expect(isBlockedByUser({ error_code: 429, description: 'Too Many Requests' })).toBe(false);
    expect(isBlockedByUser({ error_code: 500, description: 'Internal Server Error' })).toBe(false);
    expect(isBlockedByUser(new Error('fetch failed'))).toBe(false);
  });

  it('survives being handed anything at all', () => {
    for (const value of [null, undefined, 'a string', 42, {}]) {
      expect(isBlockedByUser(value), String(value)).toBe(false);
    }
  });
});
