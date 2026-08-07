import { PostT } from '../types/types'

export type PostFeedFilter = 'newest' | 'mostDiscussed' | 'myPosts'

export const filterPosts = (
  posts: PostT[],
  filter: PostFeedFilter,
  uid: string | null
): PostT[] => {
  let result = [...posts]

  if (filter === 'myPosts' && uid) {
    result = result.filter((a) => a.ownerId === uid)
  }

  if (filter === 'mostDiscussed') {
    result = result.sort((a, b) => {
      const aCount = a.comments?.length ?? 0
      const bCount = b.comments?.length ?? 0
      if (aCount !== bCount) return bCount - aCount
      return (b.createTime ?? 0) - (a.createTime ?? 0)
    })
  }

  // 'newest' defaults to createTime desc, which fetchPosts already applies.
  return result
}

export const countPostsForFilter = (
  posts: PostT[],
  filter: PostFeedFilter,
  uid: string | null
): number => {
  if (filter === 'myPosts' && uid) {
    return posts.filter((a) => a.ownerId === uid).length
  }
  return posts.length
}
