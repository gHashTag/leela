import { PostStore } from '../store'

import {
  buildQueuedPost,
  clearQueuedPosts,
  enqueuePost,
  loadQueuedPosts,
  removeQueuedPost,
  replayQueuedPost,
  saveQueuedPosts
} from './offlinePostQueue'

jest.mock('axios', () => ({
  post: jest.fn().mockResolvedValue({
    data: {
      choices: [{ message: { content: 'AI answer' } }],
      model: 'test'
    }
  })
}))

describe('offlinePostQueue', () => {
  beforeEach(async () => {
    await clearQueuedPosts()
  })

  it('loads an empty queue by default', async () => {
    const queue = await loadQueuedPosts()
    expect(queue).toEqual([])
  })

  it('enqueues a post and loads it back', async () => {
    const post = {
      id: 'post-1',
      text: 'hello',
      plan: 5,
      createTime: 1700000000000,
      systemMessage: 'sys',
      planText: 'plan text',
      pro: false
    }
    await enqueuePost(post)
    const queue = await loadQueuedPosts()
    expect(queue).toHaveLength(1)
    expect(queue[0].id).toBe('post-1')
  })

  it('removes a queued post by id', async () => {
    const a = {
      id: 'a',
      text: 'a',
      plan: 1,
      createTime: 1,
      systemMessage: '',
      planText: '',
      pro: false
    }
    const b = {
      id: 'b',
      text: 'b',
      plan: 2,
      createTime: 2,
      systemMessage: '',
      planText: '',
      pro: false
    }
    await saveQueuedPosts([a, b])
    await removeQueuedPost('a')
    const queue = await loadQueuedPosts()
    expect(queue).toHaveLength(1)
    expect(queue[0].id).toBe('b')
  })

  it('clears the queue', async () => {
    const post = {
      id: 'c',
      text: 'c',
      plan: 3,
      createTime: 3,
      systemMessage: '',
      planText: '',
      pro: false
    }
    await enqueuePost(post)
    await clearQueuedPosts()
    const queue = await loadQueuedPosts()
    expect(queue).toEqual([])
  })

  it('builds a queued post from form data', async () => {
    const formPost = {
      text: 'offline report',
      plan: 7,
      systemMessage: 'sys',
      planText: 'plan',
      pro: true
    }
    const queued = await buildQueuedPost(formPost)
    expect(queued).not.toBeNull()
    expect(queued?.text).toBe('offline report')
    expect(queued?.plan).toBe(7)
    expect(queued?.ownerId).toBe('test-uid')
    expect(queued?.email).toBe('test@example.com')
    expect(queued?.id).toBeDefined()
    expect(queued?.createTime).toBeDefined()
  })

  it('replays a queued post and removes it on success', async () => {
    const post = {
      id: 'replay-1',
      text: 'hello',
      plan: 5,
      createTime: 1700000000000,
      systemMessage: 'sys',
      planText: 'plan text',
      pro: false,
      ownerId: 'test-uid',
      email: 'test@example.com'
    }
    await enqueuePost(post)
    ;(PostStore.savePostFromQueue as jest.Mock).mockResolvedValueOnce({
      id: 'replay-1'
    })
    ;(PostStore.createComment as jest.Mock).mockResolvedValueOnce(undefined)

    const ok = await replayQueuedPost(post)
    expect(ok).toBe(true)
    expect(PostStore.savePostFromQueue).toHaveBeenCalledWith(post)
    expect(PostStore.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'AI answer',
        postId: 'replay-1',
        postOwner: 'test-uid'
      })
    )
    const queue = await loadQueuedPosts()
    expect(queue).toHaveLength(0)
  })

  it('returns false when replay fails', async () => {
    const post = {
      id: 'replay-fail',
      text: 'hello',
      plan: 5,
      createTime: 1700000000000,
      systemMessage: 'sys',
      planText: 'plan text',
      pro: false,
      ownerId: 'test-uid',
      email: 'test@example.com'
    }
    await enqueuePost(post)
    ;(PostStore.savePostFromQueue as jest.Mock).mockRejectedValueOnce(
      new Error('network down')
    )

    const ok = await replayQueuedPost(post)
    expect(ok).toBe(false)
    const queue = await loadQueuedPosts()
    expect(queue).toHaveLength(1)
    expect(queue[0].id).toBe('replay-fail')
  })
})
