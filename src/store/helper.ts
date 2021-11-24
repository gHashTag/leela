import 'react-native-get-random-values'
import { v4 as uuidv4 } from 'uuid'
import { useNavigation } from '@react-navigation/native'
import { Auth, DataStore, SortDirection } from 'aws-amplify'
import * as Keychain from 'react-native-keychain'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { I18n } from '../utils'
import { DiceStore, actionsDice } from './DiceStore'
import { captureException } from '../constants'
import { SelfT, UserT, } from '../types'
import { Profile, History } from '../models'
import { History as HistoryT } from '../models'

export const getCurrentUser = async () => {
  try {
    const authUser = await Auth.currentAuthenticatedUser()
    const arrProfile = await DataStore.query(Profile, c => c.email('eq', authUser.attributes.email))
    if (!arrProfile || arrProfile.length === 0) {
        return
    }
    return arrProfile[0]
  } catch (error) {
    captureException(error)
  }

}


export const createHistory = async (values: HistoryT) => {
  try {
    const { id } = await getCurrentUser() 
    await DataStore.save(new History({ ...values, historyID: id }))
  } catch (err) {
    console.log(`err`, err)
    captureException(err)
  }
}

export const getHistory = async () => {
  try {
    const { id } = await getCurrentUser() 
    const history = (await DataStore.query(History, c => c.historyID("eq", id), {
      sort: s => s.createdAt(SortDirection.DESCENDING),
      limit: 10 
    }))
    return history
  } catch (err) {
    console.log(`err`, err)
    captureException(err)
  }
}

export const updatePlan = async (plan: number) => {
  try {
    const credentials = await Keychain.getInternetCredentials('auth')

    if (credentials) {
      const { username } = credentials
      const original = await DataStore.query(Profile, c => c.email('eq', username))
      if (original) {
        await DataStore.save(
          Profile.copyOf(original[0], updated => {
            updated.plan = plan
          })
        )
      }
    }
  } catch (err) {
    captureException(err)
  }
}

export const updateProfile = async ({ id, firstName, lastName }: UserT) => {
  try {
    const original = await DataStore.query(Profile, id)
    if (original) {
      await DataStore.save(
        Profile.copyOf(original, updated => {
          updated.firstName = firstName
          updated.lastName = lastName
        })
      )
    }
  } catch (err) {
    captureException(err)
  }
}

export const updateAvatar = async ({ id, avatar }: UserT) => {
  try {
    const original = await DataStore.query(Profile, id)
    if (original) {
      await DataStore.save(
        Profile.copyOf(original, updated => {
          updated.avatar = avatar
        })
      )
    }
  } catch (err) {
    console.log(`error`, error)
    captureException(err)
  }
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

  const lib = { id: uuidv4(), count, plan: 68, status: 'liberation' }

  if (self.start) {
    switch (true) {
      case plan > 72:
        break
      // snakes
      case plan === 72:
        const obj51 = { id: uuidv4(), count, plan: 51, status: 'snake' }
        self.plan = 51
        self.planPrev = 72
        self.history.push(obj51)
        updatePlan(51)
        createHistory(obj51)
        break
      case plan === 63:
        const obj2 = { id: uuidv4(), count, plan: 2, status: 'snake' }
        self.plan = 2
        self.planPrev = 63
        self.history.push(obj2)
        updatePlan(2)
        createHistory(obj2)
        break
      case plan === 61:
        const obj13 = { id: uuidv4(), count, plan: 13, status: 'snake' }
        self.plan = 13
        self.planPrev = 61
        self.history.push(obj13)
        updatePlan(13)
        createHistory(obj13)
        break
      case plan === 55:
        const obj3 = { id: uuidv4(), count, plan: 3, status: 'snake' }
        self.plan = 3
        self.planPrev = 55
        self.history.push(obj3)
        updatePlan(3)
        createHistory(obj3)
        break
      case plan === 52:
        const obj35 = { id: uuidv4(), count, plan: 35, status: 'snake' }
        self.plan = 35
        self.planPrev = 52
        self.history.push(obj35)
        updatePlan(35)
        createHistory(obj35)
        break
      case plan === 44:
        const obj44 = { id: uuidv4(), count, plan: 9, status: 'snake' }
        self.plan = 9
        self.planPrev = 44
        self.history.push(obj44)
        updatePlan(9)
        createHistory(obj44)
        break
      case plan === 29:
        const obj6 = { id: uuidv4(), count, plan: 6, status: 'snake' }
        self.plan = 6
        self.planPrev = 29
        self.history.push(obj6)
        updatePlan(6)
        createHistory(obj6)
        break
      case plan === 24:
        const obj7 = { id: uuidv4(), count, plan: 7, status: 'snake' }
        self.plan = 7
        self.planPrev = 24
        self.history.push(obj7)
        updatePlan(7)
        createHistory(obj7)
        break
      case plan === 16:
        const obj4 = { id: uuidv4(), count, plan: 4, status: 'snake' }
        self.plan = 4
        self.planPrev = 16
        self.history.push(obj4)
        updatePlan(4)
        createHistory(obj4)
        break
      case plan === 12:
        const obj8 = { id: uuidv4(), count, plan: 8, status: 'snake' }
        self.plan = 8
        self.planPrev = 12
        self.history.push(obj8)
        updatePlan(8)
        createHistory(obj8)
        break
      // arrows
      case plan === 10:
        const obj23 = { id: uuidv4(), count, plan: 23, status: 'arrow' }
        self.plan = 23
        self.planPrev = 10
        self.history.push(obj23)
        updatePlan(23)
        createHistory(obj23)
        break
      case plan === 17:
        const obj69 = { id: uuidv4(), count, plan: 69, status: 'arrow' }
        self.plan = 69
        self.planPrev = 17
        self.history.push(obj69)
        updatePlan(69)
        createHistory(obj69)
        break
      case plan === 20:
        const obj32 = { id: uuidv4(), count, plan: 32, status: 'arrow' }
        self.plan = 32
        self.planPrev = 20
        self.history.push(obj32)
        updatePlan(32)
        createHistory(obj32)
        break
      case plan === 22:
        const obj60 = { id: uuidv4(), count, plan: 60, status: 'arrow' }
        self.plan = 60
        self.planPrev = 22
        self.history.push(obj60)
        updatePlan(60)
        createHistory(obj60)
        break
      case plan === 27:
        const obj41 = { id: uuidv4(), count, plan: 41, status: 'arrow' }
        self.plan = 41
        self.planPrev = 27
        self.history.push(obj41)
        updatePlan(41)
        createHistory(obj41)
        break
      case plan === 28:
        const obj50 = { id: uuidv4(), count, plan: 50, status: 'arrow' }
        self.plan = 50
        self.planPrev = 28
        self.history.push(obj50)
        updatePlan(50)
        createHistory(obj50)
        break
      case plan === 37:
        const obj66 = { id: uuidv4(), count, plan: 66, status: 'arrow' }
        self.plan = 66
        self.planPrev = 37
        self.history.push(obj66)
        updatePlan(66)
        createHistory(obj66)
        break
      case plan === 45:
        const obj67 = { id: uuidv4(), count, plan: 67, status: 'arrow' }
        self.plan = 67
        self.planPrev = 45
        self.history.push(obj67)
        updatePlan(67)
        createHistory(obj67)
        break
      case plan === 46:
        const obj62 = { id: uuidv4(), count, plan: 62, status: 'arrow' }
        self.plan = 62
        self.planPrev = 46
        self.history.push(obj62)
        updatePlan(62)
        createHistory(obj62)
        break
      case plan === 54:
        DiceStore.finishArr = DiceStore.finishArr.map((x: boolean, index: number) =>
          index === self.player - 1 ? (x = false) : x
        )
        self.start = false
        self.finish = true
        self.plan = 68
        self.planPrev = 54
        self.history.push(lib)
        updatePlan(68)
        createHistory(lib)
        break
      // final
      case plan === 68:
        DiceStore.finishArr = DiceStore.finishArr.map((x: boolean, index: number) =>
          index === self.player - 1 ? (x = false) : x
        )
        self.plan = 68
        self.start = false
        self.finish = true
        self.history.push(lib)
        DiceStore.startGame = true
        updatePlan(68)
        createHistory(lib)
        actionsDice.setMessage('liberation')
        break
      default: {
        const obj = { id: uuidv4(), count, plan, status: 'cube' }
        self.planPrev = self.plan
        self.plan = count + self.planPrev
        self.history.push(obj)
        updatePlan(count + self.planPrev)
        createHistory(obj)
      }
    }
  } else {
    if (count === 6 && !self.finish) {
      const obj6 = { id: uuidv4(), count, plan: 6, status: 'cube' }
      self.start = true
      self.plan = 6
      self.planPrev = 68
      self.history.push(obj6)
      updatePlan(6)
      createHistory(obj6)
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
