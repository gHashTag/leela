/**
 * What a chat is given when somebody sends a link to the game.
 *
 * There are two pages — the 3D board at `/leela/` and the classic board at
 * `/leela/classic/` — and one game. `shared-link.test.ts` has held the classic
 * page's head to a standard since it was written, and NOTHING HELD THE OTHER
 * ONE, which is the page `https://t27.ai/leela/` serves and the page every
 * button in the bot opens. Its head carried a comment saying it said "the same
 * words the mini app's head carries"; it did not, and had not for as long as
 * the two had existed side by side.
 *
 * That is this repository's oldest recurring defect wearing a new coat: one
 * rule, several copies, and the guard placed on the copy that carried the
 * explanation. So the rule lives here, the audit applies it to BOTH heads, and
 * the tags that must not differ are compared to each other rather than each to
 * a remembered constant.
 */

/**
 * Where the pictures live, and what they become once deployed.
 *
 * `apps/webgl/public/` is the artifact root — the 3D board is what
 * `https://t27.ai/leela/` serves and everything in that directory is published
 * beside it. The mini app is copied *into* that artifact at `classic/`, which
 * is why one directory holds the files both heads name, and why both heads can
 * name one address for one file. Two copies of an icon is how two heads drift.
 *
 * Here rather than in either caller, because `make-card.mjs` writes these files
 * and `audit-preview.mjs` checks them, and a path written down twice is a path
 * that will eventually be two paths.
 */
export const PUBLIC = 'apps/webgl/public';
export const PUBLISHED_AT = 'https://t27.ai/leela/';
export const CARD = `${PUBLIC}/og.png`;
export const ICON = `${PUBLIC}/icon.png`;

/** 1200×630 is what every scraper crops to; 180 is the apple-touch size. */
export const CARD_SIZE = Object.freeze({ width: 1200, height: 630 });
export const ICON_SIZE = 180;

/**
 * A `<meta>`'s content, however its attributes are wrapped or ordered.
 *
 * Two orders, because `<meta property="og:x" content="y">` and
 * `<meta content="y" property="og:x">` are the same tag to a scraper and one
 * regular expression that only knows the first would quietly report a page as
 * missing something it carries.
 */
export function contentOf(html, attribute, value) {
  const found = new RegExp(
    `<meta[^>]*\\b${attribute}="${value}"[^>]*\\bcontent="([^"]*)"` +
      `|<meta[^>]*\\bcontent="([^"]*)"[^>]*\\b${attribute}="${value}"`,
    's',
  ).exec(html);

  return found?.[1] ?? found?.[2] ?? null;
}

/** A `<link rel="...">`'s href, in either attribute order, for the same reason. */
export function hrefOf(html, rel) {
  const found = new RegExp(
    `<link[^>]*\\brel="${rel}"[^>]*\\bhref="([^"]*)"|<link[^>]*\\bhref="([^"]*)"[^>]*\\brel="${rel}"`,
    's',
  ).exec(html);

  return found?.[1] ?? found?.[2] ?? null;
}

/**
 * Everything a page has to say about itself, as one flat record.
 *
 * `null` for absent rather than a missing key: the checks below compare two
 * pages field by field, and "both are null" has to be a comparison that
 * happens rather than two lookups that both quietly find nothing.
 */
export function previewOf(html) {
  return {
    description: contentOf(html, 'name', 'description'),
    'og:site_name': contentOf(html, 'property', 'og:site_name'),
    'og:type': contentOf(html, 'property', 'og:type'),
    'og:title': contentOf(html, 'property', 'og:title'),
    'og:description': contentOf(html, 'property', 'og:description'),
    'og:url': contentOf(html, 'property', 'og:url'),
    'og:image': contentOf(html, 'property', 'og:image'),
    'og:image:width': contentOf(html, 'property', 'og:image:width'),
    'og:image:height': contentOf(html, 'property', 'og:image:height'),
    'og:image:alt': contentOf(html, 'property', 'og:image:alt'),
    'twitter:card': contentOf(html, 'name', 'twitter:card'),
    icon: hrefOf(html, 'icon'),
    'apple-touch-icon': hrefOf(html, 'apple-touch-icon'),
    canonical: hrefOf(html, 'canonical'),
  };
}

/**
 * What every page of the game must carry.
 *
 * `og:image` and the icons are the two the field was measured on: of the five
 * rivals `rivals.mjs` tracks, four of four carry a favicon and three of four
 * carry an image. The rest were already the classic page's standard and are
 * written down here so the other page is held to them too.
 */
export const REQUIRED = Object.freeze([
  'description',
  'og:site_name',
  'og:type',
  'og:title',
  'og:description',
  'og:url',
  'og:image',
  'og:image:width',
  'og:image:height',
  'og:image:alt',
  'twitter:card',
  'icon',
  'apple-touch-icon',
  'canonical',
]);

/**
 * The fields where the two pages must say exactly the same thing.
 *
 * NOT `og:title`, and not `og:description` either — one page is the board in
 * three dimensions and the other is the classic board, and a title that could
 * not differ would be a rule against ever telling them apart. What must not
 * differ is everything naming a FILE or a PLACE: two pages of one game that
 * point at two pictures, or at two addresses, is the drift this exists to
 * catch, and it is invisible until somebody shares the wrong one.
 */
export const MUST_AGREE = Object.freeze([
  'og:site_name',
  'og:type',
  'og:url',
  'og:image',
  'og:image:width',
  'og:image:height',
  'og:image:alt',
  'twitter:card',
  'icon',
  'apple-touch-icon',
  'canonical',
]);

/** Absent tags, named one by one rather than counted. */
export function missingFrom(preview) {
  return REQUIRED.filter((tag) => preview[tag] === null || preview[tag] === '');
}

/** Where two pages disagree about a file or a place. */
export function disagreementsBetween(one, other) {
  return MUST_AGREE.filter((tag) => one[tag] !== other[tag]).map((tag) => ({
    tag,
    said: one[tag],
    andSaid: other[tag],
  }));
}

/**
 * The size of a PNG, read out of its own header.
 *
 * Eight bytes of signature, then a length and `IHDR`, then two big-endian
 * 32-bit numbers. No decoder and no dependency: this runs in CI, and CI does
 * not have the ImageMagick that drew the file.
 *
 * Null for anything that is not a PNG — including an HTML error page saved
 * under a `.png` name, which is exactly what a broken deploy leaves behind and
 * is the reason this reads the bytes instead of trusting the extension.
 */
export function sizeOfPng(bytes) {
  const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  if (bytes === null || bytes.length < 24) return null;
  if (SIGNATURE.some((byte, at) => bytes[at] !== byte)) return null;
  if (bytes.toString('latin1', 12, 16) !== 'IHDR') return null;

  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/**
 * The size of a lossy WebP, read out of its VP8 frame header.
 *
 * The board's painting is a WebP, and `make-card.mjs` places the card's fade
 * by its width — so if it is ever repainted at another size the fade lands in
 * the wrong column and the card comes out with a hard edge down the middle.
 * That is what the first draft looked like, and it took a pixel sample to name.
 *
 * `RIFF`, four bytes of length, `WEBP`, `VP8 `, four more, then a three-byte
 * tag and the sync code `9d 01 2a`; the two dimensions follow as 14-bit
 * little-endian numbers with two bits of scale above them, which is why the
 * mask is 0x3fff. Null for anything else — including the lossless `VP8L` and
 * extended `VP8X` forms, which this does not claim to read.
 */
export function sizeOfWebp(bytes) {
  if (bytes === null || bytes.length < 30) return null;
  if (bytes.toString('latin1', 0, 4) !== 'RIFF') return null;
  if (bytes.toString('latin1', 8, 12) !== 'WEBP') return null;
  if (bytes.toString('latin1', 12, 16) !== 'VP8 ') return null;
  if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;

  return {
    width: bytes.readUInt16LE(26) & 0x3fff,
    height: bytes.readUInt16LE(28) & 0x3fff,
  };
}

/**
 * Whether the picture a head promises is really there, and really that size.
 *
 * A DEAD LINK IS WORSE THAN NO LINK. A head with no `og:image` gets a plain
 * text preview; a head naming an image that 404s gets a card with a broken
 * picture in it, and every scraper caches that. The declared width and height
 * are checked against the file rather than believed, because they are two
 * numbers kept by hand beside a thing that can be redrawn.
 */
export function checkPicture({ said, width, height }, bytes) {
  const problems = [];
  const size = sizeOfPng(bytes);

  if (bytes === null) {
    problems.push(`${said}: named by both heads and not on disk — a card would show a broken image`);
    return problems;
  }

  if (size === null) {
    problems.push(`${said}: on disk but not a PNG — the first bytes are not a PNG header`);
    return problems;
  }

  if (String(size.width) !== width || String(size.height) !== height) {
    problems.push(
      `${said}: the head says ${width}×${height}, the file is ${size.width}×${size.height}`,
    );
  }

  return problems;
}
