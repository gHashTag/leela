import { captureException, timeStampType } from '../constants'
import ImagePicker from 'react-native-image-crop-picker'
import { UserT, HistoryT } from '../types'
import { OnlinePlayer } from '../store'
import storage from '@react-native-firebase/storage'
import { nanoid } from 'nanoid/non-secure'
import auth from '@react-native-firebase/auth'
import firestore from '@react-native-firebase/firestore'
import {
  firebase,
  FirebaseDatabaseTypes
} from '@react-native-firebase/database'
import { lang } from '../utils'
import I18n from 'i18n-js'

interface NewProfileI {
  email: string
  uid: string
  firstName: string
  lastName: string
}

//firebase help

const getFireBaseRef = (path: string): FirebaseDatabaseTypes.Reference => {
  return firebase
    .app()
    .database(
      'https://leela-chakra-default-rtdb.europe-west1.firebasedatabase.app/'
    )
    .ref(path)
}

// Profile operations

const getProfile = async (): Promise<UserT | undefined> => {
  const userUid = auth().currentUser?.uid
  let res = undefined
  await firestore()
    .collection('Profiles')
    .doc(userUid)
    .get()
    .then(querySnap => {
      res = querySnap.data()
    })
    .catch(err => {
      console.log(`getProfile`, err)
      captureException(err)
    })
  return res
}

const onWin = async () => {
  const userUid = auth().currentUser?.uid
  firestore().collection('Profiles').doc(userUid).update({
    firstGame: false,
    finish: true,
    start: false
  })
}

const onStart = async () => {
  const userUid = auth().currentUser?.uid
  firestore().collection('Profiles').doc(userUid).update({
    start: true
  })
}

const createProfile = async ({
  email,
  uid,
  firstName,
  lastName
}: NewProfileI) => {
  const hisObj: HistoryT[] = [
    {
      count: 0,
      plan: 68,
      status: 'start',
      createDate: Date.now()
    }
  ]
  await firestore()
    .collection('Profiles')
    .doc(uid)
    .set({
      email,
      owner: uid,
      firstName,
      lastName,
      plan: 68,
      lastStepTime: Date.now() - 86400000,
      start: false,
      finish: false,
      firstGame: true,
      history: hisObj,
      lang
    })
  // тут не все
  OnlinePlayer.store = {
    ...OnlinePlayer.store,
    plan: 68,
    profile: {
      firstName,
      lastName,
      email
    },
    stepTime: Date.now() - 86400000,
    canGo: true,
    history: hisObj,
    start: false,
    finish: false,
    firstGame: true
  }
}

const updatePlan = async (plan: number) => {
  const userUid = auth().currentUser?.uid
  if (userUid) {
    await firestore()
      .collection('Profiles')
      .doc(userUid)
      .update({
        plan
      })
      .catch(err => captureException(err))
  }
}

const resetPlayer = async () => {
  const userUid = auth().currentUser?.uid
  await firestore()
    .collection('Profiles')
    .doc(userUid)
    .update({
      start: false,
      finish: false
    })
    .catch(err => captureException(err))
}

interface profNameI {
  firstName: string
  lastName: string
}
const updateProfName = async ({ firstName, lastName }: profNameI) => {
  try {
    await auth().currentUser?.updateProfile({
      displayName: `${firstName} ${lastName}`
    })
    await firestore()
      .collection('Profiles')
      .doc(auth().currentUser?.uid)
      .update({
        firstName,
        lastName
      })
    await auth().currentUser?.reload()
    OnlinePlayer.store.profile.firstName = firstName
    OnlinePlayer.store.profile.lastName = lastName
  } catch (err) {
    captureException(err)
  }
}

const isLoggedIn = async () => {
  if (auth().currentUser) {
    return true
  } else {
    return false
  }
}

const resetHistory = async () => {
  const userUid = auth().currentUser?.uid
  const hist: HistoryT[] = [
    {
      createDate: Date.now(),
      plan: 68,
      count: 0,
      status: 'start'
    }
  ]
  await firestore().collection('Profiles').doc(userUid).update({
    history: hist
  })
}

// const _onPressReset = async (navigation: any): Promise<void> => {
//   try {
//     !DiceStore.online && navigation.pop(3)
//     actionPlayers.resetGame()
//     actionsDice.setPlayers(1)
//   } catch (err) {
//     captureException(err)
//   }
// }

// History operations

const createHistory = async (values: HistoryT) => {
  try {
    const userUid = auth().currentUser?.uid
    if (userUid) {
      if (values.count !== 6) {
        OnlinePlayer.store.canGo = false
        OnlinePlayer.store.stepTime = Date.now()
        await firestore()
          .collection('Profiles')
          .doc(userUid)
          .update({
            lastStepTime: Date.now(),
            history: firestore.FieldValue.arrayUnion(values)
          })
      } else {
        await firestore()
          .collection('Profiles')
          .doc(userUid)
          .update({
            history: firestore.FieldValue.arrayUnion(values)
          })
      }
    }
  } catch (err) {
    captureException(err)
  }
}

// Image operations

const getImagePicker = async () => {
  const image = await ImagePicker.openPicker({
    width: 100,
    height: 100,
    cropping: true,
    cropperCircleOverlay: true,
    sortOrder: 'none',
    compressImageMaxWidth: 200,
    compressImageMaxHeight: 200,
    compressImageQuality: 1,
    compressVideoPreset: 'MediumQuality',
    includeExif: true,
    cropperStatusBarColor: 'white',
    cropperToolbarColor: 'white',
    cropperActiveWidgetColor: 'white',
    cropperToolbarWidgetColor: '#3498DB'
  })
  return image
}

const getIMG = async (fileName: string) => {
  return await storage().ref(fileName).getDownloadURL()
}

const uploadImg = async (image: { path: string }) => {
  const photo = await fetch(image.path)
  const photoBlob = await photo.blob()
  const fileName = `images/${nanoid(7)}${image.path.substring(
    image.path.lastIndexOf('/') + 1
  )}`
  const reference = storage().ref(fileName)
  await reference.put(photoBlob)
  return fileName
}

function getUid() {
  return auth().currentUser?.uid
}

interface getTimeT {
  lastTime: number
  type?: 0 | 1
}

function getTimeStamp({ lastTime, type = 0 }: getTimeT) {
  const dateNow = Date.now()
  let date: Date = new Date(lastTime)

  const day = 86400000
  const difference = dateNow - lastTime

  if (difference <= 20000) {
    return I18n.t(timeStampType[type].now)
  } else if (difference <= day) {
    return I18n.t(timeStampType[type].today)
  } else if (difference <= day * 2) {
    return I18n.t(timeStampType[type].yesterday)
  } else if (difference <= 30 * day) {
    const days = Math.floor(difference / day)
    return `${days}${I18n.t(timeStampType[type].days)}`
  } else if (difference < 12 * 30 * day) {
    const month = Math.floor(difference / (day * 30))
    return `${month}${I18n.t(timeStampType[type].month)}`
  } else {
    return `${date.getHours()}:${date.getMinutes()} · ${date.getDate()}/${date.getMonth()}/${date
      .getFullYear()
      .toString()
      .substr(2, 2)}`
  }
}

export {
  uploadImg,
  updatePlan,
  updateProfName,
  getIMG,
  getImagePicker,
  getProfile,
  createHistory,
  createProfile,
  isLoggedIn,
  resetHistory,
  getFireBaseRef,
  onWin,
  onStart,
  resetPlayer,
  getTimeStamp,
  getUid
}
