#!/usr/bin/env node
/*
 * Ask scripts/daily-quote-schedule.mjs what today is, and print the answer in
 * a shape scripts/daily-quote-cron.sh can read.
 *
 * This file holds no judgement of its own: paths, files and printing only.
 * The rules live in daily-quote-schedule.mjs, where the jest suite reaches
 * them (scripts/daily-quote-schedule.test.ts).
 *
 * The pick is deterministic — day of the year modulo the length of
 * scripts/daily-quotes.json — so a re-run on the same day sends the same words.
 * Idempotence lives in a state file, by default
 * ~/.leela/daily-quote-state.json: a day whose date is already recorded is
 * never sent again, including a day whose send failed.
 *
 * Usage:
 *   node scripts/daily-quote-select.mjs                 # env-style decision
 *   node scripts/daily-quote-select.mjs --format json
 *   node scripts/daily-quote-select.mjs --dry           # human-readable pick
 *   node scripts/daily-quote-select.mjs --date 2026-08-22
 *   node scripts/daily-quote-select.mjs --commit --status sent
 *
 * Nothing here ever sends a push; scripts/send-daily-quote.mjs does that.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  dayOfYear,
  decide,
  nextState,
  validateQuotes
} from './daily-quote-schedule.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

const DEFAULT_QUOTES_PATH = join(HERE, 'daily-quotes.json')
const DEFAULT_STATE_PATH = join(
  process.env.LEELA_HOME || join(homedir(), '.leela'),
  'daily-quote-state.json'
)

function readState(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    // No file yet, or an unreadable one: nothing has ever been sent.
    return null
  }
}

function writeState(path, state) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(state, null, 2) + '\n')
}

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue
    const key = argv[i].slice(2)
    if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      args[key] = argv[++i]
    } else {
      args[key] = true
    }
  }
  return args
}

function main(argv) {
  const args = parseArgs(argv)
  const quotesPath = args.quotes || DEFAULT_QUOTES_PATH
  const statePath = args.state || DEFAULT_STATE_PATH
  const date = args.date ? new Date(`${args.date}T12:00:00`) : new Date()

  if (Number.isNaN(date.getTime())) {
    console.error(`--date is not a date: ${args.date}`)
    return 2
  }

  const quotes = JSON.parse(readFileSync(quotesPath, 'utf8'))
  const problems = validateQuotes(quotes)
  if (problems.length > 0) {
    console.error(`${quotesPath} is not fit to send from:`)
    for (const problem of problems) console.error(`  - ${problem}`)
    return 1
  }

  const state = readState(statePath)
  const decision = decide(quotes, state, date)
  const { quote } = decision

  if (args.commit) {
    const status = typeof args.status === 'string' ? args.status : 'sent'
    writeState(statePath, nextState(state, decision.date, quote.id, status))
    console.log(`recorded ${quote.id} for ${decision.date} (${status})`)
    return 0
  }

  const format = args.dry ? 'text' : args.format || 'env'

  if (format === 'json') {
    console.log(JSON.stringify(decision, null, 2))
  } else if (format === 'text') {
    console.log(`date:   ${decision.date} (day ${dayOfYear(date)} of the year)`)
    console.log(`quote:  ${quote.id}  <- ${quote.source.plan}`)
    console.log(`ru:     ${quote.ru.title}`)
    console.log(`        ${quote.ru.body}`)
    console.log(`en:     ${quote.en.title}`)
    console.log(`        ${quote.en.body}`)
    console.log(`send:   ${decision.send ? 'yes' : 'no'} — ${decision.reason}`)
    console.log('(selection only — nothing was sent)')
  } else {
    // Line-oriented, for `while IFS='=' read -r key value` in the cron script.
    console.log(`send=${decision.send ? 1 : 0}`)
    console.log(`date=${decision.date}`)
    console.log(`id=${quote.id}`)
    console.log(`reason=${decision.reason}`)
    console.log(`ru_title=${quote.ru.title}`)
    console.log(`ru_body=${quote.ru.body}`)
    console.log(`en_title=${quote.en.title}`)
    console.log(`en_body=${quote.en.body}`)
  }

  return 0
}

process.exit(main(process.argv.slice(2)))
