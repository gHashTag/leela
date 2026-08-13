/**
 * Who the player plays as.
 *
 * Leela is not a snakes-and-ladders board with Sanskrit labels on it. The
 * seventy-two plans are a cosmology, the texts name the gods that govern them,
 * and the piece a player pushes around is meant to be somebody. A magenta
 * sphere is the placeholder this had.
 *
 * **Every name here is one the dataset itself uses.** Measured, not chosen: a
 * search of `plans.en.json` for the usual roster returns Vishnu, Shiva, Brahma,
 * Rudra, Krishna, Indra, Saraswati, Durga, Yama, Agni and Varuna — and does not
 * return Ganesha, Lakshmi or Hanuman, so they are not offered. Putting a deity
 * on the board whose name appears nowhere in the seventy-two texts would be
 * decoration invented for a screen, which is the thing this repository's own
 * migration notes keep catching.
 *
 * The emblem is the attribute traditionally held or borne, because a
 * recognisable object in wood and brass is a thing three.js can build honestly
 * and a face is not.
 */

/** What the token carries. Each is assembled from primitives in `scene`. */
export type Emblem =
  /** A lotus, layered. */
  | 'padma'
  /** Vishnu's discus. */
  | 'chakra'
  /** The trident. */
  | 'trishula'
  /** Krishna's flute. */
  | 'bansuri'
  /** Saraswati's instrument. */
  | 'veena'
  /** A blade. */
  | 'khanga'
  /** Indra's thunderbolt. */
  | 'vajra'
  /** Flame. */
  | 'jvala';

export interface Deity {
  readonly id: string;
  /** As written in Devanagari. */
  readonly sanskrit: string;
  /** Transliterated, for readers of every other script. */
  readonly latin: string;
  readonly emblem: Emblem;
  /** The token's body. */
  readonly colour: number;
  /** The emblem, so it reads against the body. */
  readonly accent: number;
}

/**
 * Eight of the eleven the texts name.
 *
 * Rudra is left out as an aspect of Shiva rather than a second token of the
 * same god; Yama and Varuna are left out for want of an emblem that is not
 * another staff. All three are still in the texts, where they belong.
 */
export const DEITIES: readonly Deity[] = [
  { id: 'vishnu', sanskrit: 'विष्णु', latin: 'Vishnu', emblem: 'chakra', colour: 0x2f5fd0, accent: 0xf0c34a },
  { id: 'shiva', sanskrit: 'शिव', latin: 'Shiva', emblem: 'trishula', colour: 0xcfd6da, accent: 0x6d7a82 },
  { id: 'brahma', sanskrit: 'ब्रह्मा', latin: 'Brahma', emblem: 'padma', colour: 0xe8912d, accent: 0xfff0d0 },
  { id: 'krishna', sanskrit: 'कृष्ण', latin: 'Krishna', emblem: 'bansuri', colour: 0x1f9e8f, accent: 0xf5e6a8 },
  { id: 'saraswati', sanskrit: 'सरस्वती', latin: 'Saraswati', emblem: 'veena', colour: 0xf2f2ee, accent: 0xd8b25e },
  { id: 'durga', sanskrit: 'दुर्गा', latin: 'Durga', emblem: 'khanga', colour: 0xc62b3a, accent: 0xf3d98b },
  { id: 'indra', sanskrit: 'इन्द्र', latin: 'Indra', emblem: 'vajra', colour: 0xd9b13c, accent: 0xfffbe8 },
  { id: 'agni', sanskrit: 'अग्नि', latin: 'Agni', emblem: 'jvala', colour: 0xe4622a, accent: 0xffd08a },
];

export const DEFAULT_DEITY = DEITIES[0] as Deity;

/**
 * One by id, falling back rather than throwing.
 *
 * The id comes out of `localStorage`, which is to say out of whatever the last
 * version of this app wrote there. A roster that changes between releases
 * should cost a player their choice, not their game.
 */
export const deityFor = (id: string | null | undefined): Deity =>
  DEITIES.find((deity) => deity.id === id) ?? DEFAULT_DEITY;
