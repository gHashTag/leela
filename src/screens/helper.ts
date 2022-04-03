import { Auth, DataStore, SortDirection, Predicates } from 'aws-amplify'
import * as Keychain from 'react-native-keychain'
import Storage from '@aws-amplify/storage'
import { captureException } from '../constants'
import ImagePicker from 'react-native-image-crop-picker'
import { Profile, History } from '../models'
import { Profile as ProfileT } from '../models'
import { UserT } from '../types'
import {
  DiceStore,
  actionPlayers,
  actionsDice,
  OnlinePlayerStore
} from '../store'

export const getCurrentUser = async (): Promise<ProfileT | undefined> => {
  try {
    const authUser = await Auth.currentAuthenticatedUser()
    const arrProfile = await DataStore.query(Profile, c => c.email('eq', authUser.attributes.email))
    if (!arrProfile || arrProfile.length === 0) {
      return 
    }
    return arrProfile[arrProfile.length - 1]
  } catch (error) {
    console.log(`err`, error)
    captureException(error)
  }

}

export const createHistory = async (values) => {
  try {
    const user = await getCurrentUser()
    if (user) {
      await DataStore.save(
        Profile.copyOf(user, updated => {
        updated.lastStepTime = Date.now().toString()
      }))
    }
    OnlinePlayerStore.canGo = false
    if (user) {
      await DataStore.save(new History({ ...values, 
        profileID: user.id, ownerProfId: user.id }))
    }
  } catch (err) {
    console.log(`err`, err)
    captureException(err)
  }
}

export const getHistory = async () => {
  try {
    const user = await getCurrentUser()
    let history: any = []
    if (user) {
      history = (await DataStore.query(History, c => c.ownerProfId('eq', user.id), {
        sort: s => s.createdAt(SortDirection.DESCENDING),
        limit: 20 
      }))
    }
    return history
  } catch (err) {
    console.log(`err`, err)
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
    !DiceStore.online && navigation.pop(3)
    if (DiceStore.online) {
      const user = await getCurrentUser() 
      user &&
      await DataStore.delete(History, c => c.ownerProfId('eq', user.id))
    }
    actionPlayers.resetGame()
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
