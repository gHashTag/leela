import { DiceStore, OfflinePlayers, OtherPlayers } from '../store'
import auth from '@react-native-firebase/auth'
import firestore from '@react-native-firebase/firestore'
import { useEffect } from 'react'
import { banAlert } from '../constants'
import { getFireBaseRef } from '../screens/helper'

export const useGameAndProfileIsOnline = () => {
  useEffect(() => {
    if (auth().currentUser?.uid && DiceStore.online) {
      const curUid = auth().currentUser?.uid
      const unsub1 = firestore()
        .collection('Profiles')
        .where('owner', '!=', curUid)
        .onSnapshot(s => OtherPlayers.getOtherProf({ snapshot: s }))

      const unsub2 = firestore()
        .collection('Profiles')
        .where('owner', '==', curUid)
        .onSnapshot(s => s?.docs?.forEach(a => a.data().status === 'ban' && banAlert()))

      const unsub3 = getFireBaseRef(`/online/`).on('child_changed', async changed => {
        await firestore()
          .collection('Profiles')
          .where('owner', '!=', auth().currentUser?.uid)
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
  }, [])
}
