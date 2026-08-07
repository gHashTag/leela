import {
  clearSessionHealth,
  loadSessionHealth,
  markSessionCrashed,
  markSessionStarted
} from './sessionHealth'

describe('sessionHealth', () => {
  beforeEach(async () => {
    await clearSessionHealth()
  })

  it('defaults to unknown status when nothing is stored', async () => {
    const health = await loadSessionHealth()
    expect(health.status).toBe('unknown')
    expect(health.startedAt).toBeLessThanOrEqual(Date.now())
  })

  it('marks a new session as ok', async () => {
    await markSessionStarted()
    const health = await loadSessionHealth()
    expect(health.status).toBe('ok')
    expect(health.startedAt).toBeGreaterThan(0)
  })

  it('marks an in-flight session as crashed', async () => {
    await markSessionStarted()
    await markSessionCrashed()
    const health = await loadSessionHealth()
    expect(health.status).toBe('crashed')
  })

  it('clears stored health data', async () => {
    await markSessionStarted()
    await clearSessionHealth()
    const health = await loadSessionHealth()
    expect(health.status).toBe('unknown')
  })
})
