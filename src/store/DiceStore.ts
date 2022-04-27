import AsyncStorage from '@react-native-async-storage/async-storage'
import { makeAutoObservable } from 'mobx'
import { persistence, StorageAdapter } from 'mobx-persist-store'
import { writeStore, readStore } from './helper'

const DiceStore = makeAutoObservable({
  init: false,
  online: false,
  count: 6,
  startGame: false,
  players: 1,
  message: ' ',
  multi: 0,
  rate: false,
  finishArr: [] as boolean[]
})

const actionsDice = {
  setOnline(bool: boolean): void {
    DiceStore.online = bool
  },
  random(): void {
    const getRandomNumber = () => Math.floor(Math.random() * 6) + 1
    let get = getRandomNumber()
    if (get === DiceStore.count) {
      get = getRandomNumber()
    }
    DiceStore.count = get
  },
  setPlayers(players: number): void {
    DiceStore.multi = players
    DiceStore.startGame = true
    DiceStore.finishArr = [true, true, true, true, true, true].slice(0, players)
  },
  changePlayer(): void {
    const arr = DiceStore.finishArr
    const newArr = arr.slice(DiceStore.players, DiceStore.multi)
    const lengthArray = newArr.length

    if (DiceStore.multi === DiceStore.players) {
      DiceStore.players = arr.indexOf(true) + 1
    } else if (newArr.indexOf(true) === -1) {
      DiceStore.players = arr.indexOf(true) + 1
    } else if (newArr.indexOf(true) === 0) {
      DiceStore.players = DiceStore.players + 1
    } else if (newArr.indexOf(true) === 1) {
      DiceStore.players = DiceStore.multi - lengthArray + 2
    } else if (newArr.indexOf(true) === 2) {
      DiceStore.players = DiceStore.multi - lengthArray + 3
    } else if (newArr.indexOf(true) === 3) {
      DiceStore.players = DiceStore.multi - lengthArray + 4
    } else {
      DiceStore.players = DiceStore.multi - lengthArray + 5
    }
  },
  async resetPlayer(): Promise<void> {
    DiceStore.players = 1
    DiceStore.startGame = false
    DiceStore.init = false
    DiceStore.finishArr = DiceStore.finishArr.map((x: boolean) => x === true)
    await AsyncStorage.setItem('@init', 'false')
  },
  setMessage(mess: string): void {
    DiceStore.message = mess
  },
  setRate(rate: boolean): void {
    DiceStore.rate = rate
  },
  async init(): Promise<void> {
    await AsyncStorage.setItem('@init', 'true')
  }
}

persistence({
  name: 'DiceStore',
  properties: ['count', 'startGame', 'players', 'message', 'multi', 'finishArr', 'init', 'rate', 'online'],
  adapter: new StorageAdapter({
    // @ts-expect-error
    read: readStore,
    // @ts-expect-error
    write: writeStore
  }),
  reactionOptions: {
    // optional
    delay: 200
  }
})(DiceStore)

export { DiceStore, actionsDice }
