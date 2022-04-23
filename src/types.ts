export type RootStackParamList = {
  MAIN: undefined
  HELLO: undefined
  SIGN_UP: undefined
  SIGN_UP_USENAME: undefined
  SIGN_UP_AVATAR: undefined
  SIGN_IN: undefined
  FORGOT: { email: string }
  FORGOT_PASSWORD_SUBMIT: { email: string }
  CONFIRM_SIGN_UP: { email: string; password?: string }
  SIGN_UP_USERNAME: { email: string }
  USER: undefined
  USER_EDIT: {
    firstName: string
    lastName: string
    email: string
  }
  PLAYRA_SCREEN: undefined
  TAB_BOTTOM_0: undefined
  TAB_BOTTOM_1: undefined
  TAB_BOTTOM_2: undefined
  TAB_BOTTOM_3: undefined
  TAB_BOTTOM_4: undefined
  RULES_SCREEN: undefined
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
    report?: boolean
  }
  PROFILE_SCREEN: undefined
  ONLINE_GAME_SCREEN: undefined
  RADIO_SCREEN: {
    id: number
    title: string
    content: string
    url: string
  },
  DETAIL_POST_SCREEN: {
    item: PostT
    index: number
  },
  POST_SCREEN: undefined
}

export interface PlansT {
  id: number
  title: string
  content: string
  url: string
  videoUrl: string
}
export interface UserT {
  email: string
  finish: boolean
  firstGame: boolean
  firstName: string
  lastName: string
  lastStepTime: number
  owner: string
  plan: number
  start: boolean
  history: HistoryT[]
  avatar?: string
  lang?: string
  tokens?: string[]
}

export interface OtherUsersT {
  email: string
  firstName: string
  lastName: string
  plan: number
  owner: string
  avatar?: string
}

export interface HistoryT {
  plan: number
  count: number
  status: string
  createDate: number
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

export interface FormPostT {
  text: string
  plan: number
}

export interface PostT extends FormPostT {
  firstName: string
  lastName: string
  ownerId: string
  avatar: string
  id: string
  createTime: number
}

export interface FormCommentT {
  text: string
  postId: string
  postOwner: string
}

export interface CommentT extends FormCommentT {
  firstName: string
  lastName: string
  ownerId: string
  avatar: string
  createTime: number
}