#!/usr/bin/env node
/**
 * The picture a chat shows when somebody sends a link to the game.
 *
 *     node scripts/make-card.mjs          # writes both, then says what changed
 *     node scripts/make-card.mjs --check  # writes nothing; exits 1 if stale
 *
 * Both pages carried the *words* of a link preview — a description, a title,
 * an `og:description` — and nothing to show. Measured 2026-08-28 against the
 * five rivals `scripts/rivals.mjs` tracks: four of four carry a favicon and
 * three of four carry an `og:image`. Leela carried neither, on either page,
 * and `https://t27.ai/favicon.ico` was a 404 site-wide. In Telegram — where
 * two of those rivals do all their reaching, and where every button in our own
 * bot points — a link with no image renders as a line of grey text instead of
 * a card.
 *
 * WHY A SCRIPT AND NOT TWO COMMITTED BLOBS WITH A COMMENT ABOVE THEM. The art
 * is `apps/miniapp/src/board-dark.webp`, which is a file in this repository
 * that somebody may one day repaint. A card built by hand from it is a copy
 * that cannot be told to update, and this repository has been bitten twice by
 * exactly that shape: four copies of one wait at three different deadlines,
 * and one paragraph written out twice where only the copy carrying the comment
 * was ever checked. `--check` is what makes the copy answerable — it rebuilds
 * into a temporary directory and compares, so a repaint that leaves the card
 * behind is a red gate rather than a thing nobody notices for six months.
 *
 * The output IS committed, and must be: ImageMagick is not a dependency of
 * this repository and CI does not have it. This script is how the committed
 * files are derived, not a build step anybody depends on.
 *
 * Everything on the card comes from the game: the painting is the board's own
 * dark art, the sentence is the one `apps/docs/src/render.ts` writes on all
 * 1,784 pages of the book, and the colours are `apps/webgl/src/style.css`'s
 * own tokens. Nothing here invents a second description of one game.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CARD, CARD_SIZE, ICON, ICON_SIZE, PUBLIC } from './lib/preview.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const checking = process.argv.includes('--check');

/**
 * The board's own tokens, copied deliberately rather than parsed.
 *
 * Five hex strings read out of a stylesheet by regular expression is a parser
 * that fails silently the day somebody writes them as `rgb()`. These are the
 * values in `apps/webgl/src/style.css`, and `preview.test.ts` holds them in
 * step with it — a test that fails loudly beats a parser that shrugs.
 */
const TEXT = '#ffffff';
const HINT = '#888888';
const GOLDEN = '#ffd700';

/**
 * The ground, which is the PAINTING'S and not the stylesheet's.
 *
 * `--bg` is `#000000` and the first draft used it, which drew a visible
 * rectangle down the middle of the card: `board-dark.webp` was exported on a
 * flat `srgb(28,28,28)`, so the art and the canvas were two different blacks
 * meeting at a straight line. Measured with `-format '%[pixel:p{5,5}]'` rather
 * than guessed — the seam was easy to see and impossible to name until then.
 *
 * Knocking the flat ground out to transparent would have let the true black
 * through, and would also have eaten the figure: her robe is nearly the same
 * value. So the card takes the painting's ground instead, and is one colour
 * from edge to edge.
 */
const INK = '#1c1c1c';

/** The book's sentence about the game, split as the card sets it. */
const SAYS = ['The game of', 'self-knowledge'];
const AND = '72 plans, in 22 languages';

const art = join(ROOT, 'apps/miniapp/src/board-dark.webp');

/**
 * The painting's size, which happens to be the card's height exactly.
 *
 * 714×630 against a 1200×630 card means it sits at native size with nothing
 * scaled and nothing to blur. `preview.test.ts` reads the file and fails if it
 * is ever repainted at another size, because these numbers would then place
 * the fade in the wrong column and nobody would be told.
 */
const ART = { width: 714, height: 630 };

/**
 * The same art must come out as the same bytes, or `--check` is a liar.
 *
 * MEASURED, AND IT CAUGHT ME: the first `--check` reported the icon it had
 * just written as stale — 71837 bytes committed, 71837 bytes drawn, not equal.
 * ImageMagick writes a `tIME` chunk and a pair of `date:` properties into every
 * PNG, so two runs a second apart differ in a handful of bytes and a check
 * comparing them goes red for ever. A guard that cries wolf on correct input
 * is worse than no guard: it is a guard somebody switches off.
 *
 * `-strip` drops the properties, the exclusion drops the chunk, and two runs
 * are then byte-identical — verified by running it twice and comparing, not by
 * reading the documentation.
 */
const REPEATABLE = ['-strip', '-define', 'png:exclude-chunks=date,time'];

/**
 * The card: the painting on the left, the game's own sentence on the right.
 *
 * The painting is 714×630 — exactly the card's height — so it sits at native
 * size against the left edge with nothing scaled and nothing to blur, on the
 * shared ground `INK` explains above.
 */
function cardArgs(out) {
  return [
    '-size', `${CARD_SIZE.width}x${CARD_SIZE.height}`, `xc:${INK}`,
    // The painting, its right 200 pixels fading out so the type sits on clean
    // ground rather than on a snake's tail.
    //
    // The fade is an ALPHA MASK, not a black gradient laid on top. The first
    // draft did the latter — `gradient:none-#000000` composited over the art —
    // and it left a grey haze with two hard edges, because ImageMagick ramps
    // the colour as well as the alpha and `none` is not the same as
    // transparent black. Copying opacity from a white-to-black mask ramps only
    // what should be ramped.
    '(', art,
    '(', '-size', `${ART.width}x${ART.height}`, 'xc:white',
    '-size', '200x630', 'gradient:white-black', '-geometry', `+${ART.width - 200}+0`, '-composite', ')',
    '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', ')',
    '-geometry', '+0+0', '-compose', 'Over', '-composite',
    '-font', 'Avenir-Heavy', '-fill', TEXT, '-pointsize', '96',
    '-annotate', '+790+300', 'Leela',
    '-fill', GOLDEN, '-draw', 'rectangle 792,336 900,339',
    '-font', 'Avenir-Book', '-fill', TEXT, '-pointsize', '30',
    '-annotate', '+790+400', SAYS[0],
    '-annotate', '+790+440', SAYS[1],
    '-font', 'Avenir-Book', '-fill', HINT, '-pointsize', '24',
    '-annotate', '+790+500', AND,
    ...REPEATABLE,
    out,
  ];
}

/**
 * The tab icon: the gem — the piece a player moves around the board.
 *
 * THE FIRST VERSION WAS A CROP OF THE PAINTING and this comment said it "reads
 * as a mark rather than as a fragment". It does not. Rendered and looked at,
 * 470 pixels of snakes reduced to 180 is a brown smudge, and a favicon is seen
 * at 16 or 32 — a size at which the smudge is just noise beside the other tabs.
 * A claim about what an image looks like is settled by looking at it.
 *
 * The gem is the opposite kind of picture: one object, one colour, cut out on
 * transparency at 96×97 already. Scarlet on the app's dark ground survives
 * being shrunk to a sixteenth of an inch, which is the only thing this file
 * has to do. It is also the game's own token rather than a detail borrowed
 * from a bigger picture.
 *
 * Upscaled 96 → 132 inside a 180 square. That is a small enlargement of a
 * smooth, round object with no text in it, which is the case where upscaling
 * does not show; the alternative was an icon with a wide empty border.
 */
function iconArgs(out) {
  return [
    '-size', `${ICON_SIZE}x${ICON_SIZE}`, `xc:${INK}`,
    '(', join(ROOT, 'apps/miniapp/src/gem.webp'), '-resize', '132x132', ')',
    '-gravity', 'center', '-compose', 'Over', '-composite',
    ...REPEATABLE,
    out,
  ];
}

function magick(args) {
  try {
    execFileSync('magick', args, { stdio: 'pipe' });
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error('ImageMagick is not on this machine, and it is what draws these.');
      console.error('The two files are committed, so nothing is blocked: install it');
      console.error('only to change them. `brew install imagemagick`.');
      process.exit(2);
    }
    throw err;
  }
}

const bytes = (path) => {
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
};

const where = mkdtempSync(join(tmpdir(), 'leela-card-'));
try {
  const problems = [];

  for (const [name, build] of [[CARD, cardArgs], [ICON, iconArgs]]) {
    const fresh = join(where, name.split('/').pop());
    magick(build(fresh));

    const drawn = readFileSync(fresh);
    const committed = bytes(join(ROOT, name));

    if (checking) {
      if (committed === null) problems.push(`${name}: not committed, and it is what a share shows`);
      else if (!committed.equals(drawn)) {
        problems.push(
          `${name}: the committed file is not what this script draws today ` +
            `(${committed.length} b committed, ${drawn.length} b drawn) — ` +
            'run `node scripts/make-card.mjs`',
        );
      }
      continue;
    }

    const changed = committed === null || !committed.equals(drawn);
    execFileSync('cp', [fresh, join(ROOT, name)]);
    console.log(
      `${changed ? 'wrote  ' : 'same   '}${name}  ${statSync(join(ROOT, name)).size} b`,
    );
  }

  if (problems.length > 0) {
    console.error('The link preview is stale:');
    for (const one of problems) console.error(`  ${one}`);
    process.exit(1);
  }

  console.log(checking ? 'Both are what this script draws.' : 'Both drawn.');
} finally {
  rmSync(where, { recursive: true, force: true });
}
