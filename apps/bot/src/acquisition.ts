/** Privacy-minimal first-touch attribution for Telegram acquisition. */

import {
  ACQUISITION_SOURCES,
  type AcquisitionRecord,
  type AcquisitionSource,
  type AcquisitionStore,
} from './store';

export { ACQUISITION_SOURCES };

export interface Attribution {
  source: AcquisitionSource;
  campaign: string | null;
}

const PUBLIC = /^public_([0-9a-z]+)$/;
const OWNED_CAMPAIGNS = new Set(['main', 'guest', 'inline']);

function publicAttribution(payload: string): Attribution | null {
  const match = PUBLIC.exec(payload);
  const campaign = match?.[1];
  if (!campaign || campaign.length > 32) return null;
  return { source: 'public', campaign };
}

/** A private `/start` payload. Unknown campaigns remain truthful direct starts. */
export function acquisitionFromStart(payload: string | undefined | null): Attribution {
  const held = payload?.trim().toLowerCase() ?? '';
  const publicStart = publicAttribution(held);
  if (publicStart) return publicStart;
  if (held === 'guest' || held === 'inline') return { source: held, campaign: null };
  return { source: 'direct', campaign: null };
}

/** A start parameter already covered by Telegram's verified initData signature. */
export function acquisitionFromMiniApp(
  startParam: string | undefined | null,
  valid = true,
): Attribution {
  if (!valid) return { source: 'direct', campaign: null };
  const held = startParam?.trim().toLowerCase() ?? '';
  const publicStart = publicAttribution(held);
  if (publicStart) return publicStart;
  if (held === 'guest' || held === 'inline') return { source: held, campaign: null };
  if (held === '' || held === 'main') return { source: 'mini_app', campaign: null };
  return { source: 'direct', campaign: null };
}

export function mainMiniAppUrl(username: string, campaign = 'main'): string {
  const name = username.replace(/^@/, '');
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(name)) throw new Error('invalid bot username');
  if (!OWNED_CAMPAIGNS.has(campaign) && !PUBLIC.test(campaign)) {
    throw new Error('invalid acquisition campaign');
  }
  return `https://t.me/${name}?startapp=${campaign}`;
}

/** Analytics is best effort and never part of starting or playing a game. */
export async function attributeAcquisition({
  store,
  userId,
  attribution,
  at,
  log = console.log,
}: {
  store: AcquisitionStore;
  userId: string;
  attribution: Attribution;
  at: number;
  log?: (message: string) => void;
}): Promise<boolean> {
  const record: AcquisitionRecord = { ...attribution, startedAt: at };
  try {
    await store.record(userId, record);
    return true;
  } catch {
    try {
      log(`[acquisition] ${attribution.source} first touch could not be recorded.`);
    } catch {
      // A logger is less important than the optional metric it describes.
    }
    return false;
  }
}
