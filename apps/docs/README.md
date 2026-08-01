# @leela/docs

The book: 72 plans and the rules, in 22 languages, plus the legal documents.

Served at **https://t27.ai/leela/docs/**, built into the same Pages artifact as
the mini app — one repository gets one Pages site, so the book lives in a
subdirectory of the game.

```bash
cd apps/docs && bun run build          # → dist
bun run src/build.ts ../miniapp/dist/docs   # what CI does
```

## Why not Docusaurus

The archived `leela-ai-site` was a Docusaurus build, and it carried its own
copy of the 72 plans in each language. That duplication is exactly what let 744
titles rot unnoticed across 15 languages until someone looked.

Here every page is generated from `@leela/content`, the same dataset the bot
and the mini app read. The book cannot drift from the game because there is
nothing to drift from.

`render.ts` is pure functions from content to strings, so a page can be
asserted without a filesystem — including that its tags balance, that it
declares its own language, and that every internal link resolves to a file that
was actually written.

## The legal documents

`legal/` is the one place here that holds text of its own: a privacy policy and
terms, rescued from the archived site. They are not game content, and losing
them would be expensive — a missing privacy policy is a store rejection, and
Telegram asks for one before a mini app can be listed.

Only English and Russian were ever written. Every other language is served the
English rather than an empty page — and **says so**. The page is filed under
`/de/legal/policy.html`, linked from the German contents and reachable exactly
where a German reader looks for it, but it declares `lang="en"`, and its
`canonical` points at the English original that twenty URLs are copies of.

It used to declare the folder's language. `/ar/legal/policy.html` announced
itself as Arabic over English text: laid out right to left, and read aloud by a
screen reader reaching for Arabic phonemes. Forty pages said the wrong thing and
four of them looked it.

## What a page says about itself

The `<head>` carried a charset, a viewport, a title and a stylesheet — nothing
else, on any of 1,784 pages. Now every page states:

- a **description** drawn from its own text (`summarise`), which is also its
  `og:description`. The bot posts these links into Telegram, and a Telegram
  preview is built from the Open Graph tags and nothing else.
- a **canonical** address, absolute, naming the language the *text* is in.
- **`hreflang` alternates** — and only where the page really exists in that
  language.

That last one is the point of the book. `pathFor` already answered *where does
this page live in language X*; the footer picker was built from it and the head
was given nothing. Both are built from it now, and they are deliberately told
different things: `pathFor` returns `null` for a chapter a language does not
carry and `''` for the contents, two facts that render as the same link. The
picker sends a person to the contents rather than to a 404, which is help. The
head stays quiet, because telling a crawler that the German contents is a
translation of the Arabic `online` chapter is false.

## Right to left

Arabic and Urdu get `dir="rtl"` and their text aligned, not merely reordered.
Both are in the dataset, so both are in the book — and the direction comes from
the language the words are in, not from the directory.
