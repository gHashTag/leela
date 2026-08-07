import AsyncStorage from '@react-native-async-storage/async-storage'

export type ReactionType = '🙏' | '❤️' | '🔥'

export const REACTIONS: ReactionType[] = ['🙏', '❤️', '🔥']

const storageKey = (postId: string, commentId?: string) =>
  commentId
    ? `@reaction_comment_${postId}_${commentId}`
    : `@reaction_post_${postId}`

export const loadReaction = async (
  postId: string,
  commentId?: string
): Promise<ReactionType | null> => {
  const value = await AsyncStorage.getItem(storageKey(postId, commentId))
  if (value && (REACTIONS as string[]).includes(value)) {
    return value as ReactionType
  }
  return null
}

export const saveReaction = async (
  postId: string,
  reaction: ReactionType | null,
  commentId?: string
): Promise<void> => {
  const key = storageKey(postId, commentId)
  if (reaction) {
    await AsyncStorage.setItem(key, reaction)
  } else {
    await AsyncStorage.removeItem(key)
  }
}
