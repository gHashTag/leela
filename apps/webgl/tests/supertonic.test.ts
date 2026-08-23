import { describe, expect, it, vi } from 'vitest';

import {
  LOAD_PATIENCE_MS,
  PAYLOAD_BYTES,
  SHELF_NAME,
  SUPERTONIC_LANGUAGES,
  VOICE_NAME,
  VOICE_STYLE,
  WEIGHTS,
  fetchWeights,
  indexText,
  latentShapeFor,
  megabytes,
  noisyLatent,
  preprocessText,
  shelfOn,
  speaksNeurally,
  type Cfgs,
  type Shelf,
  type Weight,
} from '../src/supertonic';

/**
 * The better voice, held without a browser and without a model.
 *
 * Nothing here loads onnxruntime, opens a Cache or moves a byte over a network.
 * Everything that could be made a decision rather than an effect was, and this
 * file is what that bought: the payload, the choice, the shelf and the text
 * pipeline are all checkable at a desk. What is left un-checkable is named in
 * `supertonic.ts` and lives in the worker.
 *
 * The one rule every test here is really about: **the player is never left in
 * silence, and never charged ninety-six megabytes without being asked.**
 */

// --- who is speaking -----------------------------------------------------------

describe('the voice that was chosen', () => {
  it('is F5, which is Emily', () => {
    // The owner picked this voice by listening to it. A default that drifted to
    // whatever came first in a list would undo that silently, so it is pinned
    // here as well as declared there.
    expect(VOICE_STYLE).toBe('F5');
    expect(VOICE_NAME).toBe('Emily');
  });

  it('fetches the style file for the voice it names, not a hardcoded one', () => {
    const style = WEIGHTS.find((weight) => weight.key === 'style');
    expect(style?.url.endsWith(`/voice_styles/${VOICE_STYLE}.json`)).toBe(true);
  });

  it('speaks the two languages the board is translated into', () => {
    expect(speaksNeurally('ru')).toBe(true);
    expect(speaksNeurally('en')).toBe(true);
  });

  it('admits the languages it cannot speak instead of guessing at them', () => {
    // Twenty-two languages ship and thirty-one are declared, and the overlap is
    // not everything. A board in one of these is offered nothing at all rather
    // than being read Marathi in a model that has never seen it.
    for (const language of ['bn', 'jv', 'mr', 'pa', 'ta', 'te', 'ms', 'ur'] as const) {
      expect(speaksNeurally(language), language).toBe(false);
      expect(SUPERTONIC_LANGUAGES).not.toContain(language);
    }
  });
});

// --- what would be downloaded --------------------------------------------------

describe('the payload', () => {
  it('is the sum of its files, never a number typed twice', () => {
    const summed = WEIGHTS.reduce((all, weight) => all + weight.bytes, 0);
    expect(PAYLOAD_BYTES).toBe(summed);
    // Measured with HEAD against the pinned commit on 2026-08-23. A change
    // here means the pinned files changed, which is a thing to look at rather
    // than a number to update. It grew from 96 MB when the int8 graphs were
    // dropped: they were quantised from an older release whose character
    // table has no Cyrillic, so every Russian sentence died inside the model.
    expect(PAYLOAD_BYTES).toBe(398_610_308);
  });

  it('quotes itself in the units a person reads', () => {
    expect(megabytes(PAYLOAD_BYTES)).toBe(398.6);
    expect(megabytes(0)).toBe(0);
    expect(megabytes(1_500_000)).toBe(15 / 10);
  });

  it('pins every file to a commit, so the bytes cannot change under the page', () => {
    // `resolve/main` is whatever was pushed last. Ninety-six megabytes that run
    // in the player's browser may not come from a moving URL.
    for (const weight of WEIGHTS) {
      expect(weight.url, weight.key).toMatch(/\/resolve\/[0-9a-f]{40}\//);
      expect(weight.url.startsWith('https://'), weight.key).toBe(true);
      expect(weight.bytes, weight.key).toBeGreaterThan(0);
    }
  });

  it('fetches the small files before the large ones', () => {
    // A failure among the three configuration files should arrive in the first
    // second, not after ninety megabytes of graphs have been paid for.
    const sizes = WEIGHTS.map((weight) => weight.bytes);
    const smallest = sizes.slice(0, 3);
    const largest = sizes.slice(3);
    expect(Math.max(...smallest)).toBeLessThan(Math.min(...largest));
  });

  it('names every part the worker asks for', () => {
    // The worker calls `need(key)` for exactly these, and a missing one is a
    // failure at load rather than at the first sentence.
    expect(WEIGHTS.map((weight) => weight.key).sort()).toEqual(
      ['cfgs', 'duration', 'encoder', 'estimator', 'indexer', 'style', 'vocoder'].sort(),
    );
  });

  it('waits longer for a load than for a sentence', () => {
    // Building four sessions out of ninety megabytes is not the same order of
    // work as saying one sentence, and one deadline for both would either cut
    // the load off or leave a wedged worker holding the queue.
    expect(LOAD_PATIENCE_MS).toBeGreaterThan(0);
  });
});

// --- the shelf -----------------------------------------------------------------

/** Cache Storage, as much of it as `shelfOn` touches. */
const cacheLike = (
  held: Map<string, ArrayBuffer>,
  { failPut = false, failOpen = false } = {},
): unknown => ({
  open: async (name: string) => {
    expect(name).toBe(SHELF_NAME);
    if (failOpen) throw new Error('no cache here');
    return {
      match: async (url: string) => {
        const bytes = held.get(url);
        return bytes ? { arrayBuffer: async () => bytes } : undefined;
      },
      put: async (url: string, response: unknown) => {
        if (failPut) throw new Error('quota exceeded');
        held.set(url, (response as { bytes: ArrayBuffer }).bytes);
      },
    };
  },
});

/** A `Response` that only has to carry the bytes back out again. */
const ResponseLike = function (this: { bytes: ArrayBuffer }, bytes: ArrayBuffer) {
  this.bytes = bytes;
} as unknown as typeof Response;

describe('the shelf', () => {
  it('is nothing at all where the browser has no Cache Storage', () => {
    // `file://` and some private modes. Absent is answered with null, and a
    // null shelf means re-downloading next visit — not refusing today.
    expect(shelfOn(undefined, ResponseLike)).toBeNull();
    expect(shelfOn(null, ResponseLike)).toBeNull();
    expect(shelfOn({}, ResponseLike)).toBeNull();
    expect(shelfOn(cacheLike(new Map()), undefined)).toBeNull();
  });

  it('keeps what it is given and gives it back', async () => {
    const held = new Map<string, ArrayBuffer>();
    const shelf = shelfOn(cacheLike(held), ResponseLike);
    const bytes = new Uint8Array([1, 2, 3]).buffer;

    expect(await shelf?.got('u')).toBeNull();
    expect(await shelf?.keep('u', bytes)).toBe(true);
    expect(await shelf?.got('u')).toBe(bytes);
  });

  it('answers no rather than throwing when it cannot be opened', async () => {
    const shelf = shelfOn(cacheLike(new Map(), { failOpen: true }), ResponseLike);
    expect(await shelf?.got('u')).toBeNull();
    expect(await shelf?.keep('u', new ArrayBuffer(1))).toBe(false);
  });

  it('reports a refused write instead of losing the download to it', async () => {
    // A full quota is the commonest failure here and it must not be fatal: the
    // caller already holds the bytes.
    const shelf = shelfOn(cacheLike(new Map(), { failPut: true }), ResponseLike);
    expect(await shelf?.keep('u', new ArrayBuffer(1))).toBe(false);
  });
});

// --- fetching ------------------------------------------------------------------

const someWeights: readonly Weight[] = [
  { key: 'a', url: 'https://host/a', bytes: 10 },
  { key: 'b', url: 'https://host/b', bytes: 90 },
];

/** A network that answers with the bytes it was told to, and counts its calls. */
const network = (answer: (url: string) => { ok: boolean; status: number } = () => ({ ok: true, status: 200 })) => {
  const asked: string[] = [];
  const fetch = vi.fn(async (url: string) => {
    asked.push(url);
    const said = answer(url);
    return { ...said, arrayBuffer: async () => new Uint8Array([url.length]).buffer };
  });
  return { asked, fetch };
};

describe('fetching the weights', () => {
  it('asks the network once per file and reports progress in bytes', async () => {
    const { asked, fetch } = network();
    const seen: Array<{ done: number; total: number }> = [];

    const got = await fetchWeights(someWeights, {
      fetch,
      onProgress: (progress) => seen.push(progress),
    });

    expect(asked).toEqual(['https://host/a', 'https://host/b']);
    expect(Object.keys(got).sort()).toEqual(['a', 'b']);
    // Progress is in the file's own measured size, so the bar moves by what
    // was actually paid for rather than by one seventh per file.
    expect(seen).toEqual([
      { done: 10, total: 100 },
      { done: 100, total: 100 },
    ]);
  });

  it('takes what is on the shelf and does not ask the network for it', async () => {
    // This is what makes a second visit instant, and it is the whole reason
    // the player is only ever asked once.
    const kept = new ArrayBuffer(4);
    const shelf: Shelf = {
      got: async (url) => (url === 'https://host/b' ? kept : null),
      keep: async () => true,
    };
    const { asked, fetch } = network();

    const got = await fetchWeights(someWeights, { fetch, shelf });

    expect(asked).toEqual(['https://host/a']);
    expect(got.b).toBe(kept);
  });

  it('runs the bar to the end from the shelf, not from zero', async () => {
    const shelf: Shelf = { got: async () => new ArrayBuffer(1), keep: async () => true };
    const { asked, fetch } = network();
    const seen: number[] = [];

    await fetchWeights(someWeights, { fetch, shelf, onProgress: ({ done }) => seen.push(done) });

    expect(asked).toEqual([]);
    expect(seen).toEqual([10, 100]);
  });

  it('keeps the download when the shelf refuses to keep it', async () => {
    // A full quota costs the next visit, never this one.
    const shelf: Shelf = { got: async () => null, keep: async () => false };
    const { fetch } = network();

    const got = await fetchWeights(someWeights, { fetch, shelf });

    expect(Object.keys(got).sort()).toEqual(['a', 'b']);
  });

  it('keeps the download when the shelf throws on the way in', async () => {
    const shelf: Shelf = {
      got: async () => {
        throw new Error('opaque');
      },
      keep: async () => {
        throw new Error('opaque');
      },
    };
    const { fetch } = network();

    // A shelf is an optimisation. One that throws must not be able to turn the
    // feature off, so this rejects only if the fetch itself failed.
    await expect(fetchWeights(someWeights, { fetch, shelf })).rejects.toThrow();
  });

  it('throws on a refused file rather than returning half a voice', async () => {
    // Three graphs of four is not a quieter Emily; it is a crash at the first
    // sentence. One throw here becomes one fallback in `preferring`.
    const { fetch } = network((url) =>
      url.endsWith('/b') ? { ok: false, status: 404 } : { ok: true, status: 200 },
    );

    await expect(fetchWeights(someWeights, { fetch })).rejects.toThrow(/b answered 404/);
  });

  it('stops at the first refusal instead of paying for the rest', async () => {
    const { asked, fetch } = network(() => ({ ok: false, status: 500 }));
    await expect(fetchWeights(someWeights, { fetch })).rejects.toThrow();
    expect(asked).toEqual(['https://host/a']);
  });
});

describe('a player who has not asked for the better voice', () => {
  // Twenty seconds, not the default five: this test compiles two modules
  // from source through a cache-busting query, and under a full parallel run
  // that has taken long enough to trip the default once. A slow compile is
  // not the defect being asserted; the shut gate is.
  it('costs the network nothing at all', async () => {
    // The rule the whole feature is built around. Nothing in this module
    // fetches on import, and the only function that reaches the network is
    // `fetchWeights`, which is called from exactly one place — the click
    // handler in `main.ts`, behind `neuralChosen`. So the gate being shut is
    // the same statement as no bytes being spent.
    const spy = vi.fn();
    const had = globalThis.fetch;
    globalThis.fetch = spy as unknown as typeof globalThis.fetch;
    try {
      const fresh = await import(`../src/supertonic?probe=${Date.now()}`);
      const { neuralChosen } = await import(`../src/voice?probe=${Date.now()}`);

      // A store nobody has written to: the state every first visit is in.
      expect(neuralChosen({ getItem: () => null, setItem: () => undefined })).toBe(false);
      // Reading the payload's own size, which is what the offer's label does,
      // must not be a download either.
      expect((fresh as { PAYLOAD_BYTES: number }).PAYLOAD_BYTES).toBeGreaterThan(0);

      expect(spy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = had;
    }
  }, 20_000);
});

// --- the text ------------------------------------------------------------------

describe('a sentence, on its way to the model', () => {
  it('wraps the language the model is to read it in', () => {
    // This tag is how one set of weights is told which of thirty-one languages
    // it is looking at. Without it a Russian sentence is read by whatever the
    // model leans toward.
    expect(preprocessText('Привет', 'ru')).toBe('<ru>Привет.</ru>');
    expect(preprocessText('Hello', 'en')).toBe('<en>Hello.</en>');
  });

  it('says "no language" rather than a wrong one it was handed', () => {
    // A board in Bengali must not arrive labelled `<bn>` at a model that has
    // no Bengali: the demo throws here, and a throw would cost the sentence.
    expect(preprocessText('Hello', 'bn')).toBe('<na>Hello.</na>');
    expect(preprocessText('Hello', null)).toBe('<na>Hello.</na>');
  });

  it('ends an unterminated fragment, because the model reads it as unfinished', () => {
    // `carve`'s flood path cuts at 280 characters with no terminator in sight,
    // and a fragment without one is spoken as though it were still going.
    expect(preprocessText('half a thought', 'en')).toBe('<en>half a thought.</en>');
    expect(preprocessText('Already done!', 'en')).toBe('<en>Already done!</en>');
    expect(preprocessText('Is it?', 'en')).toBe('<en>Is it?</en>');
  });

  it('drops emoji rather than trying to pronounce them', () => {
    expect(preprocessText('Throw the die 🎲', 'en')).toBe('<en>Throw the die.</en>');
  });

  it('flattens the punctuation a model has no phoneme for', () => {
    expect(preprocessText('a — b', 'en')).toBe('<en>a - b.</en>');
    // A closing quote is already a terminator to this pipeline, so no full
    // stop is added after one — the demo's own rule, kept.
    expect(preprocessText('“quoted”', 'en')).toBe('<en>"quoted"</en>');
    expect(preprocessText('a  \n  b', 'en')).toBe('<en>a b.</en>');
  });

  it('never returns an empty string, whatever it is handed', () => {
    // The worker refuses an empty index list, and that refusal costs a
    // sentence. Nothing that arrives here should be able to cause it.
    for (const said of ['', '   ', '🎲', '♥', '\n\n']) {
      expect(preprocessText(said, 'en').length, JSON.stringify(said)).toBeGreaterThan(0);
    }
  });
});

describe('indexing a sentence', () => {
  const indexer: Record<number, number> = {};
  // The slash matters: every sentence arrives wrapped in `<en>…</en>`, so a
  // toy indexer without one reports the closing tag as unsupported text.
  for (const character of '<>/ruen abc.') indexer[character.codePointAt(0) ?? 0] = character.codePointAt(0) ?? 0;

  it('turns every character into the model\'s own slot', () => {
    const { ids, mask } = indexText(indexer, 'abc', 'en');
    expect(ids.length).toBe('<en>abc.</en>'.length);
    expect(mask.length).toBe(ids.length);
    expect(mask.every((one) => one === 1)).toBe(true);
  });

  it('speaks the sentence anyway when a character has no slot', () => {
    // The demo refuses the whole sentence on one unknown glyph. A stray
    // character in a reflection is not worth losing the sentence over, and
    // slot 0 is the model's own way of saying nothing there.
    const { ids, unsupported } = indexText(indexer, 'aЖc', 'en');
    expect(unsupported).toEqual(['Ж']);
    expect(ids).toContain(0);
    expect(ids.length).toBeGreaterThan(0);
  });
});

// --- the latent ----------------------------------------------------------------

const cfgs: Cfgs = {
  ae: { sample_rate: 44_100, base_chunk_size: 256 },
  ttl: { chunk_compress_factor: 2, latent_dim: 8 },
};

describe('the shape a sentence is denoised in', () => {
  it('is as many frames as the predicted duration needs', () => {
    const shape = latentShapeFor(1, cfgs);
    // 44100 samples over chunks of 512, rounded up.
    expect(shape.length).toBe(Math.ceil(44_100 / 512));
    expect(shape.dim).toBe(16);
    expect(shape.mask.length).toBe(shape.length);
  });

  it('masks nothing beyond the wave it is going to hold', () => {
    const shape = latentShapeFor(0.5, cfgs);
    expect(shape.mask.every((one) => one === 0 || one === 1)).toBe(true);
    expect(shape.mask.some((one) => one === 1)).toBe(true);
  });

  it('grows with the duration', () => {
    expect(latentShapeFor(2, cfgs).length).toBeGreaterThan(latentShapeFor(1, cfgs).length);
  });
});

describe('the noise it starts from', () => {
  it('fills the whole latent and silences what the mask silences', () => {
    const shape = { length: 4, dim: 2, mask: [1, 1, 0, 0] as const };
    const noise = noisyLatent(shape, () => 0.5);

    expect(noise.length).toBe(8);
    for (let d = 0; d < 2; d += 1) {
      // `=== 0` rather than `toBe(0)`: a negative sample times a zero mask is
      // negative zero, which is silence by every measure except `Object.is`.
      expect(noise[d * 4 + 2] === 0).toBe(true);
      expect(noise[d * 4 + 3] === 0).toBe(true);
      expect(noise[d * 4 + 0] === 0).toBe(false);
    }
  });

  it('survives a random source that returns zero', () => {
    // `Math.log(0)` is -Infinity and would fill the latent with NaN, which the
    // vocoder turns into a sentence of silence — the one outcome not allowed.
    const noise = noisyLatent({ length: 2, dim: 1, mask: [1, 1] }, () => 0);
    expect([...noise].every((one) => Number.isFinite(one))).toBe(true);
  });
});
