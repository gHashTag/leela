import AsyncStorage from '@react-native-async-storage/async-storage'
import { Alert } from 'react-native'
import { waitFor } from '@testing-library/react-native'
import { hasAIConsent, requestAIConsent, revokeAIConsent } from './aiConsent'

describe('AI data sharing consent', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
    jest.restoreAllMocks()
  })

  it('waits for explicit permission and remembers a refusal without nagging', async () => {
    const alert = jest.spyOn(Alert, 'alert')
    const result = requestAIConsent()
    await waitFor(() => expect(alert).toHaveBeenCalled())
    expect(alert).toHaveBeenCalledTimes(1)
    expect(await hasAIConsent()).toBe(false)
    alert.mock.calls[0][2]?.[0].onPress?.()
    expect(await result).toBe(false)
    expect(await requestAIConsent()).toBe(false)
    expect(alert).toHaveBeenCalledTimes(1)
  })

  it('can allow from Settings, then revoke before any subsequent request', async () => {
    await revokeAIConsent()
    const alert = jest.spyOn(Alert, 'alert')
    const result = requestAIConsent(true)
    await waitFor(() => expect(alert).toHaveBeenCalled())
    alert.mock.calls[0][2]?.[1].onPress?.()
    expect(await result).toBe(true)
    expect(await hasAIConsent()).toBe(true)
    await revokeAIConsent()
    expect(await requestAIConsent()).toBe(false)
  })

  it('does not let a pending prompt override a later revocation', async () => {
    const alert = jest.spyOn(Alert, 'alert')
    const result = requestAIConsent()
    await waitFor(() => expect(alert).toHaveBeenCalled())
    await revokeAIConsent()
    alert.mock.calls[0][2]?.[1].onPress?.()
    expect(await result).toBe(false)
    expect(await hasAIConsent()).toBe(false)
  })

  it('rejects a stale stored grant returned after revocation completed', async () => {
    let finishRead!: (value: string) => void
    ;(AsyncStorage.getItem as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRead = resolve
        })
    )
    const result = requestAIConsent()
    await revokeAIConsent()
    finishRead('allowed')
    expect(await result).toBe(false)
    expect(await hasAIConsent()).toBe(false)
  })

  it('serializes revoke after an in-flight grant write and never grants that request', async () => {
    const alert = jest.spyOn(Alert, 'alert')
    const originalWrite = (
      AsyncStorage.setItem as jest.Mock
    ).getMockImplementation()!
    let finishWrite!: () => void
    ;(AsyncStorage.setItem as jest.Mock).mockImplementationOnce(
      (key, val) =>
        new Promise<void>((resolve) => {
          finishWrite = () => {
            originalWrite(key, val)
            resolve()
          }
        })
    )
    const result = requestAIConsent()
    await waitFor(() => expect(alert).toHaveBeenCalled())
    alert.mock.calls[0][2]?.[1].onPress?.()
    await waitFor(() => expect(finishWrite).toBeDefined())
    const revoked = revokeAIConsent()
    finishWrite()
    await revoked
    expect(await result).toBe(false)
    expect(await hasAIConsent()).toBe(false)
  })
})
import { it } from '@jest/globals'
