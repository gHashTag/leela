import test from 'node:test'
import assert from 'node:assert/strict'
import { validateFirebaseConfig } from './check-ios-firebase.mjs'

const valid = {
  API_KEY: 'A' + 'bcdefghijklmnopqrstuvwxyz0123456789ABCD01'.slice(0, 38),
  BUNDLE_ID: 'xyz.ghashtag.dharma',
  PROJECT_ID: 'example-project',
  GOOGLE_APP_ID: '1:123456789:ios:abcdef0123456789'
}

test('accepts complete matching native Firebase config', () => {
  assert.deepEqual(validateFirebaseConfig(valid), [])
})
test('rejects placeholder without returning configuration values', () => {
  const errors = validateFirebaseConfig({ API_KEY: 'placeholder', BUNDLE_ID: valid.BUNDLE_ID })
  assert.deepEqual(errors, ['invalid_api_key', 'missing_project_id', 'invalid_google_app_id'])
  assert.ok(!JSON.stringify(errors).includes('placeholder'))
})
test('rejects wrong application and low-entropy fake key', () => {
  assert.deepEqual(validateFirebaseConfig({ ...valid, BUNDLE_ID: 'wrong.app' }), ['wrong_bundle_id'])
  assert.deepEqual(validateFirebaseConfig({ ...valid, API_KEY: 'A'.repeat(39) }), ['invalid_api_key'])
})
test('missing config is rejected without throwing or leaking', () => {
  assert.equal(validateFirebaseConfig(null).length, 4)
})
