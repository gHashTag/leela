#!/usr/bin/env node
/**
 * Both pages of the game are ready to be shared, and say the same thing.
 *
 *     node scripts/audit-preview.mjs
 *
 * Written 2026-08-28. `shared-link.test.ts` had held `apps/miniapp/index.html`
 * to a standard for weeks — a description, five Open Graph tags, a canonical —
 * and nothing held `apps/webgl/index.html` to anything. That is the page
 * `https://t27.ai/leela/` serves, the page every button in the bot opens, and
 * the one people actually get sent. It had no `og:url` and no canonical, under
 * a comment claiming it carried "the same words the mini app's head carries".
 *
 * THE GUARD WAS ON THE COPY THAT CARRIED THE EXPLANATION. This repository has
 * paid for that shape twice already — one paragraph written out twice where
 * only the commented copy was ever checked, and four copies of one wait at
 * three different deadlines — so the rule is applied to both heads here, and
 * the tags that must not differ are compared to each other rather than each to
 * a constant somebody typed in.
 *
 * Neither page had a picture. Measured the same day against the five rivals in
 * `rivals.mjs`: four of four carry a favicon, three of four carry an
 * `og:image`, and `https://t27.ai/favicon.ico` was a 404 site-wide.
 *
 * Static, and it reads only files in this repository, so it runs anywhere and
 * needs nothing. `scripts/make-card.mjs --check` is the other half — this
 * asks whether the picture is there and the right size, that asks whether it
 * is still what the art would draw today.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { finish } from './lib/report.mjs';
import { blank } from './lib/source.mjs';
import {
  PUBLIC,
  PUBLISHED_AT,
  checkPicture,
  disagreementsBetween,
  missingFrom,
  previewOf,
} from './lib/preview.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

/**
 * The two pages, and where each is served from.
 *
 * The mini app is copied into the 3D board's artifact at `classic/`, which is
 * why one directory holds the files both of them name.
 */
const PAGES = [
  { name: 'apps/webgl/index.html', served: 'https://t27.ai/leela/' },
  { name: 'apps/miniapp/index.html', served: 'https://t27.ai/leela/classic/' },
];

const read = (path) => {
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
};

const problems = [];
const heads = [];

for (const page of PAGES) {
  const bytes = read(join(ROOT, page.name));
  if (bytes === null) {
    problems.push(`${page.name}: not on disk, and it is a page of the game`);
    continue;
  }

  // Blanked, because both heads explain themselves at length directly above
  // the tags they explain, and a comment naming `og:image` is not an
  // `og:image`. `shared-link.test.ts` reads the same file the same way.
  const html = blank(bytes.toString('utf8'), 'html');
  const preview = previewOf(html);
  heads.push({ page, preview });

  for (const tag of missingFrom(preview)) {
    problems.push(`${page.name}: no ${tag} — a link to ${page.served} is shared without it`);
  }
}

if (heads.length === PAGES.length) {
  const [one, other] = heads;

  for (const { tag, said, andSaid } of disagreementsBetween(one.preview, other.preview)) {
    problems.push(
      `${tag}: ${one.page.name} says ${said ?? 'nothing'}, ` +
        `${other.page.name} says ${andSaid ?? 'nothing'} — one game, one answer`,
    );
  }

  // The picture itself, once, because by here the two heads agree on which.
  const said = one.preview['og:image'];
  if (said !== null) {
    if (!said.startsWith(PUBLISHED_AT)) {
      problems.push(
        `og:image is ${said}, which is not under ${PUBLISHED_AT} — ` +
          'this check can only vouch for files it can see, and that is one it cannot',
      );
    } else {
      const file = said.slice(PUBLISHED_AT.length);
      problems.push(
        ...checkPicture(
          {
            said: `${PUBLIC}/${file}`,
            width: one.preview['og:image:width'],
            height: one.preview['og:image:height'],
          },
          read(join(ROOT, PUBLIC, file)),
        ),
      );
    }
  }

  // The icon has no declared size to check, but it still has to BE there: a
  // `rel="icon"` pointing at a 404 is worse than none, because the browser
  // stops falling back to anything.
  const icon = one.preview.icon;
  if (icon !== null && icon.startsWith(PUBLISHED_AT)) {
    const file = icon.slice(PUBLISHED_AT.length);
    if (read(join(ROOT, PUBLIC, file)) === null) {
      problems.push(`${PUBLIC}/${file}: named as the icon by both heads and not on disk`);
    }
  }
}

/*
 * `finish` rather than a hand-written ending, and not by preference.
 *
 * The first draft closed with `if (problems.length > 0) { … exit(1) }` and then
 * an unguarded `console.log` of the all-clear — the exact shape `report.mjs`
 * exists to stop, where the sentence a human reads is written over a variable
 * that need not know what else went wrong. `a-closing-sentence-nothing-governs`
 * caught it on the first full run and named it precisely: no top-level
 * condition is a claim of emptiness.
 */
process.exitCode = finish({
  allClear:
    'Both pages carry every tag a preview is built from, agree on each file and ' +
    'address they name, and the picture they name is on disk at the size they claim.',
  sections: [
    {
      failing: false,
      lines: [`\nRead ${PAGES.length} pages of the game for what a chat is given.`],
    },
    {
      failing: true,
      heading: `\n${problems.length} thing(s) wrong with what a shared link shows:\n`,
      lines: problems.map((one) => `  ${one}`),
      epilogue:
        '\nThe picture is drawn by `node scripts/make-card.mjs`, and both heads must\n' +
        'name it with the same string. A dead `og:image` is worse than none: a chat\n' +
        'shows a card with a broken picture in it, and caches that.',
    },
  ],
});
