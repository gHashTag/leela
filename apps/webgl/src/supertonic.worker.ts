/**
 * Supertonic, off the main thread.
 *
 * A worker rather than an inline call for one reason the player can feel: a
 * denoising pass and a vocoder pass over a sentence is tens of milliseconds of
 * arithmetic at best, and the board is a WebGL scene that is drawing while the
 * companion talks. Run on the main thread it is a dropped frame every sentence;
 * run here it is nothing at all, and the only thing that crosses back is a
 * `Float32Array` of samples, transferred rather than copied.
 *
 * **The pipeline is Supertone's, ported, not invented.** It is four sessions in
 * a fixed order — duration, encode, denoise, vocode — and the tensor names below
 * are theirs. Everything that could be moved out of here has been: the text
 * preprocessing, the latent geometry and the noise are in `supertonic.ts`, where
 * a test can reach them. What is left is the part that needs onnxruntime, and
 * this file is honest about being the part nobody in this repository can run
 * without a browser.
 *
 * **onnxruntime arrives from a CDN, not from the bundle.** `importScripts` on
 * jsDelivr's copy, pinned to the version Supertone's own demo pins. That keeps
 * a megabyte of runtime and ninety of weights out of a bundle that every
 * visitor downloads whether or not they ever ask for the better voice — which
 * is the entire premise of making this opt-in. A classic worker rather than a
 * module one so `importScripts` is available and no ESM re-export of a WASM
 * runtime has to be trusted.
 *
 * `numThreads = 1`, copied from the demo and for the reason the brief gives: a
 * `-pthread` build wants `SharedArrayBuffer`, which wants COOP and COEP headers
 * that a static host cannot always set, and on WKWebView it OOMs on reload. One
 * thread is slower and always works.
 */

import {
  indexText,
  latentShapeFor,
  noisyLatent,
  type Cfgs,
} from './supertonic';

/** Where onnxruntime and its `.wasm` companions come from. One version, twice. */
const ORT_VERSION = '1.23.0';
const ORT_DIST = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

/** How many denoising steps. Supertonic 3's demo uses one, and one is enough. */
const TOTAL_STEP = 1;

/** Speech speed. 1.0 is the model's own pace, which is the pace Emily was chosen at. */
const DURATION_FACTOR = 1.0;

/** What this worker is told. */
export type ToVoice =
  | { readonly what: 'load'; readonly weights: Record<string, ArrayBuffer> }
  | { readonly what: 'say'; readonly id: number; readonly text: string; readonly language: string };

/** What it answers. Every failure is a message, never a thrown worker. */
export type FromVoice =
  | { readonly what: 'ready' }
  | { readonly what: 'broken'; readonly error: string }
  | { readonly what: 'said'; readonly id: number; readonly samples: Float32Array; readonly rate: number }
  | { readonly what: 'refused'; readonly id: number; readonly error: string };

/** onnxruntime, as this file uses it. Typed structurally; the CDN ships no types. */
interface Tensor {
  readonly data: ArrayLike<number> & { slice(from: number, to: number): Float32Array };
}
interface Session {
  run(feeds: Record<string, unknown>): Promise<Record<string, Tensor>>;
}
interface Ort {
  env: { wasm: { wasmPaths: string; numThreads: number } };
  Tensor: new (type: string, data: unknown, dims: readonly number[]) => unknown;
  InferenceSession: { create(bytes: ArrayBuffer, options: unknown): Promise<Session> };
}

const scope = self as unknown as {
  importScripts(...urls: string[]): void;
  ort?: Ort;
  postMessage(message: FromVoice, transfer?: Transferable[]): void;
  onmessage: ((event: { data: ToVoice }) => void) | null;
};

const tell = (message: FromVoice, transfer?: Transferable[]): void =>
  scope.postMessage(message, transfer);

/** Everything loaded, once. Null until `load` has finished. */
let ready: {
  ort: Ort;
  cfgs: Cfgs;
  indexer: Record<number, number>;
  styleTtl: unknown;
  styleDp: unknown;
  duration: Session;
  encoder: Session;
  estimator: Session;
  vocoder: Session;
} | null = null;

const text = new TextDecoder();
const jsonOf = <T>(bytes: ArrayBuffer): T => JSON.parse(text.decode(bytes)) as T;

/** A style embedding as its JSON carries it: a type, flat data, and dims. */
interface Style {
  style_ttl: { type?: string; data: number[]; dims: number[] };
  style_dp: { type?: string; data: number[]; dims: number[] };
}

const load = async (weights: Record<string, ArrayBuffer>): Promise<void> => {
  scope.importScripts(`${ORT_DIST}ort.min.js`);
  const ort = scope.ort;
  if (!ort) throw new Error('onnxruntime did not load');

  ort.env.wasm.wasmPaths = ORT_DIST;
  ort.env.wasm.numThreads = 1;

  const need = (key: string): ArrayBuffer => {
    const bytes = weights[key];
    if (!bytes) throw new Error(`the voice is missing ${key}`);
    return bytes;
  };

  const cfgs = jsonOf<Cfgs>(need('cfgs'));
  const indexer = jsonOf<Record<number, number>>(need('indexer'));
  const style = jsonOf<Style>(need('style'));

  // WebGPU where the browser has it and WASM everywhere else, which is the
  // demo's own choice. WASM is the honest floor: it is what a Safari without
  // WebGPU falls to, and the voice has to be the same voice there.
  const backend = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };

  const [duration, encoder, estimator, vocoder] = await Promise.all([
    ort.InferenceSession.create(need('duration'), backend),
    ort.InferenceSession.create(need('encoder'), backend),
    ort.InferenceSession.create(need('estimator'), backend),
    ort.InferenceSession.create(need('vocoder'), backend),
  ]);

  const tensorOf = (one: Style['style_ttl']): unknown =>
    new ort.Tensor(one.type ?? 'float32', Float32Array.from(one.data.flat(Infinity)), one.dims);

  ready = {
    ort,
    cfgs,
    indexer,
    styleTtl: tensorOf(style.style_ttl),
    styleDp: tensorOf(style.style_dp),
    duration,
    encoder,
    estimator,
    vocoder,
  };
};

const say = async (sentence: string, language: string): Promise<{ samples: Float32Array; rate: number }> => {
  if (!ready) throw new Error('the voice has not loaded');
  const { ort, cfgs, indexer, styleTtl, styleDp } = ready;

  const { ids, mask } = indexText(indexer, sentence, language);
  if (ids.length === 0) throw new Error('nothing to say');

  const idsShape = [1, ids.length];
  const maskShape = [1, 1, mask.length];
  const textIds = new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), idsShape);
  const textMask = new ort.Tensor('float32', Float32Array.from(mask), maskShape);

  // 1. How long this sentence is, in seconds.
  const predicted = await ready.duration.run({
    text_ids: textIds,
    style_dp: styleDp,
    text_mask: textMask,
  });
  const seconds = Number(predicted.duration?.data[0] ?? 0) * DURATION_FACTOR;
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('the voice predicted no duration');

  // 2. The text, encoded.
  const encoded = await ready.encoder.run({
    text_ids: textIds,
    style_ttl: styleTtl,
    text_mask: textMask,
  });
  const textEmb = encoded.text_emb;

  // 3. Denoising, from masked Gaussian noise toward a latent for that duration.
  const shape = latentShapeFor(seconds, cfgs);
  const latent = noisyLatent(shape);
  const latentShape = [1, shape.dim, shape.length];
  const latentMask = new ort.Tensor('float32', Float32Array.from(shape.mask), [1, 1, shape.length]);
  const totalStep = new ort.Tensor('float32', Float32Array.from([TOTAL_STEP]), [1]);

  for (let step = 0; step < TOTAL_STEP; step += 1) {
    const denoised = await ready.estimator.run({
      noisy_latent: new ort.Tensor('float32', latent, latentShape),
      text_emb: textEmb,
      style_ttl: styleTtl,
      text_mask: textMask,
      latent_mask: latentMask,
      total_step: totalStep,
      current_step: new ort.Tensor('float32', Float32Array.from([step]), [1]),
    });
    const out = denoised.denoised_latent;
    if (!out) throw new Error('the denoiser answered with nothing');
    latent.set(out.data as unknown as ArrayLike<number>);
  }

  // 4. The waveform, cut to the duration that was predicted — the vocoder
  //    writes a whole padded latent's worth and the tail is silence and noise.
  const voiced = await ready.vocoder.run({
    latent: new ort.Tensor('float32', latent, latentShape),
  });
  const wave = voiced.wav_tts;
  if (!wave) throw new Error('the vocoder answered with nothing');

  const rate = cfgs.ae.sample_rate;
  const samples = wave.data.slice(0, Math.floor(rate * seconds));
  if (samples.length === 0) throw new Error('the voice produced no audio');
  return { samples, rate };
};

scope.onmessage = (event): void => {
  const message = event.data;

  if (message.what === 'load') {
    void load(message.weights).then(
      () => tell({ what: 'ready' }),
      (error: unknown) => tell({ what: 'broken', error: String(error) }),
    );
    return;
  }

  // A refusal names the sentence it refused. The page keeps one promise per id
  // and would otherwise have no way to release the right one.
  void say(message.text, message.language).then(
    ({ samples, rate }) => tell({ what: 'said', id: message.id, samples, rate }, [samples.buffer]),
    (error: unknown) => tell({ what: 'refused', id: message.id, error: String(error) }),
  );
};
