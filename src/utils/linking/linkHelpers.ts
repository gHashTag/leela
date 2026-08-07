import Branch, { BranchParams } from 'react-native-branch'

import { captureException } from '../../constants'

type listenerT = (url: string) => void

export const subscribeDeepLinkUrl = async (
  listener: listenerT,
  url: string
) => {
  listener(url)
}

export const formatLink = (params?: BranchParams) => {
  const referringLink = params?.['~referring_link']
  const canonicalIdentifier = params?.$canonical_identifier
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

export async function buildReportLink(reportId: string, reportText: string) {
  try {
    const buo = await Branch.createBranchUniversalObject(
      `reply_detail/${reportId}`,
      {
        title: 'Link to plan report',
        contentDescription: reportText,
        contentMetadata: {
          customMetadata: {
            reportId
          }
        }
      }
    )
    let { url } = await buo.generateShortUrl({}, {})

    return url
  } catch (error) {
    captureException(error, 'buildReportLink')
    return 'error'
  }
}

export async function buildReferralLink(referralCode: string) {
  try {
    const buo = await Branch.createBranchUniversalObject(
      `invite/${referralCode}`,
      {
        title: 'Leela game board invite',
        contentDescription: 'Join me on the Leela game board',
        contentMetadata: {
          customMetadata: {
            referralCode
          }
        }
      }
    )
    let { url } = await buo.generateShortUrl({}, {})

    return url
  } catch (error) {
    captureException(error, 'buildReferralLink')
    return 'error'
  }
}
