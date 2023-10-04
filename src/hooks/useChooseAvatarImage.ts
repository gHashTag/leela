import { useState } from 'react'
import { Buffer } from 'buffer'
import { NFT_STORAGE_API_KEY } from '@env'
import { captureException, secondary, white } from '../constants'
import ImagePicker from 'react-native-image-crop-picker'
import RNFetchBlob from 'rn-fetch-blob'
import { OnlinePlayer } from '../store'

// Function to get image from picker
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
    cropperStatusBarColor: white,
    cropperToolbarColor: white,
    cropperActiveWidgetColor: white,
    cropperToolbarWidgetColor: secondary
  })
  return image
}

export const useChooseAvatarImage = () => {
  // Local state to replace reactive vars
  const [ava, setAva] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const chooseAvatarImage = async () => {
    try {
      setIsLoading(true)

      const image = await getImagePicker()

      if (image) {
        const imageBytesInBase64: string = await RNFetchBlob.fs.readFile(
          image.path,
          'base64'
        )
        const bytes = Buffer.from(imageBytesInBase64, 'base64')

        const headers = {
          Accept: 'application/json',
          Authorization: `Bearer ${NFT_STORAGE_API_KEY}`
        }
        const imageUpload = await fetch('https://api.nft.storage/upload', {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'image/jpg'
          },
          body: bytes
        })

        if (imageUpload.ok) {
          const imageData = await imageUpload.json()
          const ipfsImageUrl = `https://ipfs.io/ipfs/${imageData.value.cid}`
          setAva(ipfsImageUrl)
          setIsLoading(false)
          await OnlinePlayer.uploadImage(ipfsImageUrl)
        } else {
          captureException(
            imageUpload.statusText,
            'Error uploading image to IPFS:'
          )
        }
      } else {
        captureException('No image selected.', 'useChooseAvatarImage')
      }
    } catch (error) {
      captureException(error, 'Error selecting image or uploading to IPFS:')
      setIsLoading(false)
    }
  }

  return { ava, setAva, isLoading, chooseAvatarImage }
}
