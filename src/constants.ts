import { LEELA_ID, OPEN_AI_KEY, ZAI_PLAN } from '@env'
import DeviceInfo from 'react-native-device-info'
import { createNavigationContainerRef } from '@react-navigation/native'
import * as Sentry from '@sentry/react-native'
import axios from 'axios'
import { Alert, Dimensions, Linking, Platform } from 'react-native'
import Rate from 'react-native-rate'
import i18next from './i18n'

import { PostStore } from './store'
import {
  canRequestReview,
  markReviewRequested,
  recordPositiveAiAnswer
} from './utils/reviewPrompt'
import {
  ButtonsModalT,
  HandleCommentAiParamsT,
  MessageAIT
} from './types/types'

export const navRef = createNavigationContainerRef<any>()

export const navigate = (name: string, params?: any) => {
  if (navRef.isReady()) {
    navRef.navigate(name, params)
  }
}

const ZAI_CODING_BASE_URL = 'https://api.z.ai/api/coding/paas/v4'
const ZAI_DEFAULT_BASE_URL = 'https://api.z.ai/api/paas/v4'
const ZAI_DEFAULT_MODEL = 'glm-4.6'

export const generateComment = async ({
  message,
  systemMessage,
  planText,
  pro
}: MessageAIT): Promise<{ response: string; gpt: string }> => {
  // Z.AI Coding Plan is the only key we ship with.
  // Coding Plan keys must hit /api/coding/paas/v4; the pay-as-you-go
  // host returns error 1113, which looks like an expired key.
  const baseURL = ZAI_PLAN === 'coding' ? ZAI_CODING_BASE_URL : ZAI_DEFAULT_BASE_URL
  const model = ZAI_DEFAULT_MODEL

  try {
    const response = await axios.post(
      `${baseURL}/chat/completions`,
      {
        model,
        // **The whole reason the companion said nothing.**
        //
        // `glm-4.6` reasons before it answers, and the reasoning is billed
        // against the same `max_tokens`. Measured on a real report: 1200 of
        // 1200 completion tokens were `reasoning_tokens`, `finish_reason` came
        // back `length`, and `content` was an empty string — the model was cut
        // off mid-thought and never reached a word of its answer. What the app
        // then filed as the comment was `reasoning_content`: four thousand
        // characters of *"1. Analyze the User's Input"*, or nothing at all.
        //
        // Turned off, the same request answers in three sentences with
        // `finish_reason: stop` and no reasoning tokens at all.
        thinking: { type: 'disabled' },
        messages: [
          // The plan's text belongs to the instructions, not to a turn the
          // assistant is pretending to have taken. It was the **last** message
          // in the list and typed `assistant`, which asks the model to continue
          // its own words rather than to answer the player's.
          {
            role: 'system',
            content: `${systemMessage}\n\n${planText}`
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 1200,
        temperature: 0.1
      },
      {
        headers: {
          Authorization: `Bearer ${OPEN_AI_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const choice = response?.data?.choices?.[0]?.message
    return {
      response:
        choice?.content ||
        choice?.reasoning_content ||
        '',
      gpt: response?.data?.model ?? model
    }
  } catch (error) {
    captureException(error, 'generateComment')
    throw error
  }
}

export const onLeaveFeedback = (onAction: (success: any) => void) => {
  const options = {
    AppleAppID: '1296604457',
    GooglePackageName: 'com.leelagame',
    OtherAndroidURL:
      'https://play.google.com/store/apps/details?id=com.leelagame',
    preferInApp: true,
    openAppStoreIfInAppFails: true
  }
  Rate.rate(options, onAction)
}

export { recordPositiveAiAnswer, resetPositiveAiAnswerCount } from './utils/reviewPrompt'

export const maybeRequestReview = async () => {
  if (!(await canRequestReview())) return

  const t = i18next.t
  Alert.alert(
    t('reviewPrompt.title'),
    t('reviewPrompt.message'),
    [
      {
        text: t('reviewPrompt.later'),
        style: 'cancel'
      },
      {
        text: t('reviewPrompt.rate'),
        onPress: () => {
          onLeaveFeedback(() => markReviewRequested())
        }
      }
    ],
    { cancelable: true }
  )
}

export const handleCommentAi = async ({
  curItem,
  systemMessage,
  message,
  planText = ' ',
  pro
}: HandleCommentAiParamsT): Promise<void> => {
  const aiComment: { response: string; gpt: string } = await generateComment({
    message,
    systemMessage,
    planText,
    pro
  })
  // `aiComment` is an object and an object is always truthy, so this guard
  // asked nothing: an empty answer was filed as an empty comment.
  if (curItem && aiComment?.response?.trim()) {
    await PostStore.createComment({
      text: aiComment.response,
      postId: curItem.id,
      postOwner: curItem.ownerId,
      ownerId: LEELA_ID
    })
  }
}

export function OpenNetworkModal() {
  if (navRef.isReady()) {
    navRef.navigate('NETWORK_MODAL')
  }
}

export function OpenUpdateVersionModal() {
  if (navRef.isReady()) {
    navRef.navigate('UPDATE_VERSION_MODAL')
  }
}

export function OpenWhatsNewModal() {
  if (navRef.isReady()) {
    navRef.navigate('WHATS_NEW_MODAL')
  }
}

export function OpenExitModal() {
  if (navRef.isReady()) {
    navRef.navigate('EXIT_MODAL')
  }
}

interface VideoModalT {
  uri: string
  poster: string
}

export function OpenVideoModal({ uri, poster }: VideoModalT) {
  if (navRef.isReady()) {
    navRef.navigate('VIDEO_SCREEN', { uri, poster })
  }
}

export function OpenPlanReportModal(plan: number) {
  if (navRef.isReady()) {
    navRef.navigate('PLAN_REPORT_MODAL', { plan })
  }
}

export function OpenActionsModal(modalButtons: ButtonsModalT[]) {
  if (navRef.isReady()) {
    navRef.navigate('REPLY_MODAL', { buttons: modalButtons })
  }
}

export const banAlert = () => {
  Alert.alert(
    i18next.t('online-part.youBanned'),
    i18next.t('online-part.banText'),
    [{ text: 'OK', onPress: () => navigate('HELLO') }]
  )
}
export const accountHasBanAlert = () => {
  Alert.alert(i18next.t('online-part.accountBanned'), undefined, [
    { text: 'OK' }
  ])
}

/**
 * What an error says when it is written into a sentence.
 *
 * `${error}` on anything that is not a string gives `[object Object]`, and that
 * is what a player saw at the bottom of the sign-up screen: *On:SignUp/ My
 * Error: [object Object]*. Twelve of the callers here pass an object — a
 * Firebase exception, a fetch failure, a form's validation errors — so the one
 * message the app shows when something breaks said nothing at all.
 */
const readable = (error: any): string => {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const maybe = error.message ?? error.code
    if (typeof maybe === 'string') return maybe
    try {
      return JSON.stringify(error)
    } catch {
      return Object.prototype.toString.call(error)
    }
  }
  return String(error)
}

export const captureException = (error: any, target: string) => {
  if (!error) {
    console.log(
      '%c captureException called with messing or incorrect arguments',
      'background: #555; color: yellow'
    )
    return
  }
  console.error(`On:${target}/ My Error: ${readable(error)} `)
  if (!__DEV__) {
    Sentry.captureException(error)
  }
}

export const win = Dimensions.get('window')
export const W = win.width
export const H = win.height
export const imgH = Math.round((W * 9) / 16)
export const isIos = Platform.OS === 'ios'

export const openUrl = async (url: string) => {
  await Linking.openURL(url)
}

export const goBack = () => {
  if (navRef.isReady()) {
    navRef.goBack()
  }
}
//@ts-ignore
export const goHome = (navigation) => () => navigation.popToTop()()

export const primary = '#50E3C2'
export const secondary = '#ff06f4'
export const gray = '#949494'
export const white = '#ffffff'
export const black = '#1c1c1c'
export const dimGray = '#707070'
export const lightGray = '#D1CDCD'
export const classicRose = '#FDBEEA'
export const mustard = '#F3DE50'
export const fuchsia = '#FF06F4'
export const trueBlue = '#007ACD'
export const paleBlue = '#BEFCE5'
export const brightTurquoise = '#1EE4EC'
export const red = '#FC2847'
export const orange = '#FFB700'
export const blackOpacity = 'rgba(0, 0, 0, 0.8)'
export const grayBlackOpacity = 'rgba(139, 139, 139, 0.1)'

export const revenuecat = 'BeIMIIfptWXlouosYudFEWQDkwDvJUzv'

export const defUrl =
  'https://leelachakra.com/resource/LeelaChakra/Mantra/mantra.json'

export const ENTITLEMENT_ID = 'Pro'

export const openURLPolicy = () => {
  Linking.openURL('https://www.leelachakra.com/docs/policy').catch((error) =>
    captureException(error, 'Linking.openURL')
  )
}

export const openURLEula = () => {
  Linking.openURL('https://www.leelachakra.com/docs/eula').catch((error) =>
    captureException(error, 'Linking.openURL')
  )
}

export const bundleVersion = DeviceInfo.getVersion()
export const buildVersion = DeviceInfo.getBuildNumber()
