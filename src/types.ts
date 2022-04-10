export type RootStackParamList = {
  MAIN: undefined
  HELLO: undefined
  SIGN_UP: undefined
  SIGN_UP_USENAME: undefined
  SIGN_UP_AVATAR: undefined
  SIGN_IN: undefined
  FORGOT: { email: string }
  FORGOT_PASSWORD_SUBMIT: { email: string }
  CONFIRM_SIGN_UP: { email: string; password: string }
  SIGN_UP_USERNAME: { email: string }
  USER: undefined
  USER_EDIT: UserT
  PLAYRA_SCREEN: undefined
  TAB_BOTTOM_0: undefined
  TAB_BOTTOM_1: undefined
  TAB_BOTTOM_2: undefined
  TAB_BOTTOM_3: undefined
  RULES_SCREEN: undefined
  CHAT_SCREEN: undefined
  RULES_DETAIL_SCREEN: {
    id: number
    title: string
    content: string
    url: string
    videoUrl: string
  }
  PLANS_SCREEN: undefined
  SELECT_PLAYERS_SCREEN: undefined
  PLANS_DETAIL_SCREEN: {
    id: number
    title: string
    content: string
    url?: string
    videoUrl: string
  }
  PROFILE_SCREEN: undefined
  ONLINE_GAME_SCREEN: undefined
  RADIO_SCREEN: {
    id: number
    title: string
    content: string
    url: string
  }
}

export interface PlansT {
  id: number 
  title: string
  content: string
  url: string 
  videoUrl: string
}
export interface UserT {
  id: string
  firstName: string
  lastName: string
  email?: string
  owner?: string
}

export interface HistoryT {
  id: string
  plan: number
  count: number
  status: string
  owner: string
  createdAt: string
}

export interface SelfT {
  player: number
  start: boolean
  finish: boolean
  plan: number
  planPrev: number
  rate?: boolean
  history: HistoryT[]
}
