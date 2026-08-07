import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  addBookmark,
  BookmarkT,
  isBookmarked,
  loadBookmarks,
  removeBookmark,
  toggleBookmark
} from './bookmarks'

const postBookmark = (id: string): BookmarkT => ({
  id,
  type: 'post',
  postId: id,
  text: 'Report text',
  plan: 12,
  ownerName: 'Player',
  savedAt: Date.now()
})

beforeEach(() => {
  AsyncStorage.clear()
})

describe('bookmarks', () => {
  it('loads empty bookmarks by default', async () => {
    expect(await loadBookmarks()).toEqual([])
  })

  it('adds a bookmark', async () => {
    await addBookmark(postBookmark('p1'))
    const bookmarks = await loadBookmarks()
    expect(bookmarks).toHaveLength(1)
    expect(bookmarks[0].id).toBe('p1')
  })

  it('replaces an existing bookmark with the same id', async () => {
    await addBookmark(postBookmark('p1'))
    const updated = { ...postBookmark('p1'), text: 'Updated' }
    await addBookmark(updated)
    const bookmarks = await loadBookmarks()
    expect(bookmarks).toHaveLength(1)
    expect(bookmarks[0].text).toBe('Updated')
  })

  it('removes a bookmark', async () => {
    await addBookmark(postBookmark('p1'))
    await removeBookmark('p1')
    expect(await loadBookmarks()).toEqual([])
  })

  it('reports whether a bookmark exists', async () => {
    expect(await isBookmarked('p1')).toBe(false)
    await addBookmark(postBookmark('p1'))
    expect(await isBookmarked('p1')).toBe(true)
  })

  it('toggles a bookmark on and off', async () => {
    const bookmark = postBookmark('p1')
    expect(await toggleBookmark(bookmark)).toBe(true)
    expect(await toggleBookmark(bookmark)).toBe(false)
    expect(await loadBookmarks()).toEqual([])
  })
})
