/**
 * The painting, and what the board is without it.
 *
 * The squares carry their numbers as text and the painting carries them as
 * paint. Once the painting arrived the text was hidden — `color: transparent` —
 * which is right while the image is there and leaves a blank white rectangle
 * with 72 invisible buttons when it is not. A 147 kB image on a phone on a
 * train is not a certainty, and a board nobody can read is worse than a plain
 * one.
 *
 * So the plain board is the default and the painting is an upgrade applied
 * when it has actually loaded. Progressive in the literal sense: the grid of
 * numbers is playable on its own, and was the whole board until this week.
 */

/** Loads an image and says whether it arrived. Injected so a test can fail. */
export type ImageLoader = (url: string) => Promise<boolean>;

/** The real one: a detached `Image`, which is how a background is preloaded. */
export const loadImage: ImageLoader = (url) =>
  new Promise((resolve) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(true));
    image.addEventListener('error', () => resolve(false));
    image.src = url;
  });

/**
 * Put the painting on the board, if it comes.
 *
 * Sets the background from here rather than from the stylesheet so that the
 * load which decides the class is the same load the board displays — a CSS
 * `background-image` gives no way to know whether it failed.
 *
 * @returns whether the board ended up painted.
 */
export async function paintBoard(
  document: Document,
  url: string,
  load: ImageLoader = loadImage,
): Promise<boolean> {
  const board = document.getElementById('board');
  if (!board) return false;

  const arrived = await load(url);
  if (!arrived) return false;

  board.style.backgroundImage = `url("${url}")`;
  board.classList.add('painted');
  return true;
}
