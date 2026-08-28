import { createHmac } from 'node:crypto';
import { describe as group, expect, it } from 'vitest';

import type { Report } from '@leela/journal';

import { askRoute } from '../src/serve';

/**
 * `specs/001-shared-reports` P1, without the file.
 *
 * *I play in the mini app on the train and in the bot with friends at the
 * weekend. What I wrote should be one path, wherever I wrote it.* The document
 * the mini app already saves has been the bridge since `take-in.ts`, and a
 * player had to carry it by hand. This route is that bridge with the carrying
 * removed, and the spec's own independent test is the first case below.
 *
 * The merge is NOT retested here. `decide` is the same function the file path
 * uses and it has its own suite; what is tested here is what this route adds —
 * whose path it writes to, what it refuses, and that sending twice is safe.
 */
const TOKEN = '123456:AAHfake-token-for-tests-only';
const NOW = Date.UTC(2026, 7, 28, 12, 0, 0);
const ORIGIN = 'https://t27.ai';

const signed = (fields: Record<string, string>, token = TOKEN): string => {
  const checked = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  return new URLSearchParams({
    ...fields,
    hash: createHmac('sha256', secret).update(checked).digest('hex'),
  }).toString();
};

const launchAs = (id: number, token = TOKEN) =>
  signed({ auth_date: String(Math.floor(NOW / 1000) - 60), user: JSON.stringify({ id }) }, token);

/**
 * A path in the format both surfaces already share.
 *
 * Written out as the JSON that actually travels rather than produced by
 * `toDocument`, so this test pins the WIRE shape: if the writer changes what a
 * saved path looks like, a route that reads one should be the thing that
 * notices. The format's own agreement between reader and writer is
 * `@leela/journal`'s suite, not this one.
 *
 * The first draft of this fixture was markdown, invented rather than read, and
 * every send came back 400 — the route was right and the test was wrong.
 */
const entry = (plan: number, at: string, text: string) => ({ plan, text, at: Date.parse(at) });

const PATH_DOCUMENT = JSON.stringify({
  schemaVersion: 1,
  app: 'leela',
  entries: [
    entry(8, '2026-08-20T09:00:00.000Z', 'Greed showed itself as impatience.'),
    entry(12, '2026-08-21T09:00:00.000Z', 'Delusion, and I did not see it until later.'),
  ],
});

/** A store that keeps what it is given, so a second send can be tested. */
const stored = () => {
  const kept: Report[] = [];
  return {
    kept,
    of: async () => kept,
    keep: async (_userId: string, added: readonly Report[]) => {
      kept.push(...added);
    },
  };
};

const send = (
  body: string,
  initData: string | null,
  options: Parameters<typeof askRoute>[0] = {},
  method = 'POST',
): Promise<Response> =>
  askRoute({ now: () => NOW, token: TOKEN, ...options })(
    new Request('https://leela.example/api/reports', {
      method,
      headers: {
        origin: ORIGIN,
        ...(initData === null ? {} : { authorization: `tma ${initData}` }),
      },
      ...(method === 'POST' ? { body } : {}),
    }),
  );

group('a path arriving from the other surface', () => {
  it('takes it, and says how much of it was new', async () => {
    const reports = stored();
    const answer = await send(PATH_DOCUMENT, launchAs(8675309), { reports });

    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ added: 2 });
    expect(reports.kept.map((one) => one.plan)).toEqual([8, 12]);
  });

  it('keeps the moment each report was WRITTEN, not the moment it arrived', async () => {
    // The defect `take-in.ts` records at length: stamping the import falsifies
    // the history AND makes the same document arrive as new every time.
    const reports = stored();
    await send(PATH_DOCUMENT, launchAs(1), { reports });

    expect(new Date(reports.kept[0]?.at ?? 0).toISOString()).toBe('2026-08-20T09:00:00.000Z');
    expect(reports.kept.every((one) => one.at < NOW)).toBe(true);
  });

  it('writes to the path of the player the signature names, and no other', async () => {
    const asked: string[] = [];
    const reports = { of: async () => [], keep: async (userId: string) => void asked.push(userId) };

    await send(PATH_DOCUMENT, launchAs(8675309), { reports });

    // There is nowhere else in this request the id could have come from, which
    // is the point: the body carries reports, never a claim about whose.
    expect(asked).toEqual(['8675309']);
  });
});

group('sending it twice', () => {
  it('changes nothing the second time, which is FR-002', async () => {
    const reports = stored();

    const first = await send(PATH_DOCUMENT, launchAs(1), { reports });
    const again = await send(PATH_DOCUMENT, launchAs(1), { reports });

    expect(await first.json()).toEqual({ added: 2 });
    // A success with a zero, not an error: a client that syncs on every launch
    // must not have to learn which failures are really successes.
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ added: 0 });
    expect(reports.kept).toHaveLength(2);
  });

  it('adds only what is new when a path has grown', async () => {
    const reports = stored();
    await send(PATH_DOCUMENT, launchAs(1), { reports });

    const longer = JSON.stringify({
      schemaVersion: 1,
      app: 'leela',
      entries: [
        entry(8, '2026-08-20T09:00:00.000Z', 'Greed showed itself as impatience.'),
        entry(12, '2026-08-21T09:00:00.000Z', 'Delusion, and I did not see it until later.'),
        entry(30, '2026-08-22T09:00:00.000Z', 'Something later.'),
      ],
    });
    const answer = await send(longer, launchAs(1), { reports });

    expect(await answer.json()).toEqual({ added: 1 });
    expect(reports.kept.map((one) => one.plan)).toEqual([8, 12, 30]);
  });
});

group('what it refuses, and what it never writes', () => {
  it('refuses a launch signed with somebody else’s token, and keeps nothing', async () => {
    const reports = stored();
    const answer = await send(PATH_DOCUMENT, launchAs(1, '999:not-ours'), { reports });

    expect(answer.status).toBe(401);
    expect(reports.kept).toEqual([]);
  });

  it('refuses a body that is not a path, without inventing an empty one', async () => {
    const reports = stored();
    const answer = await send('<html>a proxy error page</html>', launchAs(1), { reports });

    expect(answer.status).toBe(400);
    expect(await answer.json()).toEqual({ error: 'this is not a path this bot can read' });
    expect(reports.kept).toEqual([]);
  });

  it('refuses more than a path could be, in BYTES', async () => {
    // Characters would be a different limit in every language: a path in
    // Devanagari costs three bytes a character.
    const reports = stored();
    const huge = JSON.stringify({
      schemaVersion: 1,
      app: 'leela',
      entries: [entry(8, '2026-08-20T09:00:00.000Z', 'я'.repeat(600_000))],
    });
    const answer = await send(huge, launchAs(1), { reports });

    expect(answer.status).toBe(413);
    expect(reports.kept).toEqual([]);
  });

  it('says so when this deployment keeps nothing, rather than accepting silently', async () => {
    const answer = await send(PATH_DOCUMENT, launchAs(1));

    expect(answer.status).toBe(503);
    expect(await answer.json()).toEqual({ error: 'this deployment keeps no reports' });
  });

  it('tells the player when the store cannot be read, and writes nothing', async () => {
    let wrote = false;
    const answer = await send(PATH_DOCUMENT, launchAs(1), {
      reports: {
        of: async () => {
          throw new Error('the database is on fire');
        },
        keep: async () => void (wrote = true),
      },
    });

    // `of` throwing reads as "keeps nothing" rather than as a crash, and
    // nothing is written on top of a path this route could not see — appending
    // to a path you cannot read is how a duplicate gets made.
    const said = await answer.json();

    expect(answer.status).toBe(503);
    expect(said).toEqual({ error: 'this deployment keeps no reports' });
    expect(wrote).toBe(false);
    expect(JSON.stringify(said)).not.toContain('fire');
  });

  it('takes POST and nothing else', async () => {
    expect((await send('', launchAs(1), { reports: stored() }, 'GET')).status).toBe(405);
  });

  it('answers a preflight, and refuses an origin that is not ours', async () => {
    expect((await send('', null, { reports: stored() }, 'OPTIONS')).status).toBe(204);

    const elsewhere = await askRoute({ now: () => NOW, token: TOKEN, reports: stored() })(
      new Request('https://leela.example/api/reports', {
        method: 'POST',
        headers: { origin: 'https://somebody.else', authorization: `tma ${launchAs(1)}` },
        body: PATH_DOCUMENT,
      }),
    );

    expect(elsewhere.status).toBe(403);
  });
});
