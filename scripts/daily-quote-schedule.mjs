/*
 * Every decision the daily-quote cron makes.
 *
 * Pure functions only — no clock, no filesystem, no network, nothing that
 * cannot be handed a value and asked for an answer. scripts/daily-quote-cron.sh
 * makes no decisions of its own; it asks scripts/daily-quote-select.mjs, which
 * asks this file. That is what lets scripts/daily-quote-schedule.test.ts check
 * the whole schedule without sending anything.
 */

/**
 * 1 on 1 January, 365 on 31 December (366 in a leap year).
 *
 * Built from the local calendar fields rather than a millisecond difference,
 * so a daylight-saving jump cannot shift the day by one.
 */
export function dayOfYear(date = new Date()) {
  const start = Date.UTC(date.getFullYear(), 0, 0)
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.round((today - start) / 86400000)
}

/** Local calendar date as YYYY-MM-DD — the key the state file is written on. */
export function isoDate(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * Today's quote. No randomness: the same date always returns the same entry,
 * so a re-run at 06:00 and again at 06:05 sends the same words, and a year
 * walks the whole list without skipping one.
 */
export function pickQuote(quotes, date = new Date()) {
  if (!Array.isArray(quotes) || quotes.length === 0) {
    throw new Error('daily-quotes.json holds no quotes')
  }
  return quotes[dayOfYear(date) % quotes.length]
}

/**
 * Whether today's quote should go out, given what the state file remembers.
 * A state whose lastSentDate is today means the day is spent, whatever its
 * status: a failed attempt is not retried, so nobody is pushed to twice.
 */
export function decide(quotes, state, date = new Date()) {
  const today = isoDate(date)
  const quote = pickQuote(quotes, date)

  if (state && state.lastSentDate === today) {
    const what = state.lastQuoteId || 'a quote'
    const how = state.status ? ` (${state.status})` : ''
    return {
      send: false,
      date: today,
      quote,
      reason: `${today} already recorded: ${what}${how}`
    }
  }

  const last = state && state.lastSentDate ? state.lastSentDate : 'never'
  return {
    send: true,
    date: today,
    quote,
    reason: `last recorded send: ${last}`
  }
}

/**
 * The state to write once a day has been claimed. Re-committing the same day
 * (to record the outcome after sending) updates the status without counting
 * the day twice.
 */
export function nextState(state, date, quoteId, status = 'sent') {
  const prior =
    state && typeof state.sentCount === 'number' ? state.sentCount : 0
  const sameDay = Boolean(state && state.lastSentDate === date)
  return {
    lastSentDate: date,
    lastQuoteId: quoteId,
    status,
    sentCount: sameDay ? prior : prior + 1
  }
}

/**
 * Everything wrong with a quote list, as a list of human-readable problems.
 * An empty array means the file is fit to send from. Traceability to a source
 * plan is part of the shape: a quote nobody can trace is a defect, not a quote.
 */
export function validateQuotes(quotes) {
  if (!Array.isArray(quotes)) return ['quotes file is not an array']
  if (quotes.length === 0) return ['quotes file is empty']

  const problems = []
  const seen = new Set()

  quotes.forEach((quote, index) => {
    const at = `entry ${index}`
    if (!quote || typeof quote !== 'object') {
      problems.push(`${at}: not an object`)
      return
    }

    const id = quote.id
    if (typeof id !== 'string' || id.length === 0) {
      problems.push(`${at}: missing id`)
    } else if (seen.has(id)) {
      problems.push(`${at}: duplicate id ${id}`)
    } else {
      seen.add(id)
    }

    for (const lang of ['ru', 'en']) {
      const side = quote[lang]
      if (!side || typeof side !== 'object') {
        problems.push(`${at} (${id}): missing ${lang}`)
        continue
      }
      for (const field of ['title', 'body']) {
        const text = side[field]
        if (typeof text !== 'string' || text.trim().length === 0) {
          problems.push(`${at} (${id}): missing ${lang}.${field}`)
        } else if (/[\r\n]/.test(text)) {
          // The cron reads these back with `IFS='=' read -r key value`.
          problems.push(`${at} (${id}): ${lang}.${field} contains a newline`)
        }
      }
    }

    const source = quote.source
    if (!source || typeof source !== 'object') {
      problems.push(`${at} (${id}): missing source`)
      return
    }
    if (typeof source.plan !== 'string' || !/^plan_\d+$/.test(source.plan)) {
      problems.push(`${at} (${id}): source.plan is not a plan key`)
    }
    if (!Array.isArray(source.files) || source.files.length === 0) {
      problems.push(`${at} (${id}): source.files is empty`)
    }
  })

  return problems
}
