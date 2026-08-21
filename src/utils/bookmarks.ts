import AsyncStorage from '@react-native-async-storage/async-storage'
import { captureException } from '../constants'

const STORAGE_KEY = '@bookmarks'

export type BookmarkType = 'post' | 'comment'

export interface BookmarkT {
  id: string
  type: BookmarkType
  postId: string
  commentId?: string
  text: string
  plan?: number
  ownerName?: string
  savedAt: number
}

export const loadBookmarks = async (): Promise<BookmarkT[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch (error) {
    captureException(error, 'loadBookmarks')
  }
  return []
}

export const saveBookmarks = async (bookmarks: BookmarkT[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks))
  } catch (error) {
    captureException(error, 'saveBookmarks')
  }
}

export const isBookmarked = async (id: string): Promise<boolean> => {
  const bookmarks = await loadBookmarks()
  return bookmarks.some((b) => b.id === id)
}

export const addBookmark = async (bookmark: BookmarkT): Promise<void> => {
  const bookmarks = await loadBookmarks()
  const filtered = bookmarks.filter((b) => b.id !== bookmark.id)
  await saveBookmarks([bookmark, ...filtered])
}

export const removeBookmark = async (id: string): Promise<void> => {
  const bookmarks = await loadBookmarks()
  await saveBookmarks(bookmarks.filter((b) => b.id !== id))
}

export const toggleBookmark = async (bookmark: BookmarkT): Promise<boolean> => {
  const bookmarks = await loadBookmarks()
  const exists = bookmarks.some((b) => b.id === bookmark.id)
  if (exists) {
    await saveBookmarks(bookmarks.filter((b) => b.id !== bookmark.id))
    return false
  }
  await saveBookmarks([bookmark, ...bookmarks])
  return true
}
