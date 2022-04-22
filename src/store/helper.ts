import 'react-native-get-random-values'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { I18n, lang } from '../utils'
import { DiceStore, actionsDice } from './DiceStore'
import { PlayersStore, OnlinePlayerStore } from './PlayersStore'
import { createHistory, updatePlan, onWin } from '../screens/helper'
import { navigate } from '../constants'
import { ru } from '../screens/PlansScreen/ru'
import { en } from '../screens/PlansScreen/en'


interface historyI {
  count: number
  plan: number
  status: string
}

interface stepT {
  plan: number
  prevPlan: number
  history: historyI
  id: number
  count: number
}

const updateFunc = async (other: stepT): Promise<void> => {
  const { id, plan, prevPlan, history, count } = other
  const historyObj = { ...history, createDate: Date.now() }
  if (DiceStore.online) {
    await createHistory(history)
    await updatePlan(plan)
    OnlinePlayerStore.histories.unshift(historyObj)
    OnlinePlayerStore.plan = plan
    OnlinePlayerStore.planPrev = prevPlan
    if (count !== 6) {
      const plansLang = lang === 'en' ? en : ru
      navigate('PLANS_DETAIL_SCREEN', { report: true, ...plansLang.find(a => a.id === plan) })
    }
  } else {
    PlayersStore.histories[id].push(historyObj)
    PlayersStore.plans[id] = plan
    PlayersStore.plansPrev[id] = prevPlan
  }
  if (plan === 68) {
    if (DiceStore.online) {
      onWin()
      OnlinePlayerStore.start = false
      OnlinePlayerStore.finish = true
    } else {
      PlayersStore.start[id] = false
      PlayersStore.finish[id] = true
    }
  }
}

export const updateStep = (id: number) => {
  if (!OnlinePlayerStore.canGo && DiceStore.online) {
    return
  }
  const count = DiceStore.count
  const plan = DiceStore.online ? OnlinePlayerStore.plan + count
    : PlayersStore.plans[id] + count
  if (count === 6) {
    actionsDice.setMessage(`${I18n.t('oneMoreThrow')}`)
  } else {
    actionsDice.setMessage(' ')
    actionsDice.changePlayer()
  }

  const lib = { count, plan: 68, status: 'liberation' }
  if (DiceStore.online ? OnlinePlayerStore.start : PlayersStore.start[id]) {
    switch (true) {
      case plan > 72:
        break
      // snakes
      case plan === 72:
        const obj51 = { count, plan: 51, status: 'snake' }
        updateFunc({
          plan: 51,
          id: id,
          prevPlan: 72,
          history: obj51,
          count
        })
        break
      case plan === 63:
        const obj2 = { count, plan: 2, status: 'snake' }
        updateFunc({
          plan: 2,
          id: id,
          prevPlan: 63,
          history: obj2,
          count
        })
        break
      case plan === 61:
        const obj13 = { count, plan: 13, status: 'snake' }
        updateFunc({
          plan: 13,
          id: id,
          prevPlan: 61,
          history: obj13,
          count
        })
        break
      case plan === 55:
        const obj3 = { count, plan: 3, status: 'snake' }
        updateFunc({
          plan: 3,
          id: id,
          prevPlan: 55,
          history: obj3,
          count
        })
        break
      case plan === 52:
        const obj35 = { count, plan: 35, status: 'snake' }
        updateFunc({
          plan: 35,
          id: id,
          prevPlan: 52,
          history: obj35,
          count
        })
        break
      case plan === 44:
        const obj9 = { count, plan: 9, status: 'snake' }
        updateFunc({
          plan: 9,
          id: id,
          prevPlan: 44,
          history: obj9,
          count
        })
        break
      case plan === 29:
        const obj6 = { count, plan: 6, status: 'snake' }
        updateFunc({
          plan: 6,
          id: id,
          prevPlan: 29,
          history: obj6,
          count
        })
        break
      case plan === 24:
        const obj7 = { count, plan: 7, status: 'snake' }
        updateFunc({
          plan: 7,
          id: id,
          prevPlan: 24,
          history: obj7,
          count
        })
        break
      case plan === 16:
        const obj4 = { count, plan: 4, status: 'snake' }
        updateFunc({
          plan: 4,
          id: id,
          prevPlan: 16,
          history: obj4,
          count
        })
        break
      case plan === 12:
        const obj8 = { count, plan: 8, status: 'snake' }
        updateFunc({
          plan: 8,
          id: id,
          prevPlan: 12,
          history: obj8,
          count
        })
        break
      // arrows
      case plan === 10:
        const obj23 = { count, plan: 23, status: 'arrow' }
        updateFunc({
          plan: 23,
          id: id,
          prevPlan: 10,
          history: obj23,
          count
        })
        break
      case plan === 17:
        const obj69 = { count, plan: 69, status: 'arrow' }
        updateFunc({
          plan: 69,
          id: id,
          prevPlan: 17,
          history: obj69,
          count
        })
        break
      case plan === 20:
        const obj32 = { count, plan: 32, status: 'arrow' }
        updateFunc({
          plan: 32,
          id: id,
          prevPlan: 20,
          history: obj32,
          count
        })
        break
      case plan === 22:
        const obj60 = { count, plan: 60, status: 'arrow' }
        updateFunc({
          plan: 60,
          id: id,
          prevPlan: 22,
          history: obj60,
          count
        })
        break
      case plan === 27:
        const obj41 = { count, plan: 41, status: 'arrow' }
        updateFunc({
          plan: 41,
          id: id,
          prevPlan: 27,
          history: obj41,
          count
        })
        break
      case plan === 28:
        const obj50 = { count, plan: 50, status: 'arrow' }
        updateFunc({
          plan: 50,
          id: id,
          prevPlan: 28,
          history: obj50,
          count
        })
        break
      case plan === 37:
        const obj66 = { count, plan: 66, status: 'arrow' }
        updateFunc({
          plan: 66,
          id: id,
          prevPlan: 37,
          history: obj66,
          count
        })
        break
      case plan === 45:
        const obj67 = { count, plan: 67, status: 'arrow' }
        updateFunc({
          plan: 67,
          id: id,
          prevPlan: 45,
          history: obj67,
          count
        })
        break
      case plan === 46:
        const obj62 = { count, plan: 62, status: 'arrow' }
        updateFunc({
          plan: 62,
          id: id,
          prevPlan: 46,
          history: obj62,
          count
        })
        break
      case plan === 54:
        DiceStore.finishArr = DiceStore.finishArr.map((x: boolean, index: number) =>
          index === id ? (x = false) : x
        )
        updateFunc({
          plan: 68,
          id: id,
          prevPlan: 54,
          history: lib,
          count
        })
        break
      // final
      case plan === 68:
        if (!DiceStore.online) {
          DiceStore.finishArr = DiceStore.finishArr.map((x: boolean, index: number) =>
            index === id ? (x = false) : x
          )
        }
        updateFunc({
          plan: 68,
          id: id,
          prevPlan: DiceStore.online ? OnlinePlayerStore.plan
            : PlayersStore.plans[id],
          history: lib,
          count
        })
        DiceStore.startGame = true
        actionsDice.setMessage('liberation')
        break
      default: {
        const obj = { count, plan, status: 'cube' }
        updateFunc({
          plan: plan,
          id: id,
          prevPlan: DiceStore.online ? OnlinePlayerStore.plan
            : PlayersStore.plans[id],
          history: obj,
          count
        })
      }
    }
  } else if (count === 6 && !(DiceStore.online ? OnlinePlayerStore.finish
    : PlayersStore.finish[id])) {
    const obj6 = { count, plan: 6, status: 'cube' }
    updateFunc({
      plan: 6,
      id: id,
      prevPlan: 68,
      history: obj6,
      count
    })
    DiceStore.online ? OnlinePlayerStore.start = true :
      PlayersStore.start[id] = true
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
