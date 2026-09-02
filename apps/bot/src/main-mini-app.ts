/** Opening a private game from Telegram's signed Main Mini App surface. */

import { openRoom, start } from './commands';
import { seedFor, type RoomStore } from './store';
import type { Vouched } from './vouched';

export async function roomForMiniApp({
  who,
  store,
  now = Date.now,
  log = console.log,
}: {
  who: Vouched;
  store: RoomStore;
  now?: () => number;
  log?: (message: string) => void;
}) {
  const held = (await store.roomOf?.(who.id)) ?? (await store.get(who.id));
  if (held) return held;

  const opened = openRoom(who.id, { id: who.id, name: who.name }, seedFor(who.id, now()), {
    language: who.language ?? undefined,
  });
  if (!opened.room) return null;
  const begun = start(opened.room, who.id);
  if (!begun.room) return null;

  try {
    await store.save(begun.room);
    return begun.room;
  } catch {
    log('[miniapp] first-contact game could not be kept.');
    return null;
  }
}
