import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth'
import {
  FirebaseDatabaseTypes,
  firebase
} from '@react-native-firebase/database'
import firestore from '@react-native-firebase/firestore'
import storage from '@react-native-firebase/storage'
import { nanoid } from 'nanoid/non-secure'
import ImagePicker from 'react-native-image-crop-picker'
import semver from 'semver'
import {
  OpenPlanReportModal,
  OpenUpdateVersionModal,
  accountHasBanAlert,
  captureException,
  navigate
} from 'src/constants'
import i18next, { flagEmoji, lang } from 'src/i18n'
import {
  MessagingStore,
  OnlinePlayer,
  actionsDice,
  fetchBusinesses
} from 'src/store'
import { HistoryT, UserT } from 'src/types'

import { version } from '../../package.json'

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
  let res
  try {
    const response = await firestore().collection('Profiles').doc(userUid).get()
    res = response.data() as UserT
  } catch (err) {
    captureException(err, 'getProfile')
  }
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
      lang,
      flagEmoji,
      isReported: true
    })
  OnlinePlayer.store = {
    ...OnlinePlayer.store,
    plan: 68,
    profile: {
      firstName,
      lastName,
      email,
      intention: ''
    },
    stepTime: Date.now() - 86400000,
    canGo: true,
    history: hisObj,
    start: false,
    finish: false,
    firstGame: true
  }
}

const updateFlagEmojiIfNeed = async () => {
  const userUid = auth().currentUser?.uid
  if (OnlinePlayer.store.flagEmoji !== flagEmoji) {
    await firestore().collection('Profiles').doc(userUid).update({ flagEmoji })
    OnlinePlayer.store.flagEmoji = flagEmoji
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
      .catch((err) => captureException(err))
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
    .catch((err) => captureException(err))
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
    await firestore().collection('Profiles').doc(getUid()).update({
      firstName,
      lastName
    })
    await auth().currentUser?.reload()
    OnlinePlayer.store.profile.firstName = firstName
    OnlinePlayer.store.profile.lastName = lastName
  } catch (err) {
    captureException(err, 'updateProfName')
  }
}
const updateIntention = async (newIntention: string) => {
  try {
    await firestore().collection('Profiles').doc(getUid()).update({
      intention: newIntention
    })
    OnlinePlayer.store.profile.intention = newIntention
  } catch (err) {
    captureException(err, 'updateIntention')
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

const createHistory = async (values: HistoryT) => {
  try {
    const userUid = auth().currentUser?.uid
    if (userUid) {
      if (values.count !== 6) {
        OnlinePlayer.store.canGo = false
        OnlinePlayer.store.isReported = false
        await firestore()
          .collection('Profiles')
          .doc(userUid)
          .update({
            isReported: false,
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
    captureException(err, 'createHistory')
  }
}

const startStepTimer = () => {
  const newTime = Date.now()
  OnlinePlayer.store.stepTime = newTime
  OnlinePlayer.store.isReported = true
  const userUid = getUid()
  if (userUid) {
    firestore().collection('Profiles').doc(userUid).update({
      lastStepTime: newTime,
      isReported: true
    })
  }
}

// Image operations

const getImagePicker = async () => {
  const image = await ImagePicker.openPicker({
    width: 400,
    height: 400,
    cropping: true,
    cropperCircleOverlay: true,
    sortOrder: 'none',
    compressImageMaxWidth: 400,
    compressImageMaxHeight: 400,
    compressImageQuality: 1,
    compressVideoPreset: 'HighestQuality',
    includeExif: true,
    cropperStatusBarColor: 'white',
    cropperToolbarColor: 'white',
    cropperActiveWidgetColor: 'white',
    cropperToolbarWidgetColor: '#3498DB'
  })
  return image
}

const getIMG = async (fileName?: string) => {
  const defaultImg = require('../../assets/defaultImage/defaultProfileImage.png')
  if (fileName) {
    try {
      return await storage().ref(fileName).getDownloadURL()
    } catch (error) {
      return defaultImg
    }
  } else {
    return defaultImg
  }
}

const uploadImg = async (image: { path: string }) => {
  const photo = await fetch(image.path)
  const photoBlob = await photo.blob()
  const fileName = `images/${nanoid(13)}${image.path.substring(
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
  type?: '' | '-short'
}

function getTimeStamp({ lastTime, type = '' }: getTimeT) {
  const dateNow = Date.now()
  let date: Date = new Date(lastTime)

  const day = 86400000
  const difference = dateNow - lastTime

  if (difference <= 20000) {
    return i18next.t(`timestamps${type}.now`)
  } else if (difference <= day) {
    return i18next.t(`timestamps${type}.today`)
  } else if (difference <= day * 2) {
    return i18next.t(`timestamps${type}.yday`)
  } else if (difference <= 30 * day) {
    const days = Math.floor(difference / day)
    return `${days}${i18next.t(`timestamps${type}.d`)}`
  } else if (difference < 12 * 30 * day) {
    const month = Math.floor(difference / (day * 30))
    return `${month}${i18next.t(`timestamps${type}.m`)}`
  } else {
    return `${date.getHours()}:${date.getMinutes()} · ${date.getDate()}/${date.getMonth()}/${date
      .getFullYear()
      .toString()
      .substr(2, 2)}`
  }
}

const onSignIn = async (
  user: FirebaseAuthTypes.User,
  isKeychain?: boolean,
  linkTo?: any
) => {
  try {
    actionsDice.setOnline(true)
    if (user.emailVerified) {
      const prof = await getProfile()
      if (prof?.status === 'ban') {
        !isKeychain && accountHasBanAlert()
        return
      }
      if (!prof?.firstGame && !prof?.lastName) {
        navigate('SIGN_UP_USERNAME', { email: user.email })
      } else if (!prof.avatar) {
        navigate('SIGN_UP_AVATAR')
      } else if (!prof.intention) {
        navigate('CHANGE_INTENTION_SCREEN', {
          blockGoBack: true,
          title: i18next.t('online-part.createIntention')
        })
      } else {
        navigate('MAIN', { screen: 'TAB_BOTTOM_0' })
        if (!prof.isReported) {
          OpenPlanReportModal(prof.plan)
        } else if (MessagingStore.path) {
          linkTo(MessagingStore.path)
          MessagingStore.path = ''
        }
        const reference = getFireBaseRef(`/online/${prof.owner}`)
        reference.set(true)
        reference.onDisconnect().set(false)
        OnlinePlayer.getProfile()
        fetchBusinesses()
      }
    } else {
      navigate('CONFIRM_SIGN_UP', {
        email: user.email
      })
    }
  } catch (error) {
    captureException(error, 'onSignIn')
  }
}

const checkVersion = async (minVersion: string) => {
  if (semver.lt(version, minVersion)) {
    OpenUpdateVersionModal()
  }
}

export {
  updateFlagEmojiIfNeed,
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
  getUid,
  startStepTimer,
  onSignIn,
  checkVersion,
  updateIntention
}
