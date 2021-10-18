import { Auth } from 'aws-amplify'
import { captureException } from '../constants'
import {
  DiceStore,
  actionPlayerOne,
  actionPlayerTwo,
  actionPlayerThree,
  actionPlayerFour,
  actionPlayerFive,
  actionPlayerSix,
  actionsDice
} from '../store'

export const _onPressReset = async (navigation): Promise<void> => {
  try {
    actionPlayerOne.resetGame()
    actionPlayerTwo.resetGame()
    actionPlayerThree.resetGame()
    actionPlayerFour.resetGame()
    actionPlayerFive.resetGame()
    actionPlayerSix.resetGame()
    !DiceStore.online && navigation.pop(3)
    actionsDice.setPlayers(1)
  } catch (err) {
    captureException(err)
  }
}

export const isLoggedIn = async () => {
  try {
    await Auth.currentAuthenticatedUser()
    return true
  } catch {
    return false
  }
}
