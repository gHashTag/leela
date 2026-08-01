
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

## Entering the game is not an arrival from anywhere

A player waiting to enter is parked on `WIN_LOKA` — the engine's own choice, and
the published app draws the piece there from the first screen. So the first
report of **every game** carried `previousPlan: 68`, and the prompt read it as a
square they had come from:

```
The player is on plan 6: Delusion (moha).
They walked here one square at a time.
They came from plan 68.
```

Two false things in two lines: a walk, about a player who had been off the board
entirely, and a descent from Cosmic Consciousness that never happened. The ninth
sighting of the 68 ambiguity, and the first inside a model's instructions.

Nothing moves off 68 — a player who stood there has won and is out of play — so
a `previousPlan` of 68 on any other square can only be the parking space. The
prompt says what did happen instead: *They have just entered the game; before
this they were not on the board.*

Found by playing a game and printing the prompt the model actually received. No
unit test could see it: they build a `PlanContext` by hand, with a previous plan
chosen to be interesting.
