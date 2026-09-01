import { lastSentenceEnd, type Language } from '@leela/content';

/**
 * The voice: speaking to the companion, and hearing it answer.
 *
 * Two halves, and they degrade apart. Recognition — the microphone — is
 * `SpeechRecognition`, which the platforms that ship it ship under a `webkit`
 * prefix as often as not; synthesis — the reading aloud — is `speechSynthesis`.
 * A browser may carry either without the other, so each half is detected on
 * its own and a missing one takes its control out of the page entirely.
 * Disabled-with-no-reason is the worst state a control can be in, and a
 * microphone that can never hear is exactly that.
 *
 * **iOS's WKWebView has neither, and that is not a defect to fix here.** The
 * page inside the phone app shows no mic and no speak toggle, which is this
 * file working as designed: the iOS app already has native voice input on its
 * own keyboard, and a second microphone drawn by the page would be the broken
 * copy of a thing the player already has.
 *
 * The injected globals are typed minimally, the way `telegram.ts` types its
 * host: the interfaces below are the members this file touches and nothing
 * more, validated rather than cast, because a page's globals are things other
 * software puts values into. Everything that can be pure is pure — the
 * language mapping, the sentence chunker, the transcript assembly — and the
 * two edges (`new SpeechRecognition()`, `speechSynthesis.speak`) are as thin
 * as they can be made, so the tests hold the rules without a browser.
 */

// --- the language a voice speaks ---------------------------------------------

/**
 * The board's language, as the speech engines want it said.
 *
 * `Language` is a bare primary subtag and both engines take a full BCP-47 tag:
 * recognition uses it to pick an acoustic model and synthesis to pick a voice,
 * and `'ru'` alone is answered differently by every engine. One region per
 * language, chosen for the largest body of speakers the engines actually
 * serve, and written as a total `Record` so a twenty-third language will not
 * compile without a tag — the same construction `SCRIPTS` in `@leela/content`
 * uses, for the same reason.
 */
const SPOKEN_AS: Record<Language, string> = {
  ar: 'ar-SA',
  bn: 'bn-BD',
  de: 'de-DE',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  hi: 'hi-IN',
  ja: 'ja-JP',
  jv: 'jv-ID',
  ko: 'ko-KR',
  mr: 'mr-IN',
  ms: 'ms-MY',
  pa: 'pa-IN',
  pt: 'pt-BR',
  ru: 'ru-RU',
  ta: 'ta-IN',
  te: 'te-IN',
  tr: 'tr-TR',
  uk: 'uk-UA',
  ur: 'ur-PK',
  vi: 'vi-VN',
  zh: 'zh-CN',
};

/**
 * The tag to hand the engines. English rather than a throw for a value the
 * types say cannot happen: this is read at the moment a microphone starts,
 * and a crash there loses the player's words to a bookkeeping mistake.
 */
export const recognitionLangFor = (language: Language): string =>
  SPOKEN_AS[language] ?? 'en-US';

// --- hearing: the microphone edge --------------------------------------------

/** One recognition result: alternatives, of which this reads the first. */
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly 0?: { readonly transcript?: string };
}

export interface RecognitionEvent {
  readonly results: ArrayLike<RecognitionResult>;
}

/**
 * A recognition session, as this page needs it. The real object carries a
 * dozen more members; typing them would be writing down promises about
 * software this repository does not build.
 */
export interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

/**
 * The microphone, if the platform has one.
 *
 * Validated rather than cast, exactly as `telegramOf` validates its host: the
 * name may hold anything another script parked there, and `new` on whatever
 * happens to be under it turns somebody else's value into this page's crash.
 * Absent, or any shape short of a constructor, is a page without a microphone
 * and the answer is null — which the caller turns into no mic button at all.
 */
export const hearing = (host: {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
}): (() => Recognition) | null => {
  const found = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  if (typeof found !== 'function') return null;
  const Make = found as unknown as new () => Recognition;
  return () => new Make();
};

/** What the engine has heard so far, and whether it has finished hearing. */
export interface Heard {
  readonly text: string;
  readonly final: boolean;
}

/**
 * One transcript out of the engine's result list.
 *
 * The list is cumulative — every event carries all results so far, each a list
 * of alternatives — and this reads the first alternative of each, joined.
 * Final only when every result is: a session is not over while any part of it
 * is still a guess, and an empty list has heard nothing final.
 */
export const transcriptOf = (results: ArrayLike<RecognitionResult>): Heard => {
  const parts: string[] = [];
  let final = results.length > 0;
  for (let at = 0; at < results.length; at += 1) {
    const result = results[at];
    if (!result) continue;
    parts.push(result[0]?.transcript ?? '');
    if (!result.isFinal) final = false;
  }
  return { text: parts.join(''), final };
};

export interface Listening {
  stop(): void;
}

/**
 * One press-to-talk session.
 *
 * Three callbacks, because the caller has three different things to do:
 * `interim` is the words arriving live — painted into the reply box so the
 * player watches their own sentence form — `final` is the one moment the
 * transcript is worth sending, and `ended` is the session being over for any
 * reason at all, which is when the button stops glowing.
 *
 * Two rules are enforced here rather than left to the caller. A final
 * transcript with nothing in it is never announced: no-speech and error end a
 * session through `ended` alone, quietly, leaving whatever is in the box in
 * the box. And `ended` fires exactly once — the engine reports an error *and*
 * an end for the same failure, and a caller told twice resets a session the
 * player may already have restarted.
 */
export const listen = (
  make: () => Recognition,
  lang: string,
  heard: {
    interim(text: string): void;
    final(text: string): void;
    ended(): void;
  },
): Listening => {
  const ear = make();
  // The board's language, read at start time — which is what makes switching
  // the board switch the microphone, since the switch reloads the page.
  ear.lang = lang;
  ear.interimResults = true;
  ear.continuous = false;
  ear.maxAlternatives = 1;

  let over = false;
  const rest = (): void => {
    if (over) return;
    over = true;
    heard.ended();
  };

  ear.onresult = (event) => {
    const said = transcriptOf(event.results);
    if (!said.final) {
      heard.interim(said.text);
      return;
    }
    const words = said.text.trim();
    if (words.length > 0) heard.final(words);
  };
  ear.onerror = rest;
  ear.onend = rest;
  ear.start();

  return { stop: () => ear.stop() };
};

// --- the sentence chunker ----------------------------------------------------

/**
 * How much unterminated text is held back before being spoken anyway.
 *
 * A model that never writes a terminator — a list, a run of headings, a
 * malformed answer — would otherwise be spoken as one utterance at flush,
 * after a silence the length of the whole answer. Rare enough that the cut
 * lands on a space when it can, and small enough that the silence before the
 * first sound stays in seconds.
 */
export const FLOOD_CHARS = 280;

export interface Carved {
  /** Complete sentences since `from`, in the order they finished. */
  readonly sentences: readonly string[];
  /** Where the next call should start reading. */
  readonly upTo: number;
}

/**
 * The sentences that have finished arriving, cut out of a growing text.
 *
 * Pure, and called with the *cumulative* streamed answer plus how far the
 * caller has already read — the stream's chunks land mid-sentence, mid-word
 * and mid-surrogate-pair, so nothing may be cut where a chunk happens to end.
 * `lastSentenceEnd` is the one list of terminators this repository keeps —
 * three surfaces got that list wrong by hand, twice missing the same two
 * scripts' marks, which is why it is not restated here.
 *
 * A run of terminators — `?!`, `...`, `！？` — is one sentence end, not
 * several: cutting inside the run would speak the tail of it as a sentence of
 * its own, and a voice saying "exclamation mark" is a voice nobody leaves on.
 */
export const carve = (text: string, from: number): Carved => {
  const sentences: string[] = [];
  let at = Math.max(0, from);

  const wholeEnd = lastSentenceEnd(text);
  if (wholeEnd >= at) {
    // Every terminator between `at` and the last one, collected backwards
    // because that is the direction `lastSentenceEnd` reads.
    const marks: number[] = [];
    for (let mark = wholeEnd; mark >= at; ) {
      marks.push(mark);
      if (mark === 0) break;
      mark = lastSentenceEnd(text, mark - 1);
    }
    marks.reverse();

    for (const [i, mark] of marks.entries()) {
      // Not the last of its run: the cut belongs after the whole run.
      if (marks[i + 1] === mark + 1) continue;
      const piece = text.slice(at, mark + 1).trim();
      if (piece.length > 0) sentences.push(piece);
      at = mark + 1;
    }
  }

  // The flood: text still unterminated after everything above. Cut at the last
  // whitespace inside the bound, and where a bound's worth of text has no
  // whitespace at all, cut at the bound — but never between the halves of a
  // surrogate pair, which would hand the engine two lone surrogates and speak
  // neither.
  while (text.length - at >= FLOOD_CHARS) {
    const window = text.slice(at, at + FLOOD_CHARS);
    const upToSpace = window.match(/^[\s\S]*\s/);
    let length = upToSpace ? upToSpace[0].length : FLOOD_CHARS;
    const edge = text.charCodeAt(at + length - 1);
    if (edge >= 0xd800 && edge <= 0xdbff) length -= 1;
    const piece = text.slice(at, at + length).trim();
    if (piece.length > 0) sentences.push(piece);
    at += Math.max(1, length);
  }

  return { sentences, upTo: at };
};

// --- the speaking queue ------------------------------------------------------

export interface Speaking {
  /** The streamed answer as it stands now — cumulative, not a delta. */
  feed(streamed: string): void;
  /** The answer is over; whatever is still unspoken is spoken. */
  flush(): void;
  /** The player is speaking, or asked for quiet. Nothing talks over them. */
  stop(): void;
}

/**
 * Sentence-by-sentence speech over a streamed answer.
 *
 * Fed the cumulative text on every repaint and speaking each sentence the
 * moment it completes, so the voice runs a sentence behind the screen rather
 * than an answer behind it. The chunker above holds the rules; this holds
 * only the bookmark — how far has been spoken — and the two verbs it was
 * given, so a test can hand it a recorder and a browser can hand it
 * `speechSynthesis`.
 *
 * A feed shorter than what is already held is a new answer, not a
 * retraction: the bookmark starts over. `flush` is idempotent — it is called
 * from every repaint that is not streaming, and most of those have nothing
 * pending.
 */
export const speakingQueue = (
  say: (sentence: string) => void,
  hush: () => void,
): Speaking => {
  let text = '';
  let spokenTo = 0;

  return {
    feed(streamed) {
      if (streamed.length < text.length) spokenTo = 0;
      text = streamed;
      const cut = carve(text, spokenTo);
      spokenTo = cut.upTo;
      for (const sentence of cut.sentences) say(sentence);
    },
    flush() {
      const rest = text.slice(spokenTo).trim();
      text = '';
      spokenTo = 0;
      if (rest.length > 0) say(rest);
    },
    stop() {
      text = '';
      spokenTo = 0;
      hush();
    },
  };
};

// --- speaking: the synthesis edge --------------------------------------------

/**
 * The voice to read in, from whatever the platform installed.
 *
 * Exact tag first — `ru-RU` when the board is Russian — then any voice of the
 * language at all, because a platform with only `en-GB` should still read an
 * English board rather than fall silent. Underscores are folded to hyphens
 * before comparing: Android reports `ru_RU` where the spec writes `ru-RU`,
 * and a comparison that does not know that finds no Russian voice on a phone
 * full of them. Null when the language is genuinely uninstalled, and the
 * utterance then carries only its `lang`, which lets the engine make its own
 * last attempt.
 */
export const voiceFor = <V extends { readonly lang: string }>(
  voices: readonly V[],
  language: Language,
): V | null => {
  const wanted = recognitionLangFor(language).toLowerCase();
  const [primary = ''] = wanted.split('-');
  const spoken = (voice: V): string => voice.lang.replace(/_/g, '-').toLowerCase();

  return (
    voices.find((voice) => spoken(voice) === wanted) ??
    voices.find((voice) => spoken(voice) === primary || spoken(voice).startsWith(`${primary}-`)) ??
    null
  );
};

export interface Mouth {
  say(sentence: string): void;
  hush(): void;
}

/** An utterance, as this file sets one up. */
interface SpokenUtterance {
  lang: string;
  voice: unknown;
}

/**
 * The synthesis half, if the platform has one.
 *
 * The same validation-not-cast as `hearing` above: `speechSynthesis` and the
 * utterance constructor both have to be present and the right shape, because
 * a page inside a WebView meets hosts that define one without the other.
 * Null is a page that does not offer to read aloud — the toggle is removed,
 * not disabled.
 *
 * The language is bound once, here, rather than passed per sentence: the
 * board's language is decided at startup and a reload is how it changes, so a
 * mouth that could be handed a different language per call would be carrying
 * an ability nothing uses and tests would have to hold.
 */
export const speaking = (
  host: { speechSynthesis?: unknown; SpeechSynthesisUtterance?: unknown },
  language: Language,
): Mouth | null => {
  const synth = host.speechSynthesis;
  const make = host.SpeechSynthesisUtterance;
  if (typeof synth !== 'object' || synth === null) return null;
  const held = synth as { speak?: unknown; cancel?: unknown; getVoices?: unknown };
  if (typeof held.speak !== 'function' || typeof held.cancel !== 'function') return null;
  if (typeof make !== 'function') return null;

  const box = synth as {
    speak(one: SpokenUtterance): void;
    cancel(): void;
    getVoices?(): ReadonlyArray<{ readonly lang: string }>;
  };
  const Utter = make as unknown as new (text: string) => SpokenUtterance;

  return {
    say(sentence) {
      const one = new Utter(sentence);
      one.lang = recognitionLangFor(language);
      // Asked per sentence rather than once: the voice list arrives
      // asynchronously on most platforms and is empty at startup, so a list
      // read early would pin every answer to no voice at all.
      const match = voiceFor(box.getVoices?.() ?? [], language);
      if (match) one.voice = match;
      box.speak(one);
    },
    hush: () => box.cancel(),
  };
};

// --- the kept choice ---------------------------------------------------------

/** Where the speak-replies choice is kept. */
export const SPEAK_KEY = 'leela.speak';

/** Storage, as this needs it. Structural, so a test can be one. */
export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * A kept yes-or-no, and whether it was kept.
 *
 * Two preferences live in this file now and they had been written out twice,
 * differing only in a key and a word — which is the shape a third copy grows
 * from. Storage throws on its own: Safari's private mode refuses `setItem`
 * outright, and a page that crashes on a toggle is worse than a page that
 * forgets one, so a refusal is caught here and reported as *not kept*.
 */
const chosen = (store: Store | null, key: string, yes: string): boolean => {
  try {
    return store?.getItem(key) === yes;
  } catch {
    return false;
  }
};

const remember = (store: Store | null, key: string, value: string): boolean => {
  try {
    store?.setItem(key, value);
    return store !== null;
  } catch {
    return false;
  }
};

/**
 * Whether replies are read aloud, as last chosen. Off until asked for: a page
 * that starts talking unbidden is a page that gets muted at the tab, and
 * anything unreadable in storage is the same silence.
 */
export const speakChosen = (store: Store | null): boolean => chosen(store, SPEAK_KEY, 'aloud');

/**
 * Keep the choice, and say whether it was kept — the same contract as
 * `remember` in `look.ts`, because a preference that did not survive the
 * reload is a control that did nothing.
 */
export const rememberSpeaking = (store: Store | null, aloud: boolean): boolean =>
  remember(store, SPEAK_KEY, aloud ? 'aloud' : 'silent');

/** Where the better-voice choice is kept. */
export const NEURAL_KEY = 'leela.voice.neural';

/**
 * Whether the player has asked for the better voice.
 *
 * The one thing this flag must never do is default to true. It is the gate in
 * front of a ninety-six megabyte download, and a page that starts one because
 * somebody opened a board is a page that costs a person on a phone plan real
 * money without asking. Off until asked for, and — because it is kept —
 * asked for exactly once.
 */
export const neuralChosen = (store: Store | null): boolean => chosen(store, NEURAL_KEY, 'better');

/** Keep the better-voice choice, and say whether it was kept. */
export const rememberNeural = (store: Store | null, better: boolean): boolean =>
  remember(store, NEURAL_KEY, better ? 'better' : 'plain');

// --- the better voice, and the plain one behind it -----------------------------

/**
 * Something that can play a sentence and be told to stop.
 *
 * Unlike `Mouth`, this one *finishes*: `play` resolves when the sentence has
 * actually been heard. That is the whole difference and it is the reason there
 * are two interfaces. `speechSynthesis` has an internal queue, so a `Mouth` can
 * take four sentences in four synchronous calls and speak them in order without
 * anybody waiting. A neural voice has no such queue — it has a worker that
 * answers whenever it answers — so something has to hold the order, and it can
 * only hold it if it can tell when a sentence is over.
 */
export interface Sounding {
  /** Resolves when it has been heard. Rejects when it could not be said. */
  play(sentence: string): Promise<void>;
  stop(): void;
}

/**
 * The better voice where it works, the platform's voice where it does not.
 *
 * A `Mouth`, so `speakingQueue` above is untouched: it goes on cutting the
 * stream into sentences and calling `say` once per sentence, and never learns
 * that anything changed.
 *
 * Three rules, and the third is the interesting one.
 *
 * **Sentences are spoken in the order they were written, and never over each
 * other.** Every `say` is appended to one promise chain, and the chain waits
 * for `play` to resolve — which is why `Sounding` resolves on *heard* rather
 * than on *sent*.
 *
 * **A failure is never silence.** Any rejection at all — the weights are not
 * downloaded, the worker threw, onnxruntime is not there, the sentence timed
 * out — hands that sentence to the platform's own voice. The player hears the
 * voice they had yesterday, which is the outcome this whole feature is an
 * improvement on rather than a replacement for.
 *
 * **A failure hands over the rest of the answer too, and then forgets.** Once
 * one sentence has fallen back, the remaining sentences of that answer go
 * straight to the plain mouth. Two reasons. Whatever broke is almost never
 * fixed by the next sentence, and re-trying it buys another wait before another
 * fallback. And a paragraph read half in Emily and half in Milena is worse than
 * a paragraph read in either — the voice changing mid-thought is a defect a
 * player hears, where one plain paragraph is merely yesterday. The flag clears
 * when the queue drains, so the next answer tries the better voice again and a
 * moment's trouble does not cost the rest of the session.
 */
export const preferring = (better: Sounding, plain: Mouth): Mouth => {
  let chain: Promise<void> = Promise.resolve();
  let waiting = 0;
  // Bumped by `hush`. A sentence queued before the hush and reached after it
  // belongs to an answer nobody is listening to any more.
  let run = 0;
  let fallen = false;

  return {
    say(sentence) {
      const mine = run;
      waiting += 1;
      chain = chain.then(async () => {
        try {
          if (mine !== run) return;
          if (fallen) {
            plain.say(sentence);
            return;
          }
          try {
            await better.play(sentence);
          } catch (why) {
            if (mine !== run) return;
            fallen = true;
            // Said out loud, once per answer: a voice that quietly becomes a
            // different voice is a bug nobody can report. The console is where
            // a player who noticed can tell us what it said, and where the next
            // session reads what actually happened rather than guessing.
            console.log(`[voice] the better voice stepped aside: ${String(why)}`);
            plain.say(sentence);
          }
        } finally {
          waiting = Math.max(0, waiting - 1);
          if (waiting === 0) fallen = false;
        }
      });
    },
    hush() {
      run += 1;
      waiting = 0;
      fallen = false;
      // Both, always. The player asked for quiet, and quiet from one of two
      // voices is the bug this line exists to not have.
      better.stop();
      plain.hush();
    },
  };
};

/**
 * How long one sentence may be waited for before the plain voice takes it.
 *
 * A neural sentence is tens of milliseconds of arithmetic once the model is
 * loaded, so this is not a latency budget — it is the answer to *the worker
 * stopped answering*, which would otherwise stall the chain above forever and
 * produce the one outcome that is not allowed. Twelve seconds is long enough
 * that a first sentence on a slow phone still arrives and short enough that
 * nobody sits through it twice.
 */
export const SAY_PATIENCE_MS = 12_000;

/** The worker, as this file talks to one. */
export interface VoiceWorker {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', heard: (event: { data: unknown }) => void): void;
  terminate(): void;
}

/** Somewhere to put samples. The speakers, or a recorder in a test. */
export interface Player {
  play(samples: Float32Array, rate: number): Promise<void>;
  stop(): void;
}

/** What the worker says back, in the two shapes this cares about. */
interface Answered {
  what?: unknown;
  id?: unknown;
  samples?: unknown;
  rate?: unknown;
  error?: unknown;
}

/**
 * The worker and the speakers, as one `Sounding`.
 *
 * One promise per sentence, kept by id, because the worker is free to answer
 * out of order and a single pending slot would deliver the wrong audio into the
 * wrong sentence — the same defect `asked.ts` describes about the phone app's
 * question ids, and the same fix.
 */
export const neuralSounding = ({
  worker,
  player,
  language,
  patience = SAY_PATIENCE_MS,
}: {
  worker: VoiceWorker;
  player: Player;
  language: string;
  patience?: number;
}): Sounding => {
  const pending = new Map<number, { ok: (heard: { samples: Float32Array; rate: number }) => void; no: (why: Error) => void }>();
  let last = 0;

  worker.addEventListener('message', (event) => {
    const said = (event.data ?? {}) as Answered;
    const id = typeof said.id === 'number' ? said.id : null;
    if (id === null) return;
    const held = pending.get(id);
    if (!held) return;
    pending.delete(id);

    if (said.what === 'said' && said.samples instanceof Float32Array && typeof said.rate === 'number') {
      held.ok({ samples: said.samples, rate: said.rate });
    } else {
      held.no(new Error(typeof said.error === 'string' ? said.error : 'the voice refused'));
    }
  });

  return {
    play: async (sentence) => {
      last += 1;
      const id = last;

      const heard = await new Promise<{ samples: Float32Array; rate: number }>((ok, no) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          no(new Error('the voice did not answer'));
        }, patience);

        pending.set(id, {
          ok: (said) => {
            clearTimeout(timer);
            ok(said);
          },
          no: (why) => {
            clearTimeout(timer);
            no(why);
          },
        });

        worker.postMessage({ what: 'say', id, text: sentence, language });
      });

      await player.play(heard.samples, heard.rate);
    },
    stop: () => {
      // Everything queued is abandoned rather than left hanging: `preferring`
      // drops a rejection from a hushed run, and a promise nobody settles would
      // stop its chain for good.
      for (const [, held] of pending) held.no(new Error('hushed'));
      pending.clear();
      player.stop();
    },
  };
};

/** The narrow slice of Web Audio this uses. */
export interface Sounds {
  /** `suspended` until a gesture wakes it; playing into it makes no sound. */
  readonly state: string;
  createBuffer(channels: number, length: number, rate: number): { getChannelData(at: number): Float32Array };
  createBufferSource(): {
    buffer: unknown;
    // `never[]` rather than `()`: a real `AudioBufferSourceNode.onended` is
    // declared as taking an `Event`, and a zero-argument type would refuse the
    // browser's own object while accepting the test's.
    onended: ((...args: never[]) => void) | null;
    connect(to: unknown): void;
    start(): void;
    stop(): void;
  };
  readonly destination: unknown;
}

/**
 * Samples, through the speakers.
 *
 * Web Audio rather than an `Audio` element with a blob URL: the samples are
 * already `Float32Array` and this is the path that does not encode them to WAV,
 * make a URL, decode them again and then leak the URL. `onended` is what
 * resolves the promise, which is what makes the queue above a queue.
 */
export const speakers = (context: Sounds): Player => {
  let playing: { stop(): void } | null = null;

  return {
    play: (samples, rate) =>
      new Promise<void>((done, fail) => {
        // A context the browser never woke plays nothing and reports nothing:
        // `onended` would not fire, this promise would not settle, and the
        // chain behind it would stop for the rest of the answer. Refusing is
        // what lets `preferring` hand the sentence to the plain voice, which
        // is the whole contract - never silence, only a different voice.
        if (context.state === 'suspended') {
          fail(new Error('the sound is asleep'));
          return;
        }
        const buffer = context.createBuffer(1, samples.length, rate);
        buffer.getChannelData(0).set(samples);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.onended = () => {
          if (playing === source) playing = null;
          done();
        };
        playing = source;
        source.start();
      }),
    stop: () => {
      const source = playing;
      playing = null;
      // `stop` on a source that already ended throws in some engines, and the
      // player asking for quiet must never be the thing that breaks the page.
      try {
        source?.stop();
      } catch {
        // Already finished; nothing to stop.
      }
    },
  };
};
