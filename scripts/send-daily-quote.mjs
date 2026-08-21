#!/usr/bin/env node
/*
 * Send a quote of the day to every install, via FCM topics.
 *
 * The app subscribes each install (signed in or not) to `daily-quote` and to
 * one of `daily-quote-ru` / `daily-quote-en` — see
 * src/utils/notifications/dailyQuotePush.ts. This script speaks to the FCM
 * HTTP v1 API directly with the service-account key, so sending needs no
 * Firebase console session and no extra npm packages.
 *
 * The key file is NOT in the repository:
 *   ~/.leela/fcm-service-account.json   (or $FCM_SERVICE_ACCOUNT)
 *
 * Usage:
 *   node scripts/send-daily-quote.mjs --title "Стих дня" --body "..." --lang ru
 *   node scripts/send-daily-quote.mjs --title "Verse" --body "..." --lang en
 *   node scripts/send-daily-quote.mjs --title "..." --body "..."        # everyone
 *   ... --dry    # build and print the message without sending
 */
import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const key = argv[i].slice(2)
    if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      args[key] = argv[++i]
    } else {
      args[key] = true
    }
  }
}

if (!args.title || !args.body) {
  console.error(
    'usage: send-daily-quote.mjs --title "..." --body "..." [--lang ru|en] [--dry]'
  )
  process.exit(2)
}

const topic =
  args.lang === 'ru' || args.lang === 'en'
    ? `daily-quote-${args.lang}`
    : 'daily-quote'

const keyPath =
  process.env.FCM_SERVICE_ACCOUNT ??
  join(homedir(), '.leela', 'fcm-service-account.json')
const sa = JSON.parse(readFileSync(keyPath, 'utf8'))

const b64url = (obj) =>
  Buffer.from(JSON.stringify(obj)).toString('base64url')

async function accessToken() {
  const now = Math.floor(Date.now() / 1000)
  const unsigned =
    b64url({ alg: 'RS256', typ: 'JWT' }) +
    '.' +
    b64url({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600
    })
  const signature = createSign('RSA-SHA256')
    .update(unsigned)
    .sign(sa.private_key, 'base64url')
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`
    })
  })
  if (!res.ok) {
    throw new Error(`token exchange failed: ${res.status} ${await res.text()}`)
  }
  return (await res.json()).access_token
}

const message = {
  message: {
    topic,
    notification: { title: args.title, body: args.body },
    apns: {
      payload: {
        aps: { sound: 'default' }
      }
    },
    data: { type: 'dailyQuote' }
  }
}

if (args.dry) {
  console.log(JSON.stringify(message, null, 2))
  console.log(`(dry run - nothing sent; topic: ${topic})`)
  process.exit(0)
}

const token = await accessToken()
const res = await fetch(
  `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(message)
  }
)
const body = await res.text()
if (!res.ok) {
  console.error(`FCM refused: ${res.status} ${body}`)
  process.exit(1)
}
console.log(`sent to topic "${topic}": ${body}`)
