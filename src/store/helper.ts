import 'react-native-get-random-values'
import { v4 as uuidv4 } from 'uuid'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { I18n } from '../utils'
import { DiceStore, actionsDice } from './DiceStore'

interface HistoryT {
  id: string
  plan: number
  count: number
  status: string
}

interface SelfT {
  player: number
  start: boolean
  finish: boolean
  plan: number
  planPrev: number
  rate: boolean
  history: HistoryT[]
}

export const updateStep = (self: SelfT) => {
  const count = DiceStore.count
  const plan = self.plan + count
  if (count === 6) {
    actionsDice.setMessage(`${I18n.t('oneMoreThrow')}`)
  } else {
    actionsDice.setMessage(' ')
    actionsDice.changePlayer()
  }

  const obj = { id: uuidv4(), count, plan, status: 'cube' }

  if (self.start) {
    switch (true) {
      case plan > 72:
        break
      // snakes
      case plan === 72:
        self.plan = 51
        self.planPrev = 72
        self.history.push({ id: uuidv4(), count, plan: 51, status: 'snake' })
        break
      case plan === 63:
        self.plan = 2
        self.planPrev = 63
        self.history.push({ id: uuidv4(), count, plan: 2, status: 'snake' })
        break
      case plan === 61:
        self.plan = 13
        self.planPrev = 61
        self.history.push({ id: uuidv4(), count, plan: 13, status: 'snake' })
        break
      case plan === 55:
        self.plan = 3
        self.planPrev = 55
        self.history.push({ id: uuidv4(), count, plan: 3, status: 'snake' })
        break
      case plan === 52:
        self.plan = 35
        self.planPrev = 52
        self.history.push({ id: uuidv4(), count, plan: 35, status: 'snake' })
        break
      case plan === 44:
        self.plan = 9
        self.planPrev = 44
        self.history.push({ id: uuidv4(), count, plan: 44, status: 'snake' })
        break
      case plan === 29:
        self.plan = 6
        self.planPrev = 29
        self.history.push({ id: uuidv4(), count, plan: 6, status: 'snake' })
        break
      case plan === 24:
        self.plan = 7
        self.planPrev = 24
        self.history.push({ id: uuidv4(), count, plan: 7, status: 'snake' })
        break
      case plan === 16:
        self.plan = 4
        self.planPrev = 16
        self.history.push({ id: uuidv4(), count, plan: 4, status: 'snake' })
        break
      case plan === 12:
        self.plan = 8
        self.planPrev = 12
        self.history.push({ id: uuidv4(), count, plan: 8, status: 'snake' })
        break
      // arrows
      case plan === 10:
        self.plan = 23
        self.planPrev = 10
        self.history.push({ id: uuidv4(), count, plan: 23, status: 'arrow' })
        break
      case plan === 17:
        self.plan = 69
        self.planPrev = 17
        self.history.push({ id: uuidv4(), count, plan: 69, status: 'arrow' })
        break
      case plan === 20:
        self.plan = 32
        self.planPrev = 20
        self.history.push({ id: uuidv4(), count, plan: 32, status: 'arrow' })
        break
      case plan === 22:
        self.plan = 60
        self.planPrev = 22
        self.history.push({ id: uuidv4(), count, plan: 60, status: 'arrow' })
        break
      case plan === 27:
        self.plan = 41
        self.planPrev = 27
        self.history.push({ id: uuidv4(), count, plan: 41, status: 'arrow' })
        break
      case plan === 28:
        self.plan = 50
        self.planPrev = 28
        self.history.push({ id: uuidv4(), count, plan: 50, status: 'arrow' })
        break
      case plan === 37:
        self.plan = 66
        self.planPrev = 37
        self.history.push({ id: uuidv4(), count, plan: 66, status: 'arrow' })
        break
      case plan === 45:
        self.plan = 67
        self.planPrev = 45
        self.history.push({ id: uuidv4(), count, plan: 67, status: 'arrow' })
        break
      case plan === 46:
        self.plan = 62
        self.planPrev = 46
        self.history.push({ id: uuidv4(), count, plan: 62, status: 'arrow' })
        break
      case plan === 54:
        DiceStore.finishArr = DiceStore.finishArr.map((x: boolean, index: number) =>
          index === self.player - 1 ? (x = false) : x
        )
        self.start = false
        self.finish = true
        self.plan = 68
        self.planPrev = 54
        self.history.push({ id: uuidv4(), count, plan: 68, status: 'liberation' })
        break
      // final
      case plan === 68:
        DiceStore.finishArr = DiceStore.finishArr.map((x: boolean, index: number) =>
          index === self.player - 1 ? (x = false) : x
        )
        self.plan = 68
        self.start = false
        self.finish = true
        self.history.push({ id: uuidv4(), count, plan: 68, status: 'liberation' })
        actionsDice.setMessage('liberation')
        break
      default: {
        self.planPrev = self.plan
        self.plan = count + self.planPrev
        self.history.push(obj)
      }
    }
  } else {
    if (count === 6 && !self.finish) {
      self.start = true
      self.plan = 6
      self.planPrev = 68
      self.history.push({ id: uuidv4(), count, plan: 6, status: 'cube' })
    }
  }
}

export const readStore = (name: string) => {
  return new Promise(resolve => {
    const data = AsyncStorage.getItem(name)
    resolve(data)
  })
}

export const writeStore = (name: string, content: any) => {
  return new Promise(resolve => {
    AsyncStorage.setItem(name, content)
    resolve()
  })
}
