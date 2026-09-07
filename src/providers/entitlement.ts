/** Store entitlement is valid whether the player chose the online board or not. */
export function hasProEntitlement(info: unknown): boolean {
  const active = (
    info as { entitlements?: { active?: Record<string, unknown> } } | null
  )?.entitlements?.active
  return !!active && Object.prototype.hasOwnProperty.call(active, 'pro plan')
}
