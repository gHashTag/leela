/**
 * The avatar path must not touch Firebase Storage.
 *
 * The bucket is out of quota, and this ran per player on every snapshot: 995
 * failed native calls on a single launch, enough to fill the bridge's callback
 * registry past what Hermes allows in one object, after which every tap threw.
 * These assert the calls are gone, not that the images are pretty.
 */

const mockGetDownloadURL = jest.fn()
const mockRef = jest.fn(() => ({ getDownloadURL: mockGetDownloadURL }))

jest.mock('@react-native-firebase/storage', () => ({
  __esModule: true,
  default: () => ({ ref: mockRef })
}))

const mockCaptureException = jest.fn()

jest.mock('../constants', () => ({
  captureException: mockCaptureException,
  secondary: '#ff06f4'
}))

import { getIMG } from './helper'

describe('getIMG', () => {
  beforeEach(() => {
    mockGetDownloadURL.mockReset()
    mockRef.mockReset()
    mockCaptureException.mockReset()
  })

  it('never calls the bucket for a storage path', async () => {
    await getIMG('images/avatar.png')

    expect(mockRef).not.toHaveBeenCalled()
    expect(mockGetDownloadURL).not.toHaveBeenCalled()
  })

  it('never calls the bucket however many players are on the board', async () => {
    // Stands in for a snapshot with a full board of avatars.
    for (let i = 0; i < 100; i += 1) {
      await getIMG(`images/player-${i}.png`)
    }

    expect(mockGetDownloadURL).not.toHaveBeenCalled()
  })

  it('reports nothing, so no red overlay is raised', async () => {
    await getIMG('images/avatar.png')

    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  it('returns the placeholder for a storage path', async () => {
    await expect(getIMG('images/avatar.png')).resolves.toBeDefined()
  })

  it('passes an absolute url through untouched', async () => {
    await expect(getIMG('https://cdn.example.com/a.png')).resolves.toBe(
      'https://cdn.example.com/a.png'
    )
  })

  it('trims an absolute url', async () => {
    await expect(getIMG('  https://cdn.example.com/a.png  ')).resolves.toBe(
      'https://cdn.example.com/a.png'
    )
  })

  it('accepts an uppercase scheme', async () => {
    await expect(getIMG('HTTPS://cdn.example.com/a.png')).resolves.toBe(
      'HTTPS://cdn.example.com/a.png'
    )
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty', ''],
    ['whitespace', '   ']
  ])('returns the placeholder for %s', async (_label, value) => {
    await expect(
      getIMG(value as unknown as string | undefined)
    ).resolves.toBeDefined()
  })
})
