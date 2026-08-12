/**
 * An Ionicon per profile tab, keyed by the route key the profile screen uses.
 *
 * The bar carries nine tabs. Sharing the width equally gave each about 44pt,
 * which is narrower than the word "Reports" - so every label wrapped into three
 * stacked fragments ("Rep / orts") and the bar became unreadable. Icons carry
 * the meaning at that size; the label sits under them on one line, and the row
 * scrolls rather than squeezing.
 */
export const TAB_ICONS: Record<string, string> = {
  reports: 'document-text-outline',
  history: 'time-outline',
  intentionOfGame: 'compass-outline',
  bedtimeReminder: 'moon-outline',
  soundToggle: 'volume-medium-outline',
  aiPersona: 'sparkles-outline',
  aiAnswers: 'chatbubbles-outline',
  bookmarks: 'bookmark-outline',
  sessionHealth: 'pulse-outline'
}

/** Shown when a tab has no icon of its own, so the row never loses a slot. */
export const FALLBACK_TAB_ICON = 'ellipse-outline'

export const iconForTab = (key: string): string =>
  TAB_ICONS[key] ?? FALLBACK_TAB_ICON
