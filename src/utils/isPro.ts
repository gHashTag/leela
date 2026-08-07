import { UserT } from '../types/types'

/**
 * Determine whether a profile should be treated as Pro.
 *
 * RevenueCat entitlements are the source of truth, but the backend also
 * marks admins and complimentary accounts with status 'Admin' or 'Free'.
 */
export const isPro = (profile?: UserT | null): boolean => {
  if (!profile) return false
  return profile.status === 'Admin' || profile.status === 'Free'
}
