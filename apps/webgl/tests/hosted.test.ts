import { afterEach, describe, expect, it, vi } from 'vitest';

import { announce, announcePath, hostOf, type Host } from '../src/hosted';
import { write, type Kept } from '../src/kept';
import { add } from '../src/written';

/**
 * The board, telling the app that embeds it where the player is.
 *
 * The phone app hands this page a position on load and reads one back. Only the
 * first half existed for one pass: a player climbed in 3D, closed the board, and
 * found the flat one still standing where they had left it — two positions in a
 * game about one.
 */

const A_GAME: Kept = {
  seats: [
    {
      id: 'p1',
      deity: 'vishnu',
      state: {
        loka: 41,
        previous_loka: 35,
        direction: '',
        consecutive_sixes: 0,
        position_before_three_sixes: 0,
        is_finished: false,
      },
      rolls: [6, 5],
    },
  ],
  turnIndex: 0,
  lastThrower: 0,
};

/** A host that keeps what it was told. */
const listening = (): Host & { heard: string[] } => {
  const heard: string[] = [];
  return { heard, postMessage: (message: string) => void heard.push(message) };
};

afterEach(() => {
  delete (globalThis as { ReactNativeWebView?: unknown }).ReactNativeWebView;
});

describe('finding the host', () => {
  it('is nothing in an ordinary browser', () => {
    // The usual case, and not a failure: at `localhost:4173` this page is the
    // game, and `localStorage` is where the game lives.
    expect(hostOf()).toBeNull();
  });

  it('is nothing when what is there cannot take a message', () => {
    // A name on `window` is not a host. Trusting the name and calling
    // `postMessage` on it is a `TypeError` thrown out of a save.
    for (const impostor of [null, 'yes', 42, {}, { postMessage: 'soon' }]) {
      (globalThis as { ReactNativeWebView?: unknown }).ReactNativeWebView = impostor;
      expect(hostOf()).toBeNull();
    }
  });

  it('is the host when one can', () => {
    const host = listening();
    (globalThis as { ReactNativeWebView?: unknown }).ReactNativeWebView = host;
    expect(hostOf()).toBe(host);
  });
});

describe('telling the app', () => {
  it('sends the record the app already knows how to read, and says what it is', () => {
    const host = listening();
    expect(announce(A_GAME, host)).toBe(true);
    // Named and versioned. The first pass sent a bare `Kept`, which worked and
    // was a dead end: once a second kind of news existed there was nothing in
    // the message saying which kind it was, and the reader had to guess from
    // the fields it happened to find.
    expect(JSON.parse(host.heard[0] ?? '')).toEqual({ leela: 1, what: 'game', game: A_GAME });
  });

  it('sends what the player wrote as its own kind of news', () => {
    // Two kinds, because two things change here and they change at different
    // moments: the board on a throw, the path when the player writes. One
    // message for both would re-send the whole path on every throw.
    const host = listening();
    const path = [{ plan: 23, text: 'the heavens are a lure', at: 300 }];
    expect(announcePath(path, host)).toBe(true);
    expect(JSON.parse(host.heard[0] ?? '')).toEqual({ leela: 1, what: 'path', path });
  });

  it('says nothing about a path with nobody hosting', () => {
    expect(announcePath([{ plan: 23, text: 'unheard', at: 300 }], null)).toBe(false);
  });

  it('says nothing, and does not fail, with nobody hosting', () => {
    expect(announce(A_GAME, null)).toBe(false);
  });

  it('survives a host that refuses', () => {
    // A refused message is not a game that stopped: the board is saved either
    // way, and what is lost is the flat board learning about it.
    const deaf: Host = {
      postMessage: () => {
        throw new Error('gone');
      },
    };
    expect(() => announce(A_GAME, deaf)).not.toThrow();
    expect(announce(A_GAME, deaf)).toBe(false);
  });
});

describe('every account written', () => {
  it('reaches the app, because writing is the one funnel', () => {
    // The record the game exists to produce. It used to stay on this side
    // entirely: the player climbed in 3D, wrote about each square, closed the
    // board, and the phone had the position and none of the writing.
    const host = listening();
    (globalThis as { ReactNativeWebView?: unknown }).ReactNativeWebView = host;

    const store = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    add(store, { plan: 23, text: 'the heavens are a lure', at: 300 });

    const told = JSON.parse(host.heard[0] ?? '');
    expect(told.what).toBe('path');
    expect(told.path).toHaveLength(1);
  });

  it('reaches the app even when the disk refuses', () => {
    const host = listening();
    (globalThis as { ReactNativeWebView?: unknown }).ReactNativeWebView = host;

    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {},
    };
    add(full, { plan: 23, text: 'written anyway', at: 300 });
    expect(host.heard).toHaveLength(1);
  });
});

describe('every saved change', () => {
  it('reaches the app, because saving is the one funnel', () => {
    // The point of putting this inside `write`: a rule kept by remembering to
    // call something is a rule the next handler is written without.
    const host = listening();
    (globalThis as { ReactNativeWebView?: unknown }).ReactNativeWebView = host;

    const store = { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() };
    expect(write(store, A_GAME)).toBe(true);
    expect(host.heard).toHaveLength(1);
  });

  it('reaches the app even when the disk refuses', () => {
    // The two are independent. A device that will not keep the game has not
    // stopped the game, and the app still needs to know where the player is.
    const host = listening();
    (globalThis as { ReactNativeWebView?: unknown }).ReactNativeWebView = host;

    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {},
    };
    expect(write(full, A_GAME)).toBe(false);
    expect(host.heard).toHaveLength(1);
  });
});
