import Sound from 'react-native-sound'

import { captureException } from '../constants'
import { loadSoundEnabled } from './soundSettings'

Sound.setCategory('Ambient', true)

let diceSound: Sound | null = null
let planeSound: Sound | null = null

const getDiceSound = (): Sound | null => diceSound
const getPlaneSound = (): Sound | null => planeSound

const playSound = async (soundGetter: () => Sound | null, fallback?: () => void) => {
  const enabled = await loadSoundEnabled()
  if (!enabled) return

  let sound = soundGetter()
  if (!sound) {
    fallback?.()
    return
  }

  sound.getCurrentTime((seconds) => {
    if (seconds > 0) {
      sound?.setCurrentTime(0)
    }
  })

  sound.play((success) => {
    if (!success) {
      captureException(new Error('sound playback failed'), 'playSound')
    }
  })
}

export const playDiceSound = () => playSound(getDiceSound)
export const playPlaneSound = () => playSound(getPlaneSound)

export const setDiceSound = (sound: Sound) => {
  diceSound = sound
}

export const setPlaneSound = (sound: Sound) => {
  planeSound = sound
}
