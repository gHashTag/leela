import { lazyScreen } from '../components/LazyScreen'

// Lazy-load AI/report screens so their heavy dependencies (AI streaming,
// gifted chat, report composer) are not evaluated until first navigation.

export const LazyChatScreen = lazyScreen(() =>
  import('../screens/Tabs/ChatScreen').then((mod) => mod.ChatScreen)
)

export const LazyPlanReportModal = lazyScreen(() =>
  import('../screens/Modals/PlanReportModal').then((mod) => mod.PlanReportModal)
)

export const LazyDetailPostScreen = lazyScreen(() =>
  import('../screens/DetailPostScreen').then((mod) => mod.DetailPostScreen)
)

export const LazyPostScreen = lazyScreen(() =>
  import('../screens/Tabs/PostScreen').then((mod) => mod.PostScreen)
)
