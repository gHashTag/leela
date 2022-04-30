import { makeAutoObservable } from 'mobx'
import { captureException } from '../constants'
import { getIMG, getFireBaseRef } from '../screens/helper'
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore'
import { OtherUsersT, UserT } from '../types'

interface storeI {
  players: OtherUsersT[]
  online: OtherUsersT[]
}

interface GetOtherI {
  snapshot?: FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>
}

export const OtherPlayers = {
  store: makeAutoObservable<storeI>({
    players: [],
    online: []
  }),
  getOtherProf: async ({ snapshot }: GetOtherI) => {
    if (snapshot) {
      const otherData: any = await Promise.all(
        snapshot.docs.map(async (a, id) => {
          if (a.exists) {
            const data: UserT = a.data() as UserT
            let isOnline = false
            await getFireBaseRef(`/online/${data.owner}`)
              .once('value')
              .then(async snapshot => {
                isOnline = snapshot.val()
              })
              .catch(err => captureException(err))
            const result: OtherUsersT = {
              email: data.email,
              plan: data.plan,
              firstName: data.firstName,
              lastName: data.lastName,
              avatar: data.avatar ? await getIMG(data.avatar) : '',
              owner: data.owner,
              isOnline
            }
            return result
          }
        })
      )
      if (otherData) {
        OtherPlayers.store.players = otherData.filter((a: any) => a !== undefined)
      }
      OtherPlayers.getOnlineProf()
    }
  },
  getOnlineProf: async () => {
    if (OtherPlayers.store.players.length > 0) {
      OtherPlayers.store.online = OtherPlayers.store.players.filter(a => a.isOnline)
    }
  }
}
