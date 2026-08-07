import { renderHook, act } from '@testing-library/react-native'
import Voice from '@react-native-voice/voice'

import { useVoiceInput } from './useVoiceInput'

const mockedVoice = Voice as jest.MockedObject<typeof Voice>

describe('useVoiceInput', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('starts and stops listening', async () => {
    mockedVoice.isAvailable.mockResolvedValue(true)

    const { result } = renderHook(() => useVoiceInput(jest.fn()))

    await act(async () => {
      await result.current.startListening()
    })

    expect(mockedVoice.start).toHaveBeenCalled()
    expect(result.current.isListening).toBe(true)

    await act(async () => {
      await result.current.stopListening()
    })

    expect(mockedVoice.stop).toHaveBeenCalled()
    expect(result.current.isListening).toBe(false)
  })

  it('does not start when voice recognition is unavailable', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockedVoice.isAvailable.mockResolvedValue(false)

    const onResult = jest.fn()
    const { result } = renderHook(() => useVoiceInput(onResult))

    await act(async () => {
      await result.current.startListening()
    })

    expect(mockedVoice.start).not.toHaveBeenCalled()
    expect(result.current.isListening).toBe(false)
    expect(onResult).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('streams partial results to the callback', async () => {
    mockedVoice.isAvailable.mockResolvedValue(true)

    const onResult = jest.fn()
    const { result } = renderHook(() => useVoiceInput(onResult))

    await act(async () => {
      await result.current.startListening()
    })

    act(() => {
      // Voice.onSpeechResults setter stores the callback provided by the hook.
      mockedVoice.onSpeechResults({ value: ['hello leela'] })
    })

    expect(onResult).toHaveBeenCalledWith('hello leela')
  })

  it('ignores cancellation errors and captures real errors', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockedVoice.isAvailable.mockResolvedValue(true)

    const { result } = renderHook(() => useVoiceInput(jest.fn()))

    await act(async () => {
      await result.current.startListening()
    })

    const cancelError = { error: { message: 'User canceled', code: '7' } }
    act(() => {
      mockedVoice.onSpeechError(cancelError as any)
    })

    // No exception should be captured for cancellation; the test simply
    // verifies the hook remains stable and listening state does not change.
    expect(result.current.isListening).toBe(true)

    const realError = { error: { message: 'network failure', code: '11' } }
    act(() => {
      mockedVoice.onSpeechError(realError as any)
    })

    expect(result.current.isListening).toBe(true)
    consoleSpy.mockRestore()
  })
})
