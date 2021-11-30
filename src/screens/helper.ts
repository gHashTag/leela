import { Auth, DataStore, SortDirection, Predicates } from 'aws-amplify'
import * as Keychain from 'react-native-keychain'
import Storage from '@aws-amplify/storage'
import { captureException } from '../constants'
import ImagePicker from 'react-native-image-crop-picker'
import { Profile, History } from '../models'
import { History as HistoryT } from '../models'
import {
  DiceStore,
  actionPlayerOne,
  actionPlayerTwo,
  actionPlayerThree,
  actionPlayerFour,
  actionPlayerFive,
  actionPlayerSix,
  actionsDice
} from '../store'

export const getCurrentUser = async () => {
  try {
    const authUser = await Auth.currentAuthenticatedUser()
    const arrProfile = await DataStore.query(Profile, c => c.email('eq', authUser.attributes.email))
    if (!arrProfile || arrProfile.length === 0) {
        return
    }
    return arrProfile[arrProfile.length - 1]
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


export const _onPressReset = async (navigation): Promise<void> => {
  try {
    actionPlayerOne.resetGame()
    actionPlayerTwo.resetGame()
    actionPlayerThree.resetGame()
    actionPlayerFour.resetGame()
    actionPlayerFive.resetGame()
    actionPlayerSix.resetGame()
    !DiceStore.online && navigation.pop(3)
    await DataStore.delete(History, Predicates.ALL)
    actionsDice.setPlayers(1)
  } catch (err) {
    captureException(err)
  }
}

export const isLoggedIn = async () => {
  try {
    await Auth.currentAuthenticatedUser()
    return true
  } catch {
    return false
  }
}

export const getImagePicker = async () => {
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

export const getIMG = async (fileName: string) => {
  return Storage.get(fileName)
}

export const uploadImg = async (image: { path: string }) => {
   const photo = await fetch(image.path)
   const photoBlob = await photo.blob()
   const fileName = photoBlob._data.name
   Storage.put(fileName, photoBlob, {
     contentType: 'image/jpeg' 
   })
   return fileName
}
