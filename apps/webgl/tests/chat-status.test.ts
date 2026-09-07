import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LANGUAGES, messageFor } from '@leela/content';
import { showChatStatus } from '../src/chat-status';
import { blank } from '../../../scripts/lib/source.mjs';

afterEach(() => vi.unstubAllGlobals());

describe('chat diagnostics belong to the chat surface, not the native app', () => {
  const keys = [
    'app.chatNotOpened', 'app.chatUnreachable', 'app.chatNoGame',
    'app.inTheChat', 'app.chatOldBot', 'app.chatBusyTable', 'app.chatAdopted',
  ] as const;

  it('clears visible and accessible status for every language and outcome in native', () => {
    vi.stubGlobal('ReactNativeWebView', { postMessage: vi.fn() });
    for (const language of LANGUAGES) for (const key of keys) {
      const target = { textContent: 'stale chat status', hidden: false };
      showChatStatus(target, messageFor(language, key, { plan: 6, seats: 2 }));
      expect(target, `${language}: ${key}`).toEqual({ textContent: '', hidden: true });
    }
  });

  it('preserves every diagnostic outside native, including errors', () => {
    for (const language of LANGUAGES) for (const key of keys) {
      const text = messageFor(language, key, { plan: 6, seats: 2 });
      const target = { textContent: '', hidden: true };
      showChatStatus(target, text, null);
      expect(target).toEqual({ textContent: text, hidden: false });
    }
  });

  it('routes all main status writes through this boundary', () => {
    const source = blank(readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'));
    expect(source.includes('showChatStatus(el.inTheChat,')).toBe(true);
    expect(/el\.inTheChat\.(?:textContent|hidden)\s*=/.test(source)).toBe(false);
  });
});
