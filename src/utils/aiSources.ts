export interface AiSourceT {
  reference: string
  quote: string | null
}

const SOURCE_MARKERS = ['Sources:', 'Источники:']
const SPLIT_REGEX = /[;；]/
const QUOTE_DELIMITERS = [' — ', ' - ', '–', '—']

export const extractSources = (text: string): AiSourceT[] => {
  if (!text) return []

  const markerIndex = SOURCE_MARKERS
    .map((marker) => ({ marker, index: text.indexOf(marker) }))
    .filter((a) => a.index !== -1)
    .sort((a, b) => a.index - b.index)[0]

  if (!markerIndex) return []

  const raw = text
    .slice(markerIndex.index + markerIndex.marker.length)
    .trim()

  if (!raw) return []

  return raw
    .split(SPLIT_REGEX)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      for (const delimiter of QUOTE_DELIMITERS) {
        const index = part.indexOf(delimiter)
        if (index !== -1) {
          const reference = part.slice(0, index).trim()
          const quote = part.slice(index + delimiter.length).trim()
          return {
            reference,
            quote: stripQuoteMarks(quote)
          }
        }
      }
      return { reference: part, quote: null }
    })
}

const stripQuoteMarks = (quote: string): string => {
  return quote.replace(/^[""'"'`]+|[""'"'`]+$/g, '').trim()
}
