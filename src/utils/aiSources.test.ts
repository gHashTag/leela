import { extractSources } from './aiSources'

describe('extractSources', () => {
  it('returns an empty array when text is empty', () => {
    expect(extractSources('')).toEqual([])
    expect(extractSources(null as any)).toEqual([])
  })

  it('returns an empty array when no source marker is present', () => {
    const result = extractSources('Just a plain answer with no sources.')
    expect(result).toEqual([])
  })

  it('extracts a single English source with reference and quote', () => {
    const text =
      'Teaching text.\n\nSources: Bhagavad Gita 2.47 — "You have a right to perform your prescribed duties."'
    expect(extractSources(text)).toEqual([
      {
        reference: 'Bhagavad Gita 2.47',
        quote: 'You have a right to perform your prescribed duties.'
      }
    ])
  })

  it('extracts multiple English sources split by semicolon', () => {
    const text =
      'Teaching.\n\nSources: Bhagavad Gita 2.47 — "Quote one."; Chandogya Upanishad 6.2.1 — "Quote two."'
    expect(extractSources(text)).toEqual([
      { reference: 'Bhagavad Gita 2.47', quote: 'Quote one.' },
      { reference: 'Chandogya Upanishad 6.2.1', quote: 'Quote two.' }
    ])
  })

  it('extracts Russian sources with Источники marker', () => {
    const text =
      'Учение.\n\nИсточники: Бхагавад-гита 2.47 — "Твой долг — действовать."'
    expect(extractSources(text)).toEqual([
      { reference: 'Бхагавад-гита 2.47', quote: 'Твой долг — действовать.' }
    ])
  })

  it('returns reference-only source when no quote delimiter is present', () => {
    const text = 'Teaching.\n\nSources: Bhagavad Gita 2.47'
    expect(extractSources(text)).toEqual([
      { reference: 'Bhagavad Gita 2.47', quote: null }
    ])
  })

  it('handles mixed quote marks and extra whitespace', () => {
    const text =
      "Sources: Bhagavad Gita 2.47 — 'Quote one.' ; Chandogya Upanishad 6.2.1 — `Quote two.`"
    expect(extractSources(text)).toEqual([
      { reference: 'Bhagavad Gita 2.47', quote: 'Quote one.' },
      { reference: 'Chandogya Upanishad 6.2.1', quote: 'Quote two.' }
    ])
  })

  it('ignores text before the source marker', () => {
    const text =
      'Some explanation. Sources: Katha Upanishad 1.2.23 — "The soul is the chariot."'
    expect(extractSources(text)).toEqual([
      { reference: 'Katha Upanishad 1.2.23', quote: 'The soul is the chariot.' }
    ])
  })
})
