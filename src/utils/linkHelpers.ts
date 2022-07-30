import { Linking } from 'react-native'
import Branch, { BranchParams } from 'react-native-branch'

type listenerT = (url: string) => void

export const subscribeDeepLinkUrl = async (listener: listenerT, url: string) => {
  listener(url)
}

export const formatLink = (params?: BranchParams) => {
  const referringLink = params?.['~referring_link']
  const canonicalIdentifier = params?.['$canonical_identifier']
  const nonBranchLink = params?.['+non_branch_link']

  let result = ''

  if (typeof canonicalIdentifier === 'string' && referringLink) {
    const splited = referringLink?.split('/')
    result = splited
      ?.splice(0, splited.length - 1)
      .join('/')
      .concat('/' + canonicalIdentifier)
  } else if (typeof nonBranchLink === 'string') {
    result = nonBranchLink
  }

  return result
}
