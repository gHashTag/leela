/**
 * The better voice: Supertonic 3, run in the player's own browser.
 *
 * The defect this fixes is one machine's Russian. `speechSynthesis` reads an
 * English board with Samantha and sounds like a person; the only Russian voice
 * installed on the owner's machine is the old compact Milena, which reads a
 * reflection on the Bhagavad Gita like a parking meter. Leela is a goddess and
 * a guide, and the voice is most of what she is.
 *
 * **Emily, and why she is a constant.** Supertonic ships ten voice styles, and
 * the demo's own table names them: `'F5': 'Emily - A kind, gentle female voice;
 * soft-spoken, calm, and naturally soothing.'` That is the one the owner
 * auditioned and chose, so `VOICE_STYLE` is F5 for both languages rather than a
 * setting — a guide who is a different person in Russian than in English is not
 * a character.
 *
 * **The licence.** The weights are Supertone's, published on Hugging Face under
 * `license: openrail` — the BigScience Open RAIL-M License of August 18, 2022,
 * whose own preamble says it "took inspiration from open source permissive
 * licenses regarding the grant of IP rights" and adds "use-based restrictions"
 * listed in its Attachment A. Commercial use is permitted; the restrictions are
 * on uses, not on users. Two things follow for this file. Nothing here
 * redistributes a weight: the browser fetches them from Hugging Face directly,
 * so this repository ships four URLs and no model. And the companion is already
 * labelled as what it is, which is what Attachment A's disclosure clause about
 * machine-generated content asks for.
 *
 * **A provenance seam, stated rather than buried.** The four `.onnx` below are
 * *not* Supertone's own files. They are an int8 quantisation published by the
 * sherpa-onnx maintainer, and the reason to take them is arithmetic: Supertone's
 * fp32 build is 379.6 MB and this one is 91.2 MiB, and nobody is downloading
 * 380 MB to hear a sentence. Three things about that repository are worth
 * knowing before trusting it. It carries an MIT `LICENSE` naming Supertone Inc.,
 * which does not match the `openrail` the upstream weights are published under —
 * most plausibly the MIT file of Supertonic's *code* copied along with the
 * models; the safe reading, and the one taken here, is that the weights stay
 * OpenRAIL-M wherever they are fetched from. It is packaged for sherpa-onnx, not
 * for the web demo: it ships `unicode_indexer.bin` and `voice.bin` where the
 * browser pipeline wants `unicode_indexer.json` and `voice_styles/F5.json`, so
 * those two come from Supertone's own repository instead. And its `tts.json` is
 * 8,699 bytes where Supertone's is 8,253 — a difference nobody here has read, so
 * Supertone's is the one used, because the pipeline below is Supertone's.
 *
 * That mixture — a third party's quantised graphs driven by the first party's
 * processors — is the one thing in this feature that cannot be checked without
 * a browser. If the quantiser renamed an input or reshaped a graph, the first
 * synthesis throws, and a throw is survivable by construction: the sentence is
 * read by `speechSynthesis` and the player hears the voice they had yesterday.
 *
 * **Everything here is pure.** The tensors, the sessions and the audio are in
 * `supertonic.worker.ts`, which is the only file that touches onnxruntime. This
 * one holds what can be held without a browser: what the payload is, what the
 * text becomes before it reaches a model, and what is fetched versus what is
 * already on the shelf.
 */

import type { Language } from '@leela/content';

// --- who is speaking -----------------------------------------------------------

/**
 * Emily. From the demo's `VOICE_DESCRIPTIONS`, quoted in the header above.
 *
 * A constant rather than a preference, and a test reads it: the owner chose
 * this voice by listening, and a default that drifts to whatever is first in a
 * list would silently undo that choice.
 */
export const VOICE_STYLE = 'F5';

/** What F5 is called, for anything that has to say so to a person. */
export const VOICE_NAME = 'Emily';

/**
 * The languages Supertonic 3 declares, from its own model card.
 *
 * Both of the board's translated languages are in it, which is the whole point;
 * a board in one of the other twenty is offered nothing and reads aloud the way
 * it does today. The list is the model's, not the board's, so it is written as
 * plain strings rather than as `Language` — several of these are languages this
 * game does not speak, and several of the game's are not here.
 */
export const SUPERTONIC_LANGUAGES: readonly string[] = [
  'en', 'ko', 'ja', 'ar', 'bg', 'cs', 'da', 'de', 'el', 'es', 'et', 'fi', 'fr',
  'hi', 'hr', 'hu', 'id', 'it', 'lt', 'lv', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk',
  'sl', 'sv', 'tr', 'uk', 'vi',
];

/** Whether the better voice can speak this board at all. */
export const speaksNeurally = (language: Language): boolean =>
  SUPERTONIC_LANGUAGES.includes(language);

// --- what would be downloaded --------------------------------------------------

/**
 * Both repositories, pinned to a commit rather than to `main`.
 *
 * `resolve/main` is whatever was pushed last. These are ninety megabytes that
 * run in the player's browser, and a URL that can change under us is a URL that
 * can change into something else; a commit hash is the cheapest thing that
 * makes the bytes the same bytes tomorrow.
 */
const SUPERTONE =
  'https://huggingface.co/Supertone/supertonic-3/resolve/3cadd1ee6394adea1bd021217a0e650ede09a323';
const QUANTISED =
  'https://huggingface.co/csukuangfj2/sherpa-onnx-supertonic-tts-int8-2026-03-06/resolve/5dec5897b86e2b293790eedb5e1f561a3295651f';

/** One file the voice needs, and how big it is. */
export interface Weight {
  /** What the worker calls it. */
  readonly key: string;
  readonly url: string;
  /**
   * Measured with a HEAD against the pinned commit, not estimated. The number
   * is what makes an honest progress bar possible before a single byte has
   * arrived, and what lets the offer state its own price.
   */
  readonly bytes: number;
}

/**
 * The whole payload, in the order it is useful to have it.
 *
 * The three small files first: they are under a megabyte together, and a
 * failure among them is a failure worth learning about in the first second
 * rather than after ninety megabytes.
 */
export const WEIGHTS: readonly Weight[] = [
  { key: 'cfgs', url: `${SUPERTONE}/onnx/tts.json`, bytes: 8_253 },
  { key: 'indexer', url: `${SUPERTONE}/onnx/unicode_indexer.json`, bytes: 277_676 },
  { key: 'style', url: `${SUPERTONE}/voice_styles/${VOICE_STYLE}.json`, bytes: 291_479 },
  { key: 'duration', url: `${QUANTISED}/duration_predictor.int8.onnx`, bytes: 1_521_526 },
  { key: 'vocoder', url: `${QUANTISED}/vocoder.int8.onnx`, bytes: 25_977_132 },
  { key: 'encoder', url: `${QUANTISED}/text_encoder.int8.onnx`, bytes: 27_431_318 },
  { key: 'estimator', url: `${QUANTISED}/vector_estimator.int8.onnx`, bytes: 40_686_657 },
];

/** What the offer has to admit to. Summed, never typed twice. */
export const PAYLOAD_BYTES = WEIGHTS.reduce((all, weight) => all + weight.bytes, 0);

/**
 * Megabytes, to one place, for a sentence a person reads.
 *
 * Decimal rather than binary: a download is quoted in the units the browser's
 * own download shelf quotes, and 96 MB is the number the player will see there.
 */
export const megabytes = (bytes: number): number => Math.round(bytes / 100_000) / 10;

// --- what is already here ------------------------------------------------------

/**
 * How long the worker may take to stand up before the offer gives up.
 *
 * Building four onnxruntime sessions out of ninety megabytes is seconds on a
 * laptop and can be most of a minute on a cold phone. This is not a target; it
 * is what stops a worker that never answers from leaving the control saying
 * *fetching* until the tab is closed.
 */
export const LOAD_PATIENCE_MS = 60_000;

/** Somewhere downloaded weights survive a reload. Structural, so a test can be one. */
export interface Shelf {
  /** The bytes, or null when this file has not been kept. */
  got(url: string): Promise<ArrayBuffer | null>;
  /** Keep them. False when they could not be kept — which is not a failure. */
  keep(url: string, bytes: ArrayBuffer): Promise<boolean>;
}

/** The narrow slice of Cache Storage this uses. */
interface CacheLike {
  open(name: string): Promise<{
    match(url: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | undefined>;
    put(url: string, response: unknown): Promise<void>;
  }>;
}

/** Where the weights are kept. Versioned, so a changed payload is a changed shelf. */
export const SHELF_NAME = 'leela-voice-v1';

/**
 * Cache Storage as a `Shelf`, or null where the browser does not offer it.
 *
 * Cache Storage rather than OPFS for one reason: it stores `Response` objects,
 * which is exactly what a fetch produces, so nothing has to be copied through a
 * second representation on the way in or out. It is absent over `file://` and
 * in some private modes, and absent is answered with null — the voice then
 * works and re-downloads on the next visit, which is worse than caching and far
 * better than refusing.
 *
 * Every method swallows its own failure. A shelf is an optimisation, and an
 * optimisation that can throw is a way of turning a working feature off: a full
 * quota on `keep` returns false and the bytes are used anyway.
 */
/**
 * How long the shelf may take to answer before it is treated as empty.
 *
 * Ten seconds is far longer than reading ninety megabytes off disk, and short
 * enough that a stuck cache costs one download rather than the whole voice.
 */
export const SHELF_PATIENCE_MS = 10_000;

export const shelfOn = (caches: unknown, Res: typeof Response | undefined): Shelf | null => {
  if (typeof caches !== 'object' || caches === null) return null;
  const store = caches as Partial<CacheLike>;
  if (typeof store.open !== 'function' || typeof Res !== 'function') return null;
  const open = (): ReturnType<CacheLike['open']> => (store as CacheLike).open(SHELF_NAME);

  return {
    got: async (url) => {
      try {
        // Bounded, because a shelf read can simply never answer. Measured on
        // the deployed board 2026-08-22: with every file present, `match` did
        // not settle in seventy seconds and the arming behind it stalled at
        // nought percent, which took the board's voice away entirely. A shelf
        // that does not answer is a shelf that is empty as far as this is
        // concerned - the bytes are a download away, and a download that
        // happens is better than a wait that does not end.
        const found = await Promise.race([
          (async () => (await open()).match(url))(),
          new Promise<undefined>((settle) => setTimeout(() => settle(undefined), SHELF_PATIENCE_MS)),
        ]);
        return found ? await found.arrayBuffer() : null;
      } catch {
        return null;
      }
    },
    keep: async (url, bytes) => {
      try {
        await (await open()).put(url, new Res(bytes));
        return true;
      } catch {
        // Quota, a private mode, a partial write. The caller has the bytes in
        // hand either way; all this costs is the next visit.
        return false;
      }
    },
  };
};

/** How far along a download is, in the only units that can be honest before it ends. */
export interface Progress {
  readonly done: number;
  readonly total: number;
}

export interface Fetching {
  fetch: (url: string, init?: { signal?: AbortSignal }) => Promise<{
    ok: boolean;
    status: number;
    arrayBuffer(): Promise<ArrayBuffer>;
  }>;
  shelf?: Shelf | null;
  onProgress?: (progress: Progress) => void;
  signal?: AbortSignal;
}

/**
 * Every weight, from the shelf where possible and the network where not.
 *
 * The rules, and each of them was chosen for a failure it prevents:
 *
 *   - **The shelf is asked first, and its answer is never doubted.** A hit
 *     counts toward progress immediately, so a second visit runs the bar to
 *     the end in a few frames rather than looking stalled at zero.
 *   - **A failed `keep` is not a failed download.** The bytes are already in
 *     memory; a browser that would not store them has cost the player the next
 *     visit, not this one. Returning them anyway is why a full quota does not
 *     take the voice away.
 *   - **A failed fetch throws, and the caller falls back.** There is no partial
 *     voice: three of four graphs is not a quieter Emily, it is a crash later.
 *     One throw here, one fallback there, and the player keeps a voice.
 *
 * Sequential rather than parallel, and deliberately: the progress bar is the
 * only thing the player has to look at during a ninety-megabyte wait, and seven
 * parallel downloads make it jump in an order nobody can read. It also keeps a
 * failure early — the small files are first — instead of after four connections
 * have each spent a minute.
 */
export const fetchWeights = async (
  weights: readonly Weight[],
  { fetch, shelf, onProgress, signal }: Fetching,
): Promise<Record<string, ArrayBuffer>> => {
  const got: Record<string, ArrayBuffer> = {};
  const total = weights.reduce((all, weight) => all + weight.bytes, 0);
  let done = 0;

  for (const weight of weights) {
    const kept = shelf ? await shelf.got(weight.url) : null;
    if (kept) {
      got[weight.key] = kept;
    } else {
      const response = await fetch(weight.url, signal ? { signal } : {});
      if (!response.ok) {
        throw new Error(`${weight.key} answered ${response.status}`);
      }
      const bytes = await response.arrayBuffer();
      got[weight.key] = bytes;
      // Deliberately not awaited for its answer's sake — the answer is only
      // ever "it was kept" or "it was not", and neither changes what happens
      // next. Awaited at all so a slow write does not race the next fetch.
      if (shelf) await shelf.keep(weight.url, bytes);
    }

    done += weight.bytes;
    onProgress?.({ done, total });
  }

  return got;
};

// --- what the text becomes -----------------------------------------------------

/** Emoji, which the model has no phoneme for and would otherwise read as nothing. */
const EMOJI =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]+/gu;

/** Characters that are a different character to this model than they look. */
const PLAIN: ReadonlyArray<readonly [string, string]> = [
  ['–', '-'], ['‑', '-'], ['—', '-'], ['_', ' '],
  ['“', '"'], ['”', '"'], ['‘', "'"], ['’', "'"],
  ['´', "'"], ['`', "'"], ['[', ' '], [']', ' '], ['|', ' '],
  ['/', ' '], ['#', ' '], ['→', ' '], ['←', ' '],
];

/**
 * A sentence, as the model wants it.
 *
 * Ported from the demo's `preprocessText` rather than invented, including the
 * parts that look arbitrary — the language tag wrapped around the whole string
 * is how this model is told which of thirty-one languages it is reading, and a
 * sentence without it is read in whatever the weights lean toward.
 *
 * The trailing full stop matters more than it looks: `carve` in `voice.ts` cuts
 * at terminators and hands over what it cut, but its flood path cuts
 * unterminated text at 280 characters, and a fragment with no final punctuation
 * is spoken by this model as though it were still going.
 */
export const preprocessText = (text: string, language: string | null = null): string => {
  let said = text.normalize('NFKD').replace(EMOJI, '');

  for (const [from, to] of PLAIN) said = said.replaceAll(from, to);
  said = said.replace(/[♥☆♡©\\]/g, '');
  said = said.replaceAll('@', ' at ').replaceAll('e.g.,', 'for example,').replaceAll('i.e.,', 'that is,');
  said = said.replace(/ ([,.!?;:'])/g, '$1');

  while (said.includes('""')) said = said.replace(/""/g, '"');
  while (said.includes("''")) said = said.replace(/''/g, "'");

  said = said.replace(/\s+/g, ' ').trim();
  if (!/[.!?;:,'")\]}…。」』】〉》›»]$/.test(said)) {
    said += '.';
  }

  const tag = language && SUPERTONIC_LANGUAGES.includes(language) ? language : 'na';
  return `<${tag}>${said}</${tag}>`;
};

/** The text as the model's own indices, and which characters it had none for. */
export interface Indexed {
  readonly ids: readonly number[];
  readonly mask: readonly number[];
  readonly unsupported: readonly string[];
}

/**
 * One sentence, indexed.
 *
 * The indexer is a plain map from a code point to a slot. A character it does
 * not know becomes slot 0 and is reported: the demo refuses the whole sentence
 * in that case, and this does not — a single stray glyph in a reflection is not
 * a reason to lose the sentence, and slot 0 is the model's own answer to *say
 * nothing here*. The list travels back so the caller can decide, and the caller
 * decides to speak.
 */
export const indexText = (
  indexer: Readonly<Record<number, number>>,
  text: string,
  language: string | null,
): Indexed => {
  const said = preprocessText(text, language);
  const ids: number[] = [];
  const unsupported = new Set<string>();

  for (const character of said) {
    const at = character.codePointAt(0) ?? 0;
    const slot = indexer[at];
    if (slot === undefined || slot === null || slot === -1) {
      unsupported.add(character);
      ids.push(0);
    } else {
      ids.push(slot);
    }
  }

  return { ids, mask: ids.map(() => 1), unsupported: [...unsupported] };
};

// --- the shape of the latent ---------------------------------------------------

/** The three numbers the latent geometry is read out of the model's own config. */
export interface Cfgs {
  ae: { sample_rate: number; base_chunk_size: number };
  ttl: { chunk_compress_factor: number; latent_dim: number };
}

/** How many latent frames a wave of this many seconds occupies. */
export const latentShapeFor = (
  seconds: number,
  cfgs: Cfgs,
): { readonly length: number; readonly dim: number; readonly mask: readonly number[] } => {
  const chunk = cfgs.ae.base_chunk_size * cfgs.ttl.chunk_compress_factor;
  const samples = seconds * cfgs.ae.sample_rate;
  const length = Math.floor((samples + chunk - 1) / chunk);
  // The mask is the same arithmetic on the floored sample count, which is what
  // the demo does and is one frame shorter than `length` for some durations.
  const masked = Math.floor((Math.floor(samples) + chunk - 1) / chunk);
  const mask: number[] = [];
  for (let at = 0; at < length; at += 1) mask.push(at < masked ? 1 : 0);
  return { length, dim: cfgs.ttl.latent_dim * cfgs.ttl.chunk_compress_factor, mask };
};

/**
 * Gaussian noise, masked, which is where the denoiser starts.
 *
 * Box-Muller over `Math.random`, exactly as the demo does it. The randomness is
 * real and unseeded: the same sentence is not the same waveform twice, which is
 * a property of the model rather than a defect of this line.
 */
export const noisyLatent = (
  shape: { length: number; dim: number; mask: readonly number[] },
  random: () => number = Math.random,
): Float32Array => {
  const out = new Float32Array(shape.dim * shape.length);
  for (let d = 0; d < shape.dim; d += 1) {
    for (let t = 0; t < shape.length; t += 1) {
      const one = random();
      const two = random();
      const normal = Math.sqrt(-2 * Math.log(one || Number.MIN_VALUE)) * Math.cos(2 * Math.PI * two);
      out[d * shape.length + t] = normal * (shape.mask[t] ?? 0);
    }
  }
  return out;
};
