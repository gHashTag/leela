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
 * Whether replies are read aloud, as last chosen. Off until asked for: a page
 * that starts talking unbidden is a page that gets muted at the tab, and
 * anything unreadable in storage is the same silence.
 */
export const speakChosen = (store: Store | null): boolean => {
  try {
    return store?.getItem(SPEAK_KEY) === 'aloud';
  } catch {
    return false;
  }
};

/**
 * Keep the choice, and say whether it was kept — the same contract as
 * `remember` in `look.ts`, because a preference that did not survive the
 * reload is a control that did nothing.
 */
export const rememberSpeaking = (store: Store | null, aloud: boolean): boolean => {
  try {
    store?.setItem(SPEAK_KEY, aloud ? 'aloud' : 'silent');
    return store !== null;
  } catch {
    return false;
  }
};
