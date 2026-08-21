import {
  filterPosts,
  countPostsForFilter,
  PostFeedFilter
} from './postFeedFilter'

const baseDate = Date.now()

const posts = [
  {
    id: 'p1',
    ownerId: 'u1',
    comments: ['c1', 'c2'],
    createTime: baseDate - 1000
  },
  {
    id: 'p2',
    ownerId: 'u2',
    comments: ['c1', 'c2', 'c3'],
    createTime: baseDate - 2000
  },
  { id: 'p3', ownerId: 'u1', comments: [], createTime: baseDate - 3000 },
  { id: 'p4', ownerId: 'u3', comments: ['c1'], createTime: baseDate - 4000 }
] as any[]

describe('filterPosts', () => {
  it('returns posts sorted by newest by default', () => {
    const result = filterPosts(posts, 'newest', 'u1')
    expect(result.map((a) => a.id)).toEqual(['p1', 'p2', 'p3', 'p4'])
  })

  it('sorts by most discussed, breaking ties with createTime desc', () => {
    const result = filterPosts(posts, 'mostDiscussed', 'u1')
    expect(result.map((a) => a.id)).toEqual(['p2', 'p1', 'p4', 'p3'])
  })

  it('filters to my posts', () => {
    const result = filterPosts(posts, 'myPosts', 'u1')
    expect(result.map((a) => a.id)).toEqual(['p1', 'p3'])
  })

  it('returns all posts when myPosts is selected but uid is null', () => {
    const result = filterPosts(posts, 'myPosts', null)
    expect(result.map((a) => a.id)).toEqual(['p1', 'p2', 'p3', 'p4'])
  })
})

describe('countPostsForFilter', () => {
  it('counts all posts for newest/mostDiscussed', () => {
    expect(countPostsForFilter(posts, 'newest', 'u1')).toBe(4)
    expect(countPostsForFilter(posts, 'mostDiscussed', 'u1')).toBe(4)
  })

  it('counts only current user posts for myPosts', () => {
    expect(countPostsForFilter(posts, 'myPosts', 'u1')).toBe(2)
    expect(countPostsForFilter(posts, 'myPosts', 'u2')).toBe(1)
  })

  it('counts all posts when uid is null for myPosts', () => {
    expect(countPostsForFilter(posts, 'myPosts', null)).toBe(4)
  })
})
