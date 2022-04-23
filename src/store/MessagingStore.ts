import { useCallback } from "react"
import messaging from '@react-native-firebase/messaging'
import auth from '@react-native-firebase/auth'
import firestore from '@react-native-firebase/firestore'
import { captureException } from "../constants"

const fetchBusinesses = useCallback(() => {
    const requestUserPermission = async () => {
        const authStatus = await messaging().requestPermission()
        const enabled =
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL

        if (enabled) {
            messaging().getToken()
                .then(token => {
                    return saveTokenToDatabase(token)
                })

            return messaging().onTokenRefresh(token => {
                saveTokenToDatabase(token)
            })
        }
    }
    requestUserPermission()
}, [])

const saveTokenToDatabase = async (token: string) => {
    const userUid = auth().currentUser?.uid
    try {
        if (userUid) {
            await firestore().collection('Profiles')
                .doc(userUid).update({
                    tokens: firestore.FieldValue.arrayUnion(token)
                })
        }

    } catch (e) {
        captureException(e)
    }
}

const delTokenOnSignOut = async () => {
    const userUid = auth().currentUser?.uid
    await messaging().getToken().then(async token => {
        await firestore().collection('Profiles').doc(userUid).update({
            tokens: firestore.FieldValue.arrayRemove(token)
        })
    })

}

export { saveTokenToDatabase, fetchBusinesses, delTokenOnSignOut }