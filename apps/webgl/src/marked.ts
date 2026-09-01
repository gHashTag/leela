/**
 * The little of Markdown a model actually writes, read as structure.
 *
 * The reasoning arrives with asterisks in it — `*   **Katha Upanishad:** The
 * senses turn outward` — and the screen printed them, so a player watching the
 * companion think read punctuation where emphasis was meant and a star where a
 * bullet was.
 *
 * Structure rather than HTML, and deliberately so. This is text a model wrote;
 * handing it to `innerHTML` is handing a stranger the page. The caller builds
 * nodes from what this returns, and the worst a malformed line can do is come
 * out as itself.
 *
 * Only three shapes, because only three are ever written: a bullet, a numbered
 * step, and a paragraph — each with `**strong**` and `*emphasis*` inside it. A
 * heading or a table has never appeared in a reasoning stream, and a parser for
 * what has not been seen is a parser nobody has tested.
 */

/** A run of text, and whether it was marked. */
export interface Run {
  readonly text: string;
  readonly strong?: true;
  readonly emphasis?: true;
}

export interface Block {
  /** `item` keeps its own indent so nested working reads as nested. */
  readonly kind: 'paragraph' | 'item';
  readonly depth: number;
  readonly runs: readonly Run[];
}

/** `* `, `- `, `1. ` and their indented forms. */
const BULLET = /^(\s*)(?:[*+-]|\d+[.)])\s+(.*)$/;

/**
 * `**strong**` before `*emphasis*`, or the opening pair of a strong run is read
 * as an empty emphasis and the text comes out with stars still in it.
 *
 * A marked run may not open or close on a space, which is the rule every
 * Markdown parser keeps and the one this file was written without: `3 * 4` has
 * two stars in it, and the first version read the space between them as
 * emphasis - turning arithmetic into italics and deleting the operators.
 */
const MARKED =
  /\*\*(\S(?:[^*]*\S)?)\*\*|\*(\S(?:[^*]*\S)?)\*|__(\S(?:[^_]*\S)?)__|_(\S(?:[^_]*\S)?)_/g;

/** One line's text, split into marked and unmarked runs. */
export const runsOf = (text: string): Run[] => {
  const runs: Run[] = [];
  let at = 0;

  for (const found of text.matchAll(MARKED)) {
    const start = found.index ?? 0;
    if (start > at) runs.push({ text: text.slice(at, start) });

    const strong = found[1] ?? found[3];
    const emphasis = found[2] ?? found[4];
    if (strong !== undefined) runs.push({ text: strong, strong: true });
    else if (emphasis !== undefined) runs.push({ text: emphasis, emphasis: true });

    at = start + found[0].length;
  }

  if (at < text.length) runs.push({ text: text.slice(at) });

  // A line with nothing in it is still a line: returning no runs at all would
  // make an empty block indistinguishable from a missing one.
  return runs.length > 0 ? runs : [{ text }];
};

/**
 * The whole reasoning, as blocks.
 *
 * Blank lines separate paragraphs; a bulleted line is its own block whatever
 * stands around it. Nothing is dropped — a player reading how a companion
 * arrived somewhere is owed every step of it, and a parser that silently eats
 * a line it did not recognise is a parser that edits the evidence.
 */
export const blocksOf = (text: string): Block[] => {
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flush = (): void => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: 'paragraph', depth: 0, runs: runsOf(paragraph.join(' ')) });
    paragraph = [];
  };

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') {
      flush();
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet) {
      flush();
      // Two spaces to a level, which is what a model writes and what reads as
      // one step of nesting rather than a page pushed off the screen.
      blocks.push({
        kind: 'item',
        depth: Math.min(3, Math.floor((bullet[1] ?? '').length / 2)),
        runs: runsOf(bullet[2] ?? ''),
      });
      continue;
    }

    paragraph.push(trimmed);
  }

  flush();
  return blocks;
};
