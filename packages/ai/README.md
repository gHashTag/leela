
## The language the companion answers in

`LANGUAGE_NAMES` here holds the **English** names — the instruction is *Answer
in Russian*, and a model follows an English instruction more reliably.
Deliberately not `@leela/content`'s map of the same name, which holds the
endonyms (*Русский*, *日本語*, *العربية*): those are for a reader choosing a
language, not for an instruction.

It is typed `Record<Language, string>`, so a twenty-third language will not
compile. It was `Record<string, string>` behind a `?? 'English'` — a restated
list of the twenty-two with the one ending that reads as correct: a language
added to `@leela/content` would have been handed the traditional text in its own
script under an instruction to answer in English, and every test would have
passed. The two the suite had were `ru` and `ja`, written out by hand.

The fallback went with it. `resolveLanguage` answers `Language` and nothing
else, so by the time the map is indexed the key is always one of the twenty-two;
a `??` there could only ever have covered for the map being short.
