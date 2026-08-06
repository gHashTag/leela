import { STEP_ANYTIME } from '@env'
import { useEffect } from 'react'

import { OnlinePlayer } from '../store'

export const useLeftTimeForStep = () => {
  useEffect(() => {
    const interval = setInterval(() => {
      const currentDate = Date.now()
      OnlinePlayer.store.timeText = OnlinePlayer.getLeftTime(
        OnlinePlayer.store.stepTime
      )
      // A development build may step whenever it likes.
      //
      // The game gives one step a day, which is the point of it — and it also
      // means anything downstream of a step cannot be looked at without waiting
      // out the clock. `__DEV__` decides this alone: the release build has
      // neither the branch nor any way to reach it.
      if (__DEV__ && STEP_ANYTIME === 'true') {
        OnlinePlayer.store.canGo = true
      } else if (
        currentDate - OnlinePlayer.store.stepTime >= 86400000 &&
        OnlinePlayer.store.stepTime !== 0
      ) {
        OnlinePlayer.store.canGo = true
      } else {
        OnlinePlayer.store.canGo = false
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])
}
