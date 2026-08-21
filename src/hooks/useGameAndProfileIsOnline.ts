import { useEffect } from 'react'

import firestore from '@react-native-firebase/firestore'

import { banAlert } from '../constants'
import { getFireBaseRef, getUid } from '../screens/helper'
import { DiceStore, OfflinePlayers, OtherPlayers } from '../store'
import { subscribeTracked } from '../utils/listenerRegistry'

export const useGameAndProfileIsOnline = () => {
  useEffect(() => {
    const curUid = getUid()
    if (curUid && DiceStore.online) {
      const disposeOtherProfiles = subscribeTracked(
        'useGameAndProfileIsOnline',
        () =>
          firestore()
            .collection('Profiles')
            .where('owner', '!=', curUid)
            .onSnapshot((s) => OtherPlayers.getOtherProf({ snapshot: s }))
      )

      const disposeOwnProfile = subscribeTracked(
        'useGameAndProfileIsOnline',
        () =>
          firestore()
            .collection('Profiles')
            .where('owner', '==', curUid)
            .onSnapshot((s) =>
              s?.docs?.forEach((a) => a.data().status === 'ban' && banAlert())
            )
      )

      const disposeOnlineChanges = subscribeTracked(
        'useGameAndProfileIsOnline',
        () => {
          const ref = getFireBaseRef('/online/')
          const listener = ref.on('child_changed', async () => {
            firestore()
              .collection('Profiles')
              .where('owner', '!=', curUid)
              .get()
              .then((queryS) => {
                OtherPlayers.getOtherProf({ snapshot: queryS })
              })
          })
          return () => ref.off('child_changed', listener)
        }
      )

      return () => {
        disposeOtherProfiles()
        disposeOwnProfile()
        disposeOnlineChanges()
      }
    } else if (!DiceStore.online) {
      OfflinePlayers.startGame()
    }
  }, [])
}
