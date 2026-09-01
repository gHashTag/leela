import { describe, expect, it } from 'vitest';

import { blocksOf, runsOf } from '../src/marked';

/**
 * The reasoning, read rather than printed.
 *
 * Found on a phone: the companion's working came out with its asterisks intact
 * — `*   **Katha Upanishad:** The senses turn outward` — so emphasis read as
 * punctuation and a bullet read as a star.
 */

const texts = (text: string): string[] => runsOf(text).map((run) => run.text);

describe('what a line is marked with', () => {
  it('reads strong before emphasis', () => {
    // The order is the whole trick. Emphasis first would take the opening pair
    // of `**Katha**` as an empty emphasis and leave the stars on the page.
    const runs = runsOf('**Katha Upanishad:** the senses turn outward');
    expect(runs[0]).toEqual({ text: 'Katha Upanishad:', strong: true });
    expect(runs[1]?.text).toBe(' the senses turn outward');
  });

  it('reads emphasis on its own', () => {
    expect(runsOf('the *Self*, not the world')).toEqual([
      { text: 'the ' },
      { text: 'Self', emphasis: true },
      { text: ', not the world' },
    ]);
  });

  it('reads underscores the same way', () => {
    expect(runsOf('__strong__ and _soft_')).toEqual([
      { text: 'strong', strong: true },
      { text: ' and ' },
      { text: 'soft', emphasis: true },
    ]);
  });

  it('leaves a lone star alone rather than eating the rest of the line', () => {
    // A model writes `2 * 3` and an unbalanced parser swallows everything after
    // it. Nothing is dropped: the line comes out as itself.
    expect(texts('a * b and 3 * 4')).toEqual(['a * b and 3 * 4']);
    expect(texts('unclosed **bold here')).toEqual(['unclosed **bold here']);
  });

  it('keeps an empty line as a line', () => {
    expect(runsOf('')).toEqual([{ text: '' }]);
  });
});

describe('the reasoning, in blocks', () => {
  it('reads a bullet as an item and not as a star', () => {
    const blocks = blocksOf('*   Katha Upanishad: the senses turn outward');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.kind).toBe('item');
    expect(blocks[0]?.runs[0]?.text).toBe('Katha Upanishad: the senses turn outward');
  });

  it('reads every bullet a model actually writes', () => {
    for (const mark of ['*', '-', '+', '1.', '2)']) {
      const blocks = blocksOf(`${mark} a step`);
      expect(blocks[0]?.kind, mark).toBe('item');
      expect(blocks[0]?.runs[0]?.text, mark).toBe('a step');
    }
  });

  it('keeps nesting, bounded', () => {
    expect(blocksOf('* one').at(0)?.depth).toBe(0);
    expect(blocksOf('  * two').at(0)?.depth).toBe(1);
    expect(blocksOf('    * three').at(0)?.depth).toBe(2);
    // Bounded, or a model that indents by eight puts the text off the screen.
    expect(blocksOf('                * deep').at(0)?.depth).toBe(3);
  });

  it('joins a wrapped paragraph and splits on a blank line', () => {
    const blocks = blocksOf('one line\nand its wrap\n\na second paragraph');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.runs[0]?.text).toBe('one line and its wrap');
    expect(blocks[1]?.runs[0]?.text).toBe('a second paragraph');
  });

  it('drops nothing, which is the point', () => {
    // A player reading how a companion arrived somewhere is owed every step. A
    // parser that silently eats a line it did not recognise edits the evidence.
    const reasoning = [
      '1.  **Analyze the request:**',
      '    *   Context: the player is on plan 13.',
      '',
      'Synthesis: the plan speaks of diffusion.',
      '*   Practical step: sit still for five minutes.',
    ].join('\n');

    const blocks = blocksOf(reasoning);
    const said = blocks.map((b) => b.runs.map((r) => r.text).join('')).join(' ');
    for (const fragment of ['Analyze the request', 'plan 13', 'Synthesis', 'five minutes']) {
      expect(said, fragment).toContain(fragment);
    }
    // And no star survives into the text.
    expect(said).not.toContain('*');
  });

  it('is empty for nothing at all', () => {
    expect(blocksOf('')).toEqual([]);
    expect(blocksOf('\n\n  \n')).toEqual([]);
  });
});
