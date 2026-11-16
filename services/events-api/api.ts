// Leela marketplace events API — stage A host.
// Pure decisions per specs/t27os/events_market.t27 (the same rules, ported):
// fail-closed listing, kinds 1..4, statuses 1 live / 2 cancelled, phases,
// newer-wins dedup by id, feed caps (news 20, events 200).
// Outward: /health, /api/events, /api/news. Nothing else leaves the host.
import { createServer } from 'node:http'
import { Pool } from 'pg'

const pool = new Pool({
  host: 'leela-events-db',
  port: 5432,
  user: process.env.POSTGRES_USER ?? 'leela',
  password: process.env.POSTGRES_PASSWORD ?? '',
  database: process.env.POSTGRES_DB ?? 'leela_events',
})

const KIND_OK = new Set([1, 2, 3, 4])
const STATUS_LIVE = 1
const STATUS_CANCELLED = 2
const STATUS_OK = new Set([STATUS_LIVE, STATUS_CANCELLED])
const NEWS_FEED_CAP = 20
const EVENTS_MAX = 200

const timesOk = (s: number, e: number): boolean => s > 0 && e > 0 && s < e
const phase = (s: number, e: number, now: number): number =>
  now < s ? 0 : now < e ? 1 : 2

const cors = (res: any): void => {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS')
  res.setHeader('access-control-max-age', '86400')
}

async function listedEvents(): Promise<any[]> {
  const rows = await pool.query(
    'SELECT id, kind, title, location, starts_ms, ends_ms, updated_ms, status FROM events'
  )
  const now = Date.now()
  // newer-wins dedup by id: keep the row with the highest updated_ms
  const byId = new Map<string, any>()
  for (const r of rows.rows) {
    const prev = byId.get(r.id)
    if (!prev || Number(r.updated_ms) > Number(prev.updated_ms)) byId.set(r.id, r)
  }
  const listed = [...byId.values()]
    .filter((r) => {
      if (!KIND_OK.has(Number(r.kind))) return false
      if (!STATUS_OK.has(Number(r.status))) return false
      if (Number(r.status) === STATUS_CANCELLED) return false
      return timesOk(Number(r.starts_ms), Number(r.ends_ms))
    })
    .filter((r) => phase(Number(r.starts_ms), Number(r.ends_ms), now) !== 2)
    .sort((a, b) => Number(a.starts_ms) - Number(b.starts_ms))
    .slice(0, EVENTS_MAX)
  return listed.map((r) => ({
    id: r.id,
    kind: Number(r.kind),
    title: r.title,
    location: r.location,
    starts_ms: Number(r.starts_ms),
    ends_ms: Number(r.ends_ms),
    updated_ms: Number(r.updated_ms),
  }))
}

async function listedNews(): Promise<any[]> {
  const rows = await pool.query(
    'SELECT id, title, created_ms, updated_ms, status FROM news'
  )
  const byId = new Map<string, any>()
  for (const r of rows.rows) {
    const prev = byId.get(r.id)
    if (!prev || Number(r.updated_ms) > Number(prev.updated_ms)) byId.set(r.id, r)
  }
  return [...byId.values()]
    .filter((r) => Number(r.status) === STATUS_LIVE)
    .sort((a, b) => Number(b.updated_ms) - Number(a.updated_ms))
    .slice(0, NEWS_FEED_CAP)
    .map((r) => ({
      id: r.id,
      title: r.title,
      created_ms: Number(r.created_ms),
      updated_ms: Number(r.updated_ms),
    }))
}

const server = createServer(async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  const url = new URL(req.url ?? '/', 'http://localhost')
  try {
    if (url.pathname === '/health') {
      await pool.query('SELECT 1')
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok' }))
      return
    }
    if (req.method === 'GET' && url.pathname === '/api/events') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ events: await listedEvents() }))
      return
    }
    if (req.method === 'GET' && url.pathname === '/api/news') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ news: await listedNews() }))
      return
    }
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'no such route' }))
  } catch {
    // fail closed: an internal error never leaks internals to the caller
    res.writeHead(503, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'unavailable' }))
  }
})

server.listen(Number(process.env.PORT ?? 8080), '0.0.0.0')
