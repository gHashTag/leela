// Central registry for long-lived Firebase listeners used in the app.
// Wrapping subscriptions here makes it easier to audit leaks: every active
// listener gets an ID and must be disposed through `dispose(id)` or
// `disposeAll()`, and in __DEV__ re-registrations are logged.

type Unsubscribe = () => void

interface RegisteredListener {
  id: string
  screen: string
  unsubscribe: Unsubscribe
}

const listeners = new Map<string, RegisteredListener>()

let idCounter = 0

function makeId(screen: string): string {
  idCounter += 1
  return `${screen}#${idCounter}`
}

function logLeakWarning(id: string, screen: string) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn(
      `[listenerRegistry] Listener ${id} from ${screen} was not disposed before being overwritten`
    )
  }
}

/**
 * Register a manually-managed unsubscribe function (e.g. from an onSnapshot
 * subscription). Returns a disposal function that also removes the listener
 * from the audit registry.
 */
export function registerListener(
  screen: string,
  unsubscribe: Unsubscribe
): Unsubscribe {
  const id = makeId(screen)
  listeners.set(id, { id, screen, unsubscribe })

  return () => {
    dispose(id)
  }
}

/**
 * Dispose a single listener by id and call its unsubscribe function.
 */
export function dispose(id: string) {
  const entry = listeners.get(id)
  if (!entry) return
  try {
    entry.unsubscribe()
  } catch (error) {
    // Listener teardown should never crash the UI.
  }
  listeners.delete(id)
}

/**
 * Dispose every listener registered for a given screen.
 */
export function disposeScreen(screen: string) {
  listeners.forEach((entry) => {
    if (entry.screen === screen) {
      dispose(entry.id)
    }
  })
}

/**
 * Dispose every registered listener. Useful on logout / session reset.
 */
export function disposeAll() {
  listeners.forEach((entry) => {
    try {
      entry.unsubscribe()
    } catch (error) {
      // ignore
    }
  })
  listeners.clear()
}

/**
 * Return a snapshot of currently active listeners for debugging / logging.
 */
export function getActiveListeners(): Array<{ id: string; screen: string }> {
  return Array.from(listeners.values()).map(({ id, screen }) => ({
    id,
    screen
  }))
}

/**
 * Total count of listeners currently tracked.
 */
export function activeListenerCount(): number {
  return listeners.size
}

/**
 * Wrap a Firestore or RTDB subscription so it is tracked and cleaned up.
 * Returns an unsubscribe function that also removes the listener from the
 * registry.
 */
export function subscribeTracked(
  screen: string,
  subscribe: () => Unsubscribe
): Unsubscribe {
  const id = makeId(screen)
  const unsubscribe = subscribe()

  listeners.set(id, { id, screen, unsubscribe })

  return () => {
    dispose(id)
  }
}

if (__DEV__) {
  // Surface accidental re-registrations that overwrite an existing id.
  const originalSet = listeners.set.bind(listeners)
  listeners.set = (id, value) => {
    if (listeners.has(id)) {
      logLeakWarning(id, value.screen)
    }
    return originalSet(id, value)
  }
}
