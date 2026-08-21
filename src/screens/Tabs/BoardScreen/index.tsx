import React, { useEffect, useRef, useState } from 'react'

import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  StyleSheet,
  View,
  useColorScheme
} from 'react-native'
import { WebView } from 'react-native-webview'
import RNFetchBlob from 'rn-fetch-blob'
import { s, vs } from 'react-native-size-matters'

import { ButtonSimple, Space, Text } from '../../../components'
import { captureException } from '../../../constants'
import { SPACE, paletteFor } from '../../../theme'
import { streamZaiChat } from '../../../utils/aiStream'
import { useRevenueCat } from '../../../providers/RevenueCatProvider'

/**
 * The board in three dimensions.
 *
 * The same page that runs in a browser at `BOARD_URL`: one board, one set of
 * rules, one engine, drawn with three.js. Embedded rather than ported, because
 * a board drawn twice is two boards — they agree on the day they are written
 * and drift from the first change after it.
 *
 * A blank screen is what this guards against. A `WebView` that cannot reach its
 * address renders white and says nothing, which on a phone is indistinguishable
 * from an app that has broken; every failure here names the address it could
 * not reach, because "it does not work" is not a bug report and the ordinary
 * cause is simply that nothing is serving the page.
 */

/**
 * Where the board is.
 *
 * **In the app bundle, not on a network.** It used to be
 * `http://192.168.1.102:4173` — a developer's laptop on a home network. The
 * game *is* this board, so every shipped copy would have opened, failed to
 * reach that address and shown the failure screen below, for ever. That is not
 * a bug that would have been caught by testing here: on this desk the address
 * answers.
 *
 * Bundled, the game also works with no network at all, which is what a board
 * game should do. `ios/add_board.rb` puts the built page in as a *folder*
 * reference so `assets/` keeps its shape, and `vite.config.ts` sets
 * `base: './'` so `index.html` looks for it beside itself rather than at the
 * root of the phone's filesystem.
 *
 * To move a board change into the app:
 *
 *     cd apps/webgl && npx vite build
 *     cp -R dist ../../leela-src/leela/ios/board   # then rebuild the app
 *
 * There is deliberately no dev-server branch. A path that only ships is a path
 * nobody runs, and this one had been wrong for the whole of development.
 */
const BOARD_DIR = `file://${RNFetchBlob.fs.dirs.MainBundleDir}/board`
export const BOARD_URL = `${BOARD_DIR}/index.html`

/**
 * Everything in one place.
 *
 * There is no server. The board asks *this screen* for an answer, and this
 * screen calls the model with `streamZaiChat` - the client the app has always
 * had, key from `.env`, reasoning and text streamed back as they arrive.
 *
 * The alternative was a deployed proxy, and it was tried: it worked, and it
 * meant the companion stopped the moment a machine somewhere was shut. A game
 * you install should not have an owner who can turn it off.
 *
 * What this costs, plainly: the key ships inside the app, where somebody
 * determined can pull it out of the package. A key on a server cannot be taken
 * that way. That is the trade this design makes.
 *
 * Two things happen to be true and are worth keeping true: the model is reached
 * over HTTPS, and nothing else in the game needs a network at all - the die,
 * the path and every plane's text are in the bundle.
 */

/**
 * A JSON value, safe to paste into injected JavaScript.
 *
 * `JSON.stringify` leaves U+2028 and U+2029 unescaped: legal inside a JSON
 * string, and a line terminator inside a JavaScript one. A model that emits
 * either - and a model quoting scripture across scripts will - would end the
 * statement mid-string and the injection would throw where nobody is looking.
 */
const asScript = (value: unknown): string =>
  JSON.stringify(value)
    // Written as escapes, not as the characters themselves: a literal U+2028
    // inside a regular expression is a line terminator there too, and the
    // first attempt at this line would not parse.
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

/*
 * The four colours this screen used to spell out - white, a dim grey, paper and
 * night - are `src/theme` now.
 *
 * They were written here because the app had no palette that answered to a
 * scheme: the failure text used the app's `dimGray`, a grey measured for pale
 * paper, on black, and the sentence naming the unreachable address came out
 * barely legible. That is the same defect the board's own comments record three
 * times, and copying the values by hand into a second file was how it happened
 * a fourth.
 */

export const BoardScreen: React.FC = () => {
  const { t } = useTranslation()
  const navigation = useNavigation<any>()
  const { user } = useRevenueCat()
  /*
   * What is behind the board while the page is still loading.
   *
   * The page decides its own light from `prefers-color-scheme`, which is this
   * same setting, so asking the phone the same question is what makes the two
   * agree. Not a guarantee: a player who chose light on a dark phone has a
   * stored preference the page honours and this cannot see, so they still meet
   * one dark frame.
   */
  const dark = useColorScheme() === 'dark'
  const palette = paletteFor(dark)
  const ground = palette.bg
  const webRef = useRef<WebView>(null)

  /*
   * Three throws free, then the board asks — and the app is the only side that
   * can answer.
   *
   * The entitlement has to be true *before the first frame*, or a paying player
   * meets a paywall for as long as the page takes to start. So it is injected
   * ahead of the content and injected again whenever it changes; the board reads
   * it strictly — anything that is not exactly `true` is not a receipt.
   *
   * The rule itself lives in `toll.ts` on the board's side, where the throws are
   * counted from the saved game rather than from a variable a reload would
   * clear.
   */
  const pro = user?.pro === true
  const entitle = (yes: boolean) =>
    `window.__leelaPro = ${yes ? 'true' : 'false'}; ` +
    `window.dispatchEvent(new Event('leela:entitlement')); true;`

  /**
   * One piece of an answer, handed back to the page.
   *
   * The board installs `__leelaAskEvent` on load and routes each part to the
   * question that asked for it, by id - so a second question sent before the
   * first finishes does not collect the first one's sentences.
   */
  const deliver = (part: Record<string, unknown>) => {
    webRef.current?.injectJavaScript(
      `window.__leelaAskEvent && window.__leelaAskEvent(${asScript(part)}); true;`
    )
  }

  /**
   * Answer a question the board asked.
   *
   * Errors are delivered rather than thrown: the board's companion treats a
   * refusal as its supported offline mode and says so on screen, which is the
   * behaviour a player should meet when a key is missing or a train goes into a
   * tunnel. Throwing here would leave the thinking dots turning for ever.
   */
  const answer = async (id: string, system: string, question: string) => {
    try {
      await streamZaiChat(
        {
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: question }
          ],
          // Room for the thinking *and* the answer: with reasoning enabled both
          // are spent from one budget, and a long think has left this model with
          // nothing to say at smaller numbers.
          maxTokens: 16000,
          temperature: 0.6,
          thinking: { type: 'enabled' }
        },
        {
          onReasoning: (chunk) => deliver({ id, thinking: chunk }),
          onContent: (chunk) => deliver({ id, text: chunk })
        }
      )
      deliver({ id, done: true })
    } catch (error) {
      captureException(error, 'BoardScreen.answer')
      deliver({ id, error: String(error) })
    }
  }

  useEffect(() => {
    // Only after the page exists: before that, the value below goes in with the
    // document itself.
    webRef.current?.injectJavaScript(entitle(pro))
  }, [pro])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState<string | null>(null)

  const retry = () => {
    setFailed(null)
    setLoading(true)
    webRef.current?.reload()
  }

  /*
   * No title bar over it, and no tab bar under it.
   *
   * `AppContainer` drew a header reading "Board 3D" above a page whose own
   * header already says which plan you are standing on and how far along you
   * are - the same fact twice, in the band of screen a phone has least of. The
   * page reads `env(safe-area-inset-top)` itself, so the notch is its business
   * and giving it the whole screen is not giving it the notch as well.
   */
  return (
    <View style={[styles.screen, { backgroundColor: ground }]}>
      {failed === null ? (
        <WebView
          ref={webRef}
          source={{ uri: BOARD_URL }}
          style={[styles.web, { backgroundColor: ground }]}
          // The board is a canvas. Letting the page scroll slides it under
          // the finger that is trying to turn the camera.
          scrollEnabled={false}
          bounces={false}
          originWhitelist={['*']}
          javaScriptEnabled
          /*
           * Reading its own folder, and only its own folder.
           *
           * `allowingReadAccessToURL` is what lets `index.html` load
           * `assets/…` beside it: without it WKWebView grants access to the
           * single file it was handed and the page comes up blank. Scoped to
           * the board's directory rather than to the whole bundle.
           */
          allowFileAccess
          allowFileAccessFromFileURLs
          /*
           * And permission to ask somebody else.
           *
           * A `file://` page has an origin the fetch specification calls
           * `null`, and WebKit refuses to let it reach any other origin at all
           * - before CORS is even consulted, so the server's headers cannot
           * grant what the client will not attempt. Without this the guide was
           * silent and the board said, correctly and uselessly, that the
           * companion was unavailable.
           */
          allowUniversalAccessFromFileURLs
          allowingReadAccessToURL={BOARD_DIR}
          injectedJavaScriptBeforeContentLoaded={entitle(pro)}
          // The board keeps the game and the path in `localStorage`. Without
          // this, every visit is a new game.
          domStorageEnabled
          /*
           * iOS puts its own bar over the keyboard for a field inside a web
           * view: a previous-field arrow, a next-field arrow and Done. The
           * board has one field, so both arrows point at nothing, and Done
           * repeats what tapping the board already does. It is the system's
           * furniture in the middle of the game's own composer.
           */
          hideKeyboardAccessoryView
          allowsInlineMediaPlayback
          /*
           * What the board asks for.
           *
           * One kind of message so far: the player has run out of free throws
           * and pressed the button. The board cannot sell anything - a receipt
           * is native - so it says the player asked and this side owns the
           * screen and the transaction.
           *
           * Everything is doubted: a message from a page is a string that
           * arrived, and the page is developed and reloaded independently of
           * this app. Anything unreadable is ignored rather than crashed on.
           */
          onMessage={({ nativeEvent }) => {
            let told: {
              what?: unknown
              id?: unknown
              system?: unknown
              question?: unknown
            } | null = null
            try {
              told = JSON.parse(nativeEvent.data)
            } catch {
              return
            }
            if (told?.what === 'subscribe') {
              navigation.navigate('SUBSCRIPTION_SCREEN')
              return
            }
            /*
             * A question for the model.
             *
             * Every field is checked before use. This is a message from a page,
             * and the page is developed and reloaded independently of the app;
             * a malformed one should be ignored rather than crash the screen or
             * be passed to the model as `undefined`.
             */
            if (
              told?.what === 'ask' &&
              typeof told.id === 'string' &&
              typeof told.system === 'string' &&
              typeof told.question === 'string' &&
              told.question.trim() !== ''
            ) {
              void answer(told.id, told.system, told.question)
            }
          }}
          onLoadEnd={() => setLoading(false)}
          onError={({ nativeEvent }) => {
            captureException(
              new Error(
                nativeEvent.description || 'the board could not be loaded'
              ),
              'BoardScreen'
            )
            setLoading(false)
            setFailed(nativeEvent.description || 'unreachable')
          }}
          onHttpError={({ nativeEvent }) => {
            setLoading(false)
            setFailed(`HTTP ${nativeEvent.statusCode}`)
          }}
        />
      ) : (
        <View style={styles.problem}>
          <Text
            h="h4"
            oneColor={palette.text}
            textStyle={styles.centered}
            title={
              t('board.unreachable') || 'The 3D board could not be reached.'
            }
          />
          <Space height={vs(8)} />
          {/* The address, because the usual cause is that nothing is serving it. */}
          <Text
            h="h6"
            oneColor={palette.hint}
            textStyle={styles.centered}
            title={BOARD_URL}
          />
          <Space height={vs(6)} />
          <Text
            h="h6"
            oneColor={palette.hint}
            textStyle={styles.centered}
            title={failed}
          />
          <Space height={vs(20)} />
          <ButtonSimple
            h="h5"
            title={t('board.retry') || 'Try again'}
            onPress={retry}
          />
        </View>
      )}

      {loading && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="large" />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  /**
   * The whole screen, edge to edge: the page inside draws its own margins, and
   * reads the safe-area insets itself.
   *
   * One view, not two. Dropping `AppContainer` left a wrapper and a child both
   * saying `flex: 1` around the same `WebView` - a box whose only content is
   * another box the same size.
   */
  screen: {
    flex: 1
    // The colour is set on the element, from the palette. A literal here would
    // win on the first frame - which is the frame this exists to fix.
  },
  web: {
    flex: 1
    // Same: set on the element, so the surface under the page matches the
    // scheme the page is about to choose rather than always being night.
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center'
  },
  problem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(SPACE.lg)
  },
  centered: {
    textAlign: 'center'
  }
})
