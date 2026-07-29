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
English rather than an empty page.

## Right to left

Arabic and Urdu get `dir="rtl"` and their text aligned, not merely reordered.
Both are in the dataset, so both are in the book.
