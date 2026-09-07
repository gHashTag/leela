import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Shape validation is a release preflight, not proof that remote auth works. */
export function validateFirebaseConfig(config) {
  const p = config ?? {}
  const errors = []
  const key = typeof p.API_KEY === 'string' ? p.API_KEY : ''
  if (!/^A[A-Za-z0-9_-]{38}$/.test(key) || new Set(key).size < 10) errors.push('invalid_api_key')
  if (p.BUNDLE_ID !== 'xyz.ghashtag.dharma') errors.push('wrong_bundle_id')
  if (typeof p.PROJECT_ID !== 'string' || !p.PROJECT_ID.trim()) errors.push('missing_project_id')
  if (typeof p.GOOGLE_APP_ID !== 'string' || !/^1:\d+:ios:[a-f0-9]+$/i.test(p.GOOGLE_APP_ID)) errors.push('invalid_google_app_id')
  return errors
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const file = process.argv[2] ?? 'ios/GoogleService-Info.plist'
    const config = JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
    const errors = validateFirebaseConfig(config)
    console.log(JSON.stringify({ status: errors.length ? 'FAIL' : 'PASS', checks: 'Firebase release configuration', errors }))
    process.exitCode = errors.length ? 1 : 0
  } catch {
    console.error('Firebase release configuration unavailable or unreadable; no values logged')
    process.exitCode = 1
  }
}
