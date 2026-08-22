import { LANGUAGES, dominantScript, scriptOf, type Language } from '@leela/content';

/**
 * The language to answer a player in.
 *
 * The board has a language — chosen, stored, switched from the settings — and
 * that is the language it is *labelled* in. It is not necessarily the language
 * somebody is writing to the companion in, and until now the two were assumed
 * to be one: a player typed «Как играть?» on a phone set to English and was
 * answered in English, by a companion that had been told to reply in English.
 *
 * So the question is asked of the message rather than of the interface.
 * `dominantScript` is `@leela/content`'s and is not re-implemented here: it
 * counts characters per script and breaks a tie by name, because an answer that
 * depends on the order somebody typed keys in is an answer nobody chose.
 *
 * What a script cannot do is pick between languages that share one. Cyrillic is
 * Russian and Ukrainian; Latin is nine of the twenty-two. So the interface's own
 * language wins whenever it is written in the script that was heard — somebody
 * reading a Ukrainian board who writes Cyrillic means Ukrainian — and only when
 * it is not does this reach for another.
 */

/** The language a message is written in, or nothing when it cannot be told. */
export const heardIn = (text: string, reading: Language): Language | null => {
  const script = dominantScript(text);
  if (script === null) return null;

  // The board's own language, when it is written in what was heard. This is
  // what keeps a Ukrainian reader from being answered in Russian.
  if (scriptOf(reading) === script) return reading;

  // Otherwise the first language of that script, in the catalogue's own order,
  // which puts English first among the Latin ones.
  return LANGUAGES.find((language) => scriptOf(language) === script) ?? null;
};

/**
 * The language to answer in: what was written, or the board's own.
 *
 * A message with no letters in it at all — «?», an emoji, a number — is not a
 * language, and the board's is the honest fallback rather than a guess.
 */
export const answerIn = (text: string, reading: Language): Language =>
  heardIn(text, reading) ?? reading;
