import { useState, useCallback } from 'react'
import { Auth, DataStore, Predicates } from 'aws-amplify'
import Storage from '@aws-amplify/storage'
import { captureException } from '../constants'
import ImagePicker from 'react-native-image-crop-picker'
import { History } from '../models'

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
    width: 80,
    height: 80,
    cropping: true,
    cropperCircleOverlay: true,
    sortOrder: 'none',
    compressImageMaxWidth: 150,
    compressImageMaxHeight: 150,
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
