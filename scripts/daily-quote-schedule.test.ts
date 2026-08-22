import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * The daily quote must be the same words for everyone, every time, and it must
 * be words the app already says.
 *
 * Three things are checked here, and the third is the one that matters most:
 *
 *   1. The pick is a function of the date alone. A re-run at 06:00 and again at
 *      06:05 chooses the same quote, and a year walks the whole list without
 *      skipping an entry — otherwise "a month never repeats" is a hope, not a
 *      property.
 *   2. A day is sent once. The state file is the only memory the cron has, so
 *      the rules that read it are checked directly: today already recorded
 *      means nothing goes out, including when the recorded outcome was a
 *      failure. Every install would receive a second push otherwise.
 *   3. Every quote is traceable. Each line must appear verbatim in the plan
 *      text the app itself ships, in the file its `source` names. A quote that
 *      cannot be traced is rejected — we are not in the business of inventing
 *      scripture and attributing it to the game.
 */

interface Quote {
  id: string
  ru: { title: string; body: string }
  en: { title: string; body: string }
  source: { plan: string; files: string[] }
}

interface State {
  lastSentDate?: string
  lastQuoteId?: string
  status?: string
  sentCount?: number
}

interface Decision {
  send: boolean
  date: string
  quote: Quote
  reason: string
}

interface Schedule {
  dayOfYear(date?: Date): number
  isoDate(date?: Date): string
  pickQuote(quotes: Quote[], date?: Date): Quote
  decide(quotes: Quote[], state: State | null, date?: Date): Decision
  nextState(
    state: State | null,
    date: string,
    quoteId: string,
    status?: string
  ): Required<State>
  validateQuotes(quotes: unknown): string[]
}

const schedule = require('./daily-quote-schedule.mjs') as Schedule

const REPO = join(__dirname, '..')
const QUOTES_PATH = join(__dirname, 'daily-quotes.json')

const quotes = JSON.parse(readFileSync(QUOTES_PATH, 'utf8')) as Quote[]

const readTranslation = (lang: 'ru' | 'en') =>
  JSON.parse(
    readFileSync(join(REPO, 'src', 'locales', lang, 'translation.json'), 'utf8')
  ) as Record<string, { title: string; content: string } | undefined>

const translations = { ru: readTranslation('ru'), en: readTranslation('en') }

const daysOf = (year: number): Date[] => {
  const days: Date[] = []
  const cursor = new Date(year, 0, 1, 12)
  while (cursor.getFullYear() === year) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

describe('day-of-year', () => {
  it('counts 1 January as day 1 and 31 December as the last day', () => {
    expect(schedule.dayOfYear(new Date(2026, 0, 1, 12))).toBe(1)
    expect(schedule.dayOfYear(new Date(2026, 11, 31, 12))).toBe(365)
    expect(schedule.dayOfYear(new Date(2028, 11, 31, 12))).toBe(366)
  })

  it('gives every day of a year its own number, in order', () => {
    for (const year of [2026, 2028]) {
      const numbers = daysOf(year).map((day) => schedule.dayOfYear(day))
      expect(numbers[0]).toBe(1)
      expect(numbers).toEqual(numbers.map((_, index) => index + 1))
    }
  })

  it('does not drift across the hours of a single day', () => {
    const hours = [0, 6, 12, 18, 23].map(
      (hour) => new Date(2026, 6, 15, hour, 30)
    )
    const numbers = hours.map((date) => schedule.dayOfYear(date))
    expect(new Set(numbers).size).toBe(1)
  })
})

describe('choosing today', () => {
  it('returns the same quote however often it is asked on one day', () => {
    const morning = new Date(2026, 7, 22, 6, 0)
    const evening = new Date(2026, 7, 22, 23, 59)
    expect(schedule.pickQuote(quotes, morning).id).toBe(
      schedule.pickQuote(quotes, evening).id
    )
  })

  it('is day-of-year modulo the list length', () => {
    const date = new Date(2026, 7, 22, 12)
    const expected = quotes[schedule.dayOfYear(date) % quotes.length]
    expect(schedule.pickQuote(quotes, date).id).toBe(expected.id)
  })

  it('reaches every quote within a year, leaving no gaps', () => {
    for (const year of [2026, 2028]) {
      const picked = daysOf(year).map(
        (day) => schedule.pickQuote(quotes, day).id
      )
      expect(new Set(picked).size).toBe(quotes.length)
      for (const quote of quotes) {
        expect(picked).toContain(quote.id)
      }
    }
  })

  it('moves on by exactly one entry each day', () => {
    const days = daysOf(2026)
    const indexes = days.map((day) => {
      const id = schedule.pickQuote(quotes, day).id
      return quotes.findIndex((quote) => quote.id === id)
    })
    for (let i = 1; i < indexes.length; i++) {
      expect(indexes[i]).toBe((indexes[i - 1] + 1) % quotes.length)
    }
  })

  it('never repeats inside any thirty-day window, new year included', () => {
    // Two years end to end, so the 31 December -> 1 January seam is covered
    // rather than assumed: the day number restarts there and the walk jumps.
    const ids = [...daysOf(2026), ...daysOf(2027)].map(
      (day) => schedule.pickQuote(quotes, day).id
    )
    for (let start = 0; start + 30 <= ids.length; start++) {
      expect(new Set(ids.slice(start, start + 30)).size).toBe(30)
    }
  })

  it('refuses an empty list rather than picking nothing', () => {
    expect(() => schedule.pickQuote([], new Date())).toThrow(/no quotes/)
  })
})

describe('sending a day only once', () => {
  const today = new Date(2026, 7, 22, 6, 0)
  const todayIso = '2026-08-22'

  it('sends when nothing has ever been recorded', () => {
    const decision = schedule.decide(quotes, null, today)
    expect(decision.send).toBe(true)
    expect(decision.date).toBe(todayIso)
    expect(decision.reason).toMatch(/never/)
  })

  it('sends when the last recorded send was an earlier day', () => {
    const state: State = { lastSentDate: '2026-08-21', lastQuoteId: 'plan-36' }
    expect(schedule.decide(quotes, state, today).send).toBe(true)
  })

  it('sends nothing when today is already recorded', () => {
    const state: State = {
      lastSentDate: todayIso,
      lastQuoteId: 'plan-37',
      status: 'sent'
    }
    const decision = schedule.decide(quotes, state, today)
    expect(decision.send).toBe(false)
    expect(decision.reason).toContain(todayIso)
    expect(decision.reason).toContain('plan-37')
  })

  it('does not retry a day whose send failed', () => {
    const state: State = {
      lastSentDate: todayIso,
      lastQuoteId: 'plan-37',
      status: 'failed-ru'
    }
    // Fail-closed: a lost day costs one quote, a retry costs every install a
    // second push.
    expect(schedule.decide(quotes, state, today).send).toBe(false)
  })

  it('still names the day’s quote when it declines to send it', () => {
    const state: State = { lastSentDate: todayIso, lastQuoteId: 'plan-37' }
    const declined = schedule.decide(quotes, state, today)
    const offered = schedule.decide(quotes, null, today)
    expect(declined.quote.id).toBe(offered.quote.id)
  })

  it('sends again once the date rolls over', () => {
    const state: State = { lastSentDate: todayIso, lastQuoteId: 'plan-37' }
    const tomorrow = new Date(2026, 7, 23, 6, 0)
    const decision = schedule.decide(quotes, state, tomorrow)
    expect(decision.send).toBe(true)
    expect(decision.date).toBe('2026-08-23')
    expect(decision.quote.id).not.toBe('plan-37')
  })
})

describe('what gets written back', () => {
  it('counts a new day', () => {
    const state: State = { lastSentDate: '2026-08-21', sentCount: 4 }
    const next = schedule.nextState(state, '2026-08-22', 'plan-37')
    expect(next).toEqual({
      lastSentDate: '2026-08-22',
      lastQuoteId: 'plan-37',
      status: 'sent',
      sentCount: 5
    })
  })

  it('starts counting from nothing', () => {
    expect(schedule.nextState(null, '2026-08-22', 'plan-37').sentCount).toBe(1)
  })

  it('records the outcome of a day without counting it twice', () => {
    const claimed = schedule.nextState(null, '2026-08-22', 'plan-37', 'sending')
    expect(claimed.sentCount).toBe(1)
    const settled = schedule.nextState(claimed, '2026-08-22', 'plan-37', 'sent')
    expect(settled.sentCount).toBe(1)
    expect(settled.status).toBe('sent')
  })

  it('keeps the day claimed after a failure', () => {
    const claimed = schedule.nextState(null, '2026-08-22', 'plan-37', 'sending')
    const failed = schedule.nextState(
      claimed,
      '2026-08-22',
      'plan-37',
      'failed-ru'
    )
    expect(schedule.decide(quotes, failed, new Date(2026, 7, 22, 7)).send).toBe(
      false
    )
  })
})

describe('the quote file', () => {
  it('holds enough quotes that a month never repeats', () => {
    expect(quotes.length).toBeGreaterThanOrEqual(30)
  })

  it('is fit to send from', () => {
    expect(schedule.validateQuotes(quotes)).toEqual([])
  })

  it('gives every entry both languages, both fields, and a source', () => {
    for (const quote of quotes) {
      expect(typeof quote.id).toBe('string')
      expect(quote.id.length).toBeGreaterThan(0)
      for (const lang of ['ru', 'en'] as const) {
        expect(typeof quote[lang].title).toBe('string')
        expect(quote[lang].title.trim().length).toBeGreaterThan(0)
        expect(typeof quote[lang].body).toBe('string')
        expect(quote[lang].body.trim().length).toBeGreaterThan(0)
      }
      expect(quote.source.plan).toMatch(/^plan_\d+$/)
      expect(quote.source.files.length).toBeGreaterThan(0)
    }
  })

  it('has no duplicate ids', () => {
    const ids = quotes.map((quote) => quote.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps every line on one line', () => {
    // The cron reads the selector's output with `IFS='=' read -r key value`.
    for (const quote of quotes) {
      for (const lang of ['ru', 'en'] as const) {
        expect(quote[lang].title).not.toMatch(/[\r\n]/)
        expect(quote[lang].body).not.toMatch(/[\r\n]/)
      }
    }
  })

  it('fits what a push notification can show', () => {
    for (const quote of quotes) {
      for (const lang of ['ru', 'en'] as const) {
        expect(quote[lang].body.length).toBeLessThanOrEqual(200)
      }
    }
  })

  it('lives where the cron looks for it', () => {
    expect(() => readFileSync(QUOTES_PATH, 'utf8')).not.toThrow()
  })
})

describe('rejecting a malformed quote file', () => {
  const good = (): Quote => ({
    id: 'plan-01',
    ru: { title: 'т', body: 'т' },
    en: { title: 't', body: 't' },
    source: { plan: 'plan_1', files: ['src/locales/ru/translation.json'] }
  })

  it('rejects a file that is not a list', () => {
    expect(schedule.validateQuotes({})).toEqual(['quotes file is not an array'])
  })

  it('rejects an empty list', () => {
    expect(schedule.validateQuotes([])).toEqual(['quotes file is empty'])
  })

  it('rejects an entry missing a language', () => {
    const broken = good() as unknown as Record<string, unknown>
    delete broken.en
    expect(schedule.validateQuotes([broken]).join(' ')).toMatch(/missing en/)
  })

  it('rejects an entry missing a body', () => {
    const broken = good()
    broken.ru.body = '   '
    expect(schedule.validateQuotes([broken]).join(' ')).toMatch(
      /missing ru.body/
    )
  })

  it('rejects an untraceable entry', () => {
    const broken = good() as unknown as Record<string, unknown>
    delete broken.source
    expect(schedule.validateQuotes([broken]).join(' ')).toMatch(
      /missing source/
    )
  })

  it('rejects a source that names no plan', () => {
    const broken = good()
    broken.source.plan = 'foreword'
    expect(schedule.validateQuotes([broken]).join(' ')).toMatch(
      /not a plan key/
    )
  })

  it('rejects a duplicate id', () => {
    expect(schedule.validateQuotes([good(), good()]).join(' ')).toMatch(
      /duplicate id/
    )
  })

  it('rejects a body that would break the shell reader', () => {
    const broken = good()
    broken.en.body = 'two\nlines'
    expect(schedule.validateQuotes([broken]).join(' ')).toMatch(/newline/)
  })
})

describe('every quote is traceable to the app', () => {
  it('names a plan the app actually ships, in both languages', () => {
    for (const quote of quotes) {
      expect(translations.ru[quote.source.plan]).toBeDefined()
      expect(translations.en[quote.source.plan]).toBeDefined()
    }
  })

  it('names the files the text was taken from', () => {
    for (const quote of quotes) {
      expect(quote.source.files).toContain('src/locales/ru/translation.json')
      expect(quote.source.files).toContain('src/locales/en/translation.json')
      for (const file of quote.source.files) {
        expect(() => readFileSync(join(REPO, file), 'utf8')).not.toThrow()
      }
    }
  })

  it('uses the plan title the app uses, character for character', () => {
    for (const quote of quotes) {
      for (const lang of ['ru', 'en'] as const) {
        const plan = translations[lang][quote.source.plan]
        expect(plan).toBeDefined()
        expect(quote[lang].title).toBe(plan!.title)
      }
    }
  })

  it('quotes text that appears verbatim in that plan', () => {
    // The honesty gate. Nothing here was written by us; if a line drifts from
    // the app's own words, or the translation is re-edited underneath it, this
    // fails and the quote is pulled rather than sent.
    const untraceable: string[] = []
    for (const quote of quotes) {
      for (const lang of ['ru', 'en'] as const) {
        const plan = translations[lang][quote.source.plan]
        if (!plan || !plan.content.includes(quote[lang].body)) {
          untraceable.push(`${quote.id} (${lang}): ${quote[lang].body}`)
        }
      }
    }
    expect(untraceable).toEqual([])
  })

  it('would notice a quote that was made up', () => {
    // Proves the gate above can fail: a plausible-sounding line that is not in
    // the app's text must not be found in it.
    const invented = 'Игрок, познавший себя, более не бросает кость.'
    for (const lang of ['ru', 'en'] as const) {
      for (const quote of quotes) {
        const plan = translations[lang][quote.source.plan]
        expect(plan!.content.includes(invented)).toBe(false)
      }
    }
  })
})
