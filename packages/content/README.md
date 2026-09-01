
## The script a language is written in

`SCRIPTS` is typed `Record<Language, Script>`, so a twenty-third language will
not compile, and `scriptOf` throws rather than guessing for a tag nobody
declared. It was `Record<string, Script>` behind `?? 'latin'`, read by
`couldBe` and through it by `audit-dataset` — the check written because the
English book once shipped a Russian chapter as its seventh.

Measured rather than assumed: removing a language from that map under the old
code makes the audit **fail**, because a Cyrillic chapter declared latin is
exactly what it looks for. The silent half was narrower — a new language written
in a latin-family script would have been declared latin and right by luck, and
only a non-latin one was caught. The compiler names the omission now, at the
moment it is made.

`RANGES` beside it has been `Record<Script, RegExp>` since it was written. One
map in the file was total and the other was not.

**`couldBe` is not to be asked about a handful of characters.**
`dominantScript` counts them, so the Chinese title `出生 (janma)` is two Han
against five Latin and reads as latin. `audit-dataset` gives it two thousand
characters for that reason; a title with a transliteration in brackets is not a
verdict on the file it came from.
