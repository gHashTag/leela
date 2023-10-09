import { ID_SENDPULSE, Leela_AI_EN, Leela_AI_RU, SECRET_SENDPULSE } from '@env'
import { Platform, NativeModules } from 'react-native'
import axios from 'axios'
import { captureException } from '../../../constants'

export const getSystemLanguage = () => {
  let languageCode = 'en' // Default to English

  if (Platform.OS === 'android') {
    languageCode = NativeModules.I18nManager.localeIdentifier
  } else if (Platform.OS === 'ios') {
    languageCode = NativeModules.SettingsManager.settings.AppleLocale
  }

  return languageCode.slice(0, 2).toLowerCase()
}

export const getToken = async () => {
  const sendpulseResponse = await axios.post(
    'https://api.sendpulse.com/oauth/access_token',
    {
      grant_type: 'client_credentials',
      client_id: ID_SENDPULSE,
      client_secret: SECRET_SENDPULSE
    }
  )
  return sendpulseResponse.data.access_token
}

export const postEmailToSendPulse = async (email: string) => {
  const lang = getSystemLanguage()

  const addressBookId = lang === 'ru' ? Leela_AI_RU : Leela_AI_EN

  const emails = [email]
  const token = await getToken()

  try {
    await axios.post(
      `https://api.sendpulse.com/addressbooks/${addressBookId}/emails`,
      { emails },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    captureException(error, 'Error posting email to SendPulse')
  }
}

export const getAddrressBook = async () => {
  const token = await getToken()

  const response = await axios.get('https://api.sendpulse.com/addressbooks', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const addressBooks = response.data

  if (addressBooks && Array.isArray(addressBooks)) {
    addressBooks.forEach((book) => {
      console.log('Address Book Name:', book.name)
      console.log('ID:', book.id)
      console.log('Total Email Quantity:', book.all_email_qty)
      console.log('Active Email Quantity:', book.active_email_qty)
      console.log('Inactive Email Quantity:', book.inactive_email_qty)
      console.log('Status:', book.status_explain)
      console.log('---')
    })
  } else {
    captureException('getAddrressBook', 'No address books found.')
  }
}
