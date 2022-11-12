import { useEffect } from 'react'

import auth from '@react-native-firebase/auth'
import firestore from '@react-native-firebase/firestore'

import { banAlert } from '../constants'
import { getFireBaseRef, getUid } from '../screens/helper'
import { DiceStore, OfflinePlayers, OtherPlayers } from '../store'

export const useGameAndProfileIsOnline = () => {
  useEffect(() => {
    const curUid = getUid()
    if (curUid && DiceStore.online) {
      const unsub1 = firestore()
        .collection('Profiles')
        .where('owner', '!=', curUid)
        .onSnapshot(s => OtherPlayers.getOtherProf({ snapshot: s }))

      const unsub2 = firestore()
        .collection('Profiles')
        .where('owner', '==', curUid)
        .onSnapshot(s => s?.docs?.forEach(a => a.data().status === 'ban' && banAlert()))

      const unsub3 = getFireBaseRef('/online/').on('child_changed', async changed => {
        firestore()
          .collection('Profiles')
          .where('owner', '!=', curUid)
          .get()
          .then(queryS => {
            OtherPlayers.getOtherProf({ snapshot: queryS })
          })
      })
      return () => {
        unsub1()
        unsub2()
        getFireBaseRef('/online/').off('child_changed', unsub3)
      }
    } else if (!DiceStore.online) {
      OfflinePlayers.startGame()
    }
  }, [DiceStore.online])
}
