import NetInfo from '@react-native-community/netinfo'
import { useEffect } from 'react'

import { captureException } from '../constants'
import { loadQueuedPosts, replayQueuedPost } from '../utils/offlinePostQueue'

export const useOfflinePostRetry = () => {
  useEffect(() => {
    let isReplaying = false

    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected !== true) return
      if (isReplaying) return

      isReplaying = true
      loadQueuedPosts()
        .then(async (posts) => {
          if (!posts.length) return
          for (const post of posts) {
            try {
              await replayQueuedPost(post)
            } catch (error) {
              captureException(error, 'useOfflinePostRetry: replay')
            }
          }
        })
        .catch((error) => captureException(error, 'useOfflinePostRetry: load'))
        .finally(() => {
          isReplaying = false
        })
    })

    return unsub
  }, [])
}
