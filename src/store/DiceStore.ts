import AsyncStorage from '@react-native-async-storage/async-storage'
import { makeAutoObservable } from 'mobx'
import { persistence, StorageAdapter } from 'mobx-persist-store'
import { writeStore, readStore } from './helper'

const DiceStore = makeAutoObservable({
  init: false,
  count: 6,
  startGame: false,
  players: 1,
  message: ' ',
  multi: 0,
  setMessage: (mess: string) => mess,
  changePlayer: () => {},
  finishArr: [] as boolean[]
})

const actionsDice = {
  random() {
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
    //console.log('DiceStore.players', DiceStore.players)
    // const arr = [true, false, true, true, true, true]
    const arr = DiceStore.finishArr
    const newArr = arr.slice(DiceStore.players, DiceStore.multi)
    //console.log('newArr', newArr)
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
  async init(): Promise<void> {
    await AsyncStorage.setItem('@init', 'true')
  }
}

persistence({
  name: 'DiceStore',
  properties: ['count', 'startGame', 'players', 'message', 'multi', 'finishArr', 'init'],
  adapter: new StorageAdapter({
    read: readStore,
    write: writeStore
  }),
  reactionOptions: {
    // optional
    delay: 200
  }
})(DiceStore)

export { DiceStore, actionsDice }
