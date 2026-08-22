import { describe, expect, it, vi } from 'vitest';
import { LANGUAGES, translatedLanguages, type Language } from '@leela/content';

import {
  FLOOD_CHARS,
  carve,
  hearing,
  listen,
  recognitionLangFor,
  rememberSpeaking,
  speakChosen,
  speaking,
  speakingQueue,
  transcriptOf,
  voiceFor,
  SPEAK_KEY,
  type Recognition,
  type RecognitionEvent,
} from '../src/voice';

/**
 * The voice, held without a browser.
 *
 * Everything here arrives from software this repository does not build — the
 * recognition constructor is whatever the platform parked under a global, the
 * results are whatever the engine heard, the stream is whatever the model
 * wrote — so the assertions feed foreign shapes and foreign timings: chunks
 * that stop mid-sentence, mid-word and mid-surrogate-pair, results that never
 * finish, globals that are not constructors at all.
 */

// --- the language a voice speaks ---------------------------------------------

describe('the recognition language', () => {
  it('has a full tag for every language the board ships, in that language', () => {
    // Exhaustive over the dataset's own list: a twenty-third language would
    // fail here the day it compiles, rather than being heard as English.
    for (const language of LANGUAGES) {
      const tag = recognitionLangFor(language);
      expect(tag, language).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
      expect(tag.startsWith(`${language}-`), `${language} → ${tag}`).toBe(true);
    }
  });

  it('covers the languages the interface actually speaks', () => {
    // `translatedLanguages` is the board's own source for what a player can
    // choose; both of its members are pinned to the tags the engines serve.
    for (const language of translatedLanguages()) {
      expect(LANGUAGES).toContain(language);
    }
    expect(recognitionLangFor('en')).toBe('en-US');
    expect(recognitionLangFor('ru')).toBe('ru-RU');
  });

  it('answers English to a language nobody declared, rather than throwing', () => {
    // Unreachable from TypeScript; reachable from a hand-edited record. This
    // is read at the moment a microphone starts, where a crash loses words.
    expect(recognitionLangFor('tlh' as Language)).toBe('en-US');
  });
});

// --- the sentence chunker ----------------------------------------------------

describe('the sentence chunker', () => {
  it('cuts a finished sentence and holds an unfinished one', () => {
    expect(carve('One. Tw', 0)).toEqual({ sentences: ['One.'], upTo: 4 });
    expect(carve('Half a sen', 0)).toEqual({ sentences: [], upTo: 0 });
  });

  it('reads on from where the last call stopped', () => {
    const grown = 'One. Two? Thr';
    expect(carve(grown, 4)).toEqual({ sentences: ['Two?'], upTo: 9 });
  });

  it('speaks each sentence once across a stream that cuts mid-sentence', () => {
    // The shape the model actually sends: chunks that stop anywhere at all.
    const stream = [
      'Первое предло',
      'Первое предложение. Вто',
      'Первое предложение. Второе! И хвост',
    ];
    const sentences: string[] = [];
    let from = 0;
    for (const text of stream) {
      const cut = carve(text, from);
      sentences.push(...cut.sentences);
      from = cut.upTo;
    }
    expect(sentences).toEqual(['Первое предложение.', 'Второе!']);
  });

  it('knows the terminators of every script the texts are written in', () => {
    // The two marks three surfaces forgot by hand — the danda and the Urdu
    // full stop — plus the ideographic one. The list itself is
    // `lastSentenceEnd`'s; this holds that the chunker went through it.
    expect(carve('सत्य बोलो। और', 0).sentences).toEqual(['सत्य बोलो।']);
    expect(carve('یہ سچ ہے۔ اور', 0).sentences).toEqual(['یہ سچ ہے۔']);
    expect(carve('答えです。まだ', 0).sentences).toEqual(['答えです。']);
  });

  it('treats a run of terminators as one sentence end', () => {
    // Cut inside `?!` and the tail is spoken as a sentence of its own.
    expect(carve('What?! Then', 0).sentences).toEqual(['What?!']);
    expect(carve('Так… а дальше', 0).sentences).toEqual(['Так…']);
  });

  it('bounds a terminator-free flood rather than hoarding it', () => {
    const flood = 'x'.repeat(FLOOD_CHARS * 2 + 10);
    const cut = carve(flood, 0);
    expect(cut.sentences).toHaveLength(2);
    for (const piece of cut.sentences) expect(piece.length).toBeLessThanOrEqual(FLOOD_CHARS);
    // The tail under the bound stays pending for the flush.
    expect(flood.length - cut.upTo).toBe(10);
  });

  it('cuts a flood at a space when there is one', () => {
    const words = 'word '.repeat(120).trim();
    const cut = carve(words, 0);
    expect(cut.sentences.length).toBeGreaterThan(0);
    for (const piece of cut.sentences) {
      expect(piece.length).toBeLessThanOrEqual(FLOOD_CHARS);
      // On a space, so no word is spoken as two halves.
      expect(piece.startsWith('word')).toBe(true);
      expect(piece.endsWith('word')).toBe(true);
    }
  });

  it('never cuts between the halves of a surrogate pair', () => {
    // One leading character shifts every pair across the bound, so a cut at
    // the bound itself would land mid-pair.
    const lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    const flood = `a${'💠'.repeat(FLOOD_CHARS)}`;
    const cut = carve(flood, 0);
    expect(cut.sentences.length).toBeGreaterThan(0);
    for (const piece of cut.sentences) expect(lone.test(piece), piece.length.toString()).toBe(false);
    expect(lone.test(flood.slice(cut.upTo))).toBe(false);
  });
});

// --- the speaking queue ------------------------------------------------------

describe('the speaking queue', () => {
  const recorder = () => {
    const said: string[] = [];
    let hushed = 0;
    const queue = speakingQueue(
      (sentence) => said.push(sentence),
      () => {
        hushed += 1;
      },
    );
    return { said, queue, hushed: () => hushed };
  };

  it('speaks sentences as they complete and the remainder at the flush', () => {
    const { said, queue } = recorder();
    queue.feed('The first. The seco');
    expect(said).toEqual(['The first.']);
    queue.feed('The first. The second! And the res');
    expect(said).toEqual(['The first.', 'The second!']);
    queue.flush();
    expect(said).toEqual(['The first.', 'The second!', 'And the res']);
  });

  it('flushes nothing when nothing is pending', () => {
    // `showThread` calls flush on every repaint that is not streaming, and
    // most of those have no answer in flight at all.
    const { said, queue } = recorder();
    queue.flush();
    queue.feed('Whole sentence.');
    queue.flush();
    queue.flush();
    expect(said).toEqual(['Whole sentence.']);
  });

  it('stops on demand and keeps quiet about what it dropped', () => {
    const { said, queue, hushed } = recorder();
    queue.feed('Almost said');
    queue.stop();
    expect(hushed()).toBe(1);
    queue.flush();
    expect(said).toEqual([]);
  });

  it('starts over for a new answer rather than reading the old bookmark', () => {
    // A feed shorter than what is held is a new stream, not a retraction.
    const { said, queue } = recorder();
    queue.feed('The whole first answer.');
    queue.flush();
    queue.feed('Hm');
    queue.feed('Hm. Right.');
    expect(said).toEqual(['The whole first answer.', 'Hm.', 'Right.']);
  });

  it('keeps every utterance under the flood bound', () => {
    const { said, queue } = recorder();
    queue.feed('y'.repeat(FLOOD_CHARS * 3));
    queue.flush();
    expect(said.length).toBeGreaterThan(1);
    for (const piece of said) expect(piece.length).toBeLessThanOrEqual(FLOOD_CHARS);
  });
});

// --- hearing: detection ------------------------------------------------------

describe('hearing', () => {
  it('answers null for every shape that is not a constructor', () => {
    // A page's globals are things other software puts values into, and `new`
    // on whatever is under the name is somebody else's value as this page's
    // crash. Ten shapes short of the real one, none of them a throw.
    const wrong = [
      {},
      { SpeechRecognition: undefined },
      { SpeechRecognition: null },
      { SpeechRecognition: 42 },
      { SpeechRecognition: 'SpeechRecognition' },
      { SpeechRecognition: {} },
      { SpeechRecognition: [] },
      { webkitSpeechRecognition: null },
      { webkitSpeechRecognition: { start: () => {} } },
      { SpeechRecognition: null, webkitSpeechRecognition: true },
    ];
    for (const host of wrong) {
      expect(() => hearing(host)).not.toThrow();
      expect(hearing(host), JSON.stringify(host)).toBeNull();
    }
  });

  it('wraps the constructor it finds, standard name first', () => {
    class Standard {}
    class Prefixed {}
    const standard = hearing({ SpeechRecognition: Standard, webkitSpeechRecognition: Prefixed });
    expect(standard?.()).toBeInstanceOf(Standard);
    // The prefix is how the platforms that ship it mostly ship it.
    const prefixed = hearing({ webkitSpeechRecognition: Prefixed });
    expect(prefixed?.()).toBeInstanceOf(Prefixed);
  });
});

// --- hearing: the session ----------------------------------------------------

/** The engine, as the tests drive it. */
class FakeEar implements Recognition {
  lang = '';
  interimResults = false;
  continuous = true;
  maxAlternatives = 0;
  started = 0;
  stopped = 0;
  onresult: ((event: RecognitionEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onend: (() => void) | null = null;
  start(): void {
    this.started += 1;
  }
  stop(): void {
    this.stopped += 1;
  }
}

/** An engine event: cumulative results, first alternative each. */
const saying = (parts: ReadonlyArray<readonly [text: string, final: boolean]>): RecognitionEvent => ({
  results: parts.map(([transcript, isFinal]) => ({ isFinal, 0: { transcript } })),
});

describe('a press-to-talk session', () => {
  const session = () => {
    const heard = { interim: vi.fn(), final: vi.fn(), ended: vi.fn() };
    let ear!: FakeEar;
    const held = listen(() => (ear = new FakeEar()), 'ru-RU', heard);
    return { heard, ear, held };
  };

  it('speaks the board language and asks for interim results, before starting', () => {
    const { ear } = session();
    expect(ear.lang).toBe('ru-RU');
    expect(ear.interimResults).toBe(true);
    expect(ear.continuous).toBe(false);
    expect(ear.started).toBe(1);
  });

  it('reports the words live and sends only the final transcript, once', () => {
    /*
     * The send spy is the one function `main.ts` binds to the compose form's
     * own `requestSubmit` — the exact path the Send button fires. Asserting a
     * single call across the whole session is asserting there is no second
     * wording of that path in here.
     */
    const { heard, ear } = session();
    ear.onresult?.(saying([['как ', false]]));
    ear.onresult?.(saying([['как ', false], ['играть', false]]));
    expect(heard.interim).toHaveBeenLastCalledWith('как играть');
    expect(heard.final).not.toHaveBeenCalled();

    ear.onresult?.(saying([['как играть ', true]]));
    ear.onend?.();
    expect(heard.final).toHaveBeenCalledTimes(1);
    expect(heard.final).toHaveBeenCalledWith('как играть');
    expect(heard.ended).toHaveBeenCalledTimes(1);
  });

  it('ends quietly on an error, leaving whatever was heard alone', () => {
    // No-speech and a denied microphone both land here: the session is simply
    // over, nothing is sent, and the box keeps what the interim wrote.
    const { heard, ear } = session();
    ear.onresult?.(saying([['half a th', false]]));
    ear.onerror?.();
    ear.onend?.();
    expect(heard.final).not.toHaveBeenCalled();
    // Once, though the engine says error *and* end for the same failure.
    expect(heard.ended).toHaveBeenCalledTimes(1);
  });

  it('does not send a final transcript with nothing in it', () => {
    const { heard, ear } = session();
    ear.onresult?.(saying([['   ', true]]));
    ear.onend?.();
    expect(heard.final).not.toHaveBeenCalled();
    expect(heard.ended).toHaveBeenCalledTimes(1);
  });

  it('stops the engine when asked to stop', () => {
    const { held, ear } = session();
    held.stop();
    expect(ear.stopped).toBe(1);
  });
});

describe('a transcript out of the result list', () => {
  it('joins the first alternative of every result', () => {
    expect(transcriptOf(saying([['one ', true], ['two', false]]).results)).toEqual({
      text: 'one two',
      final: false,
    });
  });

  it('is final only when every result is, and never on nothing at all', () => {
    expect(transcriptOf(saying([['done', true]]).results).final).toBe(true);
    expect(transcriptOf(saying([]).results).final).toBe(false);
  });

  it('reads a result with no alternative as empty rather than crashing', () => {
    expect(transcriptOf([{ isFinal: true }]).text).toBe('');
  });
});

// --- speaking: detection and the voice ---------------------------------------

describe('speaking', () => {
  it('answers null for every host short of a synthesis engine', () => {
    const wrong = [
      {},
      { speechSynthesis: null },
      { speechSynthesis: 'yes' },
      { speechSynthesis: {} },
      { speechSynthesis: { speak: () => {} } },
      { speechSynthesis: { speak: () => {}, cancel: () => {} } },
      { SpeechSynthesisUtterance: class {} },
      { speechSynthesis: { speak: 1, cancel: () => {} }, SpeechSynthesisUtterance: class {} },
    ];
    for (const host of wrong) {
      expect(speaking(host, 'en'), JSON.stringify(Object.keys(host))).toBeNull();
    }
  });

  it('speaks a sentence in the board language, on the matching voice', () => {
    const spoken: Array<{ text: string; lang: string; voice: unknown }> = [];
    let cancelled = 0;
    class Utterance {
      lang = '';
      voice: unknown = null;
      constructor(public text: string) {}
    }
    const host = {
      SpeechSynthesisUtterance: Utterance,
      speechSynthesis: {
        speak: (one: Utterance) => spoken.push(one),
        cancel: () => {
          cancelled += 1;
        },
        getVoices: () => [{ lang: 'en-US' }, { lang: 'ru-RU' }],
      },
    };
    const mouth = speaking(host, 'ru');
    mouth?.say('Как дела.');
    expect(spoken).toEqual([{ text: 'Как дела.', lang: 'ru-RU', voice: { lang: 'ru-RU' } }]);
    mouth?.hush();
    expect(cancelled).toBe(1);
  });

  it('still speaks where the platform lists no voices', () => {
    const spoken: Array<{ lang: string; voice: unknown }> = [];
    class Utterance {
      lang = '';
      voice: unknown = null;
      constructor(public text: string) {}
    }
    const mouth = speaking(
      {
        SpeechSynthesisUtterance: Utterance,
        // No `getVoices` at all — a host is allowed to be that bare.
        speechSynthesis: { speak: (one: Utterance) => spoken.push(one), cancel: () => {} },
      },
      'en',
    );
    mouth?.say('Hello.');
    expect(spoken).toEqual([{ text: 'Hello.', lang: 'en-US', voice: null }]);
  });
});

describe('the voice picked for a language', () => {
  it('takes the exact tag over a mere relative', () => {
    const voices = [{ lang: 'en-GB' }, { lang: 'en-US' }];
    expect(voiceFor(voices, 'en')).toEqual({ lang: 'en-US' });
  });

  it('takes any voice of the language when the region is missing', () => {
    expect(voiceFor([{ lang: 'de-DE' }, { lang: 'en-GB' }], 'en')).toEqual({ lang: 'en-GB' });
    expect(voiceFor([{ lang: 'en' }], 'en')).toEqual({ lang: 'en' });
  });

  it('reads the underscore spelling some platforms report', () => {
    expect(voiceFor([{ lang: 'ru_RU' }], 'ru')).toEqual({ lang: 'ru_RU' });
  });

  it('answers null when the language is genuinely uninstalled', () => {
    expect(voiceFor([{ lang: 'de-DE' }, { lang: 'fr-FR' }], 'ru')).toBeNull();
  });
});

// --- the kept choice ---------------------------------------------------------

describe('the speak-replies choice', () => {
  const memory = () => {
    const held = new Map<string, string>();
    return {
      getItem: (key: string) => held.get(key) ?? null,
      setItem: (key: string, value: string) => void held.set(key, value),
      held,
    };
  };

  it('survives the round trip, both ways', () => {
    const store = memory();
    expect(rememberSpeaking(store, true)).toBe(true);
    expect(speakChosen(store)).toBe(true);
    expect(rememberSpeaking(store, false)).toBe(true);
    expect(speakChosen(store)).toBe(false);
    // Under the one key, so the page and the tests cannot drift apart on it.
    expect([...store.held.keys()]).toEqual([SPEAK_KEY]);
  });

  it('is off until asked for, and off again on anything unreadable', () => {
    expect(speakChosen(memory())).toBe(false);
    const odd = memory();
    odd.setItem(SPEAK_KEY, 'yes please');
    expect(speakChosen(odd)).toBe(false);
  });

  it('tolerates a storage that refuses, and says the choice did not stick', () => {
    const refusing = {
      getItem: (): string | null => {
        throw new Error('denied');
      },
      setItem: (): void => {
        throw new Error('denied');
      },
    };
    expect(speakChosen(refusing)).toBe(false);
    expect(rememberSpeaking(refusing, true)).toBe(false);
    expect(speakChosen(null)).toBe(false);
    expect(rememberSpeaking(null, true)).toBe(false);
  });
});
