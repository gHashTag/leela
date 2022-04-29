import 'react-native-get-random-values'
import { I18n, lang } from '../utils'
import { DiceStore, actionsDice } from './DiceStore'
import { createHistory, updatePlan, onWin, onStart } from '../screens/helper'
import { captureException, navigate } from '../constants'
import { ru } from '../screens/PlansScreen/ru'
import { en } from '../screens/PlansScreen/en'
import { OnlinePlayer, OfflinePlayers } from './'

interface historyI {
  count: number
  plan: number
  status: string
}

interface stepT {
  plan: number
  history: historyI
  stepCount: number
  id?: number
}

// ONLINE
async function upFuncOnline(step: stepT) {
  const { plan, history, stepCount } = step
  const historyObj = { ...history, createDate: Date.now() }
  try {
    await createHistory(historyObj)
    await updatePlan(plan)
    OnlinePlayer.store.history.unshift(historyObj)
    OnlinePlayer.store.plan = plan
    if (stepCount !== 6 || plan === 68) {
      const plansLang = lang === 'en' ? en : ru
      navigate('PLANS_DETAIL_SCREEN', {
        report: true,
        ...plansLang.find(a => a.id === plan)
      })
    }
    if (plan === 68) {
      actionsDice.setMessage('liberation')
      await onWin()
      OnlinePlayer.store.start = false
      OnlinePlayer.store.finish = true
    }
  } catch (err) {
    captureException(err)
  }
}

export function upStepOnline() {
  if (!OnlinePlayer.store.canGo) return
  const count = DiceStore.count
  const plan = OnlinePlayer.store.plan + count
  if (count === 6) {
    actionsDice.setMessage(`${I18n.t('oneMoreThrow')}`)
  } else {
    actionsDice.setMessage(' ')
  }
  const isFinished = OnlinePlayer.store.finish
  const isStart = OnlinePlayer.store.start
  function handleStart() {
    OnlinePlayer.store.start = true
    onStart()
  }
  const step = entities({ isFinished, plan, isStart, stepCount: count, handleStart })
  if (step) {
    upFuncOnline(step)
  }
}

// OFFLINE
const upFuncOffline = async (step: stepT): Promise<void> => {
  const { plan, history, id } = step

  const historyObj = { ...history, createDate: Date.now() }
  if (id !== undefined) {
    OfflinePlayers.store.histories[id].unshift(historyObj)
    OfflinePlayers.store.plans[id] = plan
    if (plan === 68) {
      DiceStore.finishArr = DiceStore.finishArr.map((x: boolean, index: number) =>
        index === id ? (x = false) : x
      )
      actionsDice.setMessage('liberation')
      OfflinePlayers.store.start[id] = false
      OfflinePlayers.store.finish[id] = true
    }
  }
}

export const upStepOffline = (id: number) => {
  const count = DiceStore.count
  const plan = OfflinePlayers.store.plans[id] + count
  if (count === 6) {
    actionsDice.setMessage(`${I18n.t('oneMoreThrow')}`)
  } else {
    actionsDice.setMessage(' ')
    actionsDice.changePlayer()
  }
  const isFinished = OfflinePlayers.store.finish[id]
  const isStart = OfflinePlayers.store.start[id]
  function handleStart() {
    OfflinePlayers.store.start[id] = true
  }
  const step = entities({ isFinished, plan, isStart, stepCount: count, handleStart })
  if (step) {
    upFuncOffline({ ...step, id })
  }
}

interface entitiesT {
  plan: number
  stepCount: number
  isFinished: boolean
  isStart: boolean
  handleStart: () => void
}

const entities = ({ plan, stepCount, isFinished, isStart, handleStart }: entitiesT) => {
  if (isStart) {
    const lib = { count: stepCount, plan: 68, status: 'liberation' }
    switch (true) {
      case plan > 72:
        return undefined
      // snakes
      case plan === 72:
        const obj51 = { count: stepCount, plan: 51, status: 'snake' }
        return { plan: 51, history: obj51, stepCount }
      case plan === 63:
        const obj2 = { count: stepCount, plan: 2, status: 'snake' }
        return { plan: 2, history: obj2, stepCount }
      case plan === 61:
        const obj13 = { count: stepCount, plan: 13, status: 'snake' }
        return { plan: 13, history: obj13, stepCount }
      case plan === 55:
        const obj3 = { count: stepCount, plan: 3, status: 'snake' }
        return { plan: 3, history: obj3, stepCount }
      case plan === 52:
        const obj35 = { count: stepCount, plan: 35, status: 'snake' }
        return { plan: 35, history: obj35, stepCount }
      case plan === 44:
        const obj9 = { count: stepCount, plan: 9, status: 'snake' }
        return { plan: 9, history: obj9, stepCount }
      case plan === 29:
        const obj6 = { count: stepCount, plan: 6, status: 'snake' }
        return { plan: 6, history: obj6, stepCount }
      case plan === 24:
        const obj7 = { count: stepCount, plan: 7, status: 'snake' }
        return { plan: 7, history: obj7, stepCount }
      case plan === 16:
        const obj4 = { count: stepCount, plan: 4, status: 'snake' }
        return { plan: 4, history: obj4, stepCount }
      case plan === 12:
        const obj8 = { count: stepCount, plan: 8, status: 'snake' }
        return { plan: 8, history: obj8, stepCount }
      // arrows
      case plan === 10:
        const obj23 = { count: stepCount, plan: 23, status: 'arrow' }
        return { plan: 23, history: obj23, stepCount }
      case plan === 17:
        const obj69 = { count: stepCount, plan: 69, status: 'arrow' }
        return { plan: 69, history: obj69, stepCount }
      case plan === 20:
        const obj32 = { count: stepCount, plan: 32, status: 'arrow' }
        return { plan: 32, history: obj32, stepCount }
      case plan === 22:
        const obj60 = { count: stepCount, plan: 60, status: 'arrow' }
        return { plan: 60, history: obj60, stepCount }
      case plan === 27:
        const obj41 = { count: stepCount, plan: 41, status: 'arrow' }
        return { plan: 41, history: obj41, stepCount }
      case plan === 28:
        const obj50 = { count: stepCount, plan: 50, status: 'arrow' }
        return { plan: 50, history: obj50, stepCount }
      case plan === 37:
        const obj66 = { count: stepCount, plan: 66, status: 'arrow' }
        return { plan: 66, history: obj66, stepCount }
      case plan === 45:
        const obj67 = { count: stepCount, plan: 67, status: 'arrow' }
        return { plan: 67, history: obj67, stepCount }
      case plan === 46:
        const obj62 = { count: stepCount, plan: 62, status: 'arrow' }
        return { plan: 62, history: obj62, stepCount }
      // final
      case plan === 54:
        return { plan: 68, history: lib, stepCount }
      case plan === 68:
        return { plan: 68, history: lib, stepCount }
      default: {
        const obj = { count: stepCount, plan, status: 'cube' }
        return { plan: plan, history: obj, stepCount }
      }
    }
  } else if (stepCount === 6 && !isFinished) {
    const obj6 = { count: stepCount, plan: 6, status: 'cube' }

    handleStart()
    return { plan: 6, history: obj6, stepCount }
  }
}
