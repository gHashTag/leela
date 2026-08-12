/**
 * The model's reasoning, made readable.
 *
 * `reasoning_content` arrives as markdown, and the streaming view renders it
 * with a plain `Text` - so headings, bold markers and list bullets landed on
 * screen literally: `1. **Analyze the User's Input:**` followed by rows of
 * `*`. Parsing it properly would be wasted work, because this text exists only
 * until the answer replaces it. Stripping the markers is enough, and unlike a
 * parser it cannot fail on half-streamed markup - the input here is always a
 * fragment, cut wherever the last chunk happened to end.
 */

/** Longest reasoning kept on screen. Beyond this the tail is what matters. */
const MAX_CHARS = 600

export const plainThinking = (raw: string | null | undefined): string => {
  if (typeof raw !== 'string') return ''

  const text = raw
    // Bold markers, including the unterminated ones a live stream produces
    // mid-token.
    .replace(/\*\*/g, '')
    // A leading asterisk with space after it is a list bullet, not emphasis.
    .replace(/^[ \t]*\*[ \t]+/gm, '')
    .replace(/(^|[\s(])\*(?=\S)/g, '$1')
    .replace(/(?<=\S)\*(?=[\s).,;:]|$)/g, '')
    .replace(/`+/g, '')
    // Headings and blockquotes at the start of a line.
    .replace(/^[ \t]*#{1,6}[ \t]*/gm, '')
    .replace(/^[ \t]*>[ \t]*/gm, '')
    // Dash bullets become a middle dot: a list without the noise.
    .replace(/^[ \t]*[-+][ \t]+/gm, '· ')
    // Collapse the runs of blank lines a streamed answer is full of.
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .trim()

  if (text.length <= MAX_CHARS) return text

  // Keep the tail: the newest thought is the one worth showing.
  return `…${text.slice(text.length - MAX_CHARS)}`
}
