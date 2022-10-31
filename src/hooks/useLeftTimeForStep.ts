import { useEffect } from 'react'
import { OnlinePlayer } from '../store'

export const useLeftTimeForStep = () => {
  useEffect(() => {
    const interval = setInterval(() => {
      const currentDate = Date.now()
      OnlinePlayer.store.timeText = OnlinePlayer.getLeftTime(OnlinePlayer.store.stepTime)
      if (
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
