#!/usr/bin/env node
/**
 * Draw the engine's snakes and arrows over the painted board.
 *
 * The board art and the rules are two descriptions of the same thing, and
 * nothing checked that they described it the same way: the grid was laid over
 * the painting by proportion, and a proportion that is a little wrong puts
 * every snake a square from where it belongs. Squinting at a phone does not
 * settle it either — the arrows cross.
 *
 * This writes an SVG that puts the engine's tables on top of the image at the
 * geometry `GameBoard` uses, so the two can be compared in one look. Open the
 * output in a browser.
 *
 *   node scripts/board-overlay.mjs [out.svg]
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { ARROWS, BOARD_ROWS, SNAKES } from '../packages/engine/src/board.ts';

/** The painting, and where the grid sits inside it — `GameBoard`'s numbers. */
const ART = { width: 343, height: 307 };
const GRID = { left: 23, top: 28, cell: 33, row: 35 };

const centre = (plan) => {
  for (const [row, squares] of BOARD_ROWS.entries()) {
    const column = squares.indexOf(plan);
    if (column === -1) continue;
    return {
      x: GRID.left + column * GRID.cell + GRID.cell / 2,
      y: GRID.top + row * GRID.row + GRID.row / 2,
    };
  }
  throw new RangeError(`plan ${plan} is not on the board`);
};

const jump = (from, to, colour) => {
  const a = centre(from);
  const b = centre(to);
  return [
    `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${colour}" stroke-width="1.5" opacity="0.9"/>`,
    `<circle cx="${a.x}" cy="${a.y}" r="7" fill="none" stroke="${colour}" stroke-width="1.5"/>`,
    `<circle cx="${b.x}" cy="${b.y}" r="3" fill="${colour}"/>`,
    `<text x="${a.x}" y="${a.y - 9}" font-size="7" fill="${colour}" text-anchor="middle">${from}</text>`,
  ].join('');
};

const source = new URL(
  '../../leela-src/leela/src/components/GameBoard/images/light.png',
  import.meta.url,
);
const image = readFileSync(source).toString('base64');

const squares = BOARD_ROWS.flatMap((row, r) =>
  row.map((plan, c) => {
    const x = GRID.left + c * GRID.cell;
    const y = GRID.top + r * GRID.row;
    return `<rect x="${x}" y="${y}" width="${GRID.cell}" height="${GRID.row}" fill="none" stroke="#bbb" stroke-width="0.4"/><text x="${x + GRID.cell / 2}" y="${y + GRID.row / 2 + 3}" font-size="8" fill="#666" text-anchor="middle">${plan}</text>`;
  }),
);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ART.width * 2}" height="${ART.height * 2}" viewBox="0 0 ${ART.width} ${ART.height}">
<rect width="100%" height="100%" fill="#fff"/>
<image href="data:image/png;base64,${image}" x="0" y="0" width="${ART.width}" height="${ART.height}"/>
${squares.join('\n')}
${Object.entries(ARROWS).map(([from, to]) => jump(Number(from), to, '#1a7f37')).join('\n')}
${Object.entries(SNAKES).map(([from, to]) => jump(Number(from), to, '#0b6bcb')).join('\n')}
</svg>
`;

const out = process.argv[2] ?? 'board-overlay.svg';
writeFileSync(out, svg);
console.log(`Wrote ${out}: ${Object.keys(ARROWS).length} arrows, ${Object.keys(SNAKES).length} snakes.`);
console.log('A ring is where a jump starts, a dot where it lands.');
