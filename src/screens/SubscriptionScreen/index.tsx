import {
  Alert,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native'
import {
  captureException,
  goBack,
  openURLEula,
  openURLPolicy
} from '../../constants'
import {
  GiftSubscriptionButton,
  Loading,
  PayWhatYouWantOption,
  ProFeatureExplainer,
  PurchaseButton,
  Space,
  Text,
  TrialTimer
} from '../../components'

import { PurchasesPackage } from 'react-native-purchases'

import { useTheme } from '@react-navigation/native'
import { ms, vs } from 'react-native-size-matters'
import { useTranslation } from 'react-i18next'

import React, { useEffect, useState } from 'react'
import Emoji from 'react-native-emoji'

import { useRevenueCat } from '../../providers/RevenueCatProvider'
import { FREE_THROWS } from '../../pricing'
import {
  RADIUS,
  SPACE,
  TOUCH,
  TYPE,
  paletteFor,
  type Palette
} from '../../theme'
import { SampleAnswerModal } from './SampleAnswerModal'
// @ts-ignore
import Ganesha from './ganesha.jpg'

/**
 * The three things a subscription actually buys, in the order they matter.
 *
 * The same keys the explainer pages through, so the page and the modal cannot
 * disagree - and the same three the code was checked against: the die keeps
 * turning past `FREE_THROWS`, the guide keeps answering, and no advertising
 * SDK is linked. The two promises removed from this list, a community feed and
 * an offline cache, had no implementation to point at.
 */
const PROMISES = ['throws', 'guide', 'noAds'] as const

const SubscriptionScreen: React.FC = () => {
  const { t } = useTranslation()

  const { packages, purchasePackage, restorePermissions, isLoading } =
    useRevenueCat()

  const [selectedPackage, setSelectedPackage] =
    useState<PurchasesPackage | null>(null)

  /**
   * One month, chosen for the player.
   *
   * Nothing was selected until somebody tapped, so the screen opened with its
   * only real control - *Buy Pro* - dimmed, and the first thing a player had to
   * work out was that the grey button was waiting on a row above it. A default
   * is not a trick here: the cheapest commitment is the honest one to preselect,
   * and the other two are one tap away.
   *
   * By `packageType` first, because that is RevenueCat's own word for it; by
   * identifier second, because this app's are named `rca_999_1m`; and the first
   * package last, so the button is never dead even if the store renames
   * everything.
   */
  useEffect(() => {
    if (selectedPackage || packages.length === 0) return

    const monthly =
      packages.find((pack) => pack.packageType === 'MONTHLY') ??
      packages.find((pack) => pack.identifier.endsWith('1m')) ??
      packages[0]

    if (monthly) setSelectedPackage(monthly)
  }, [packages, selectedPackage])
  const [showSample, setShowSample] = useState(false)
  const [showFeatureExplainer, setShowFeatureExplainer] = useState(false)

  const handlePackageSelection = (pack: PurchasesPackage) => {
    setSelectedPackage(pack)
  }

  const handlePurchase = async () => {
    if (purchasePackage && selectedPackage) {
      try {
        await purchasePackage(selectedPackage)
        goBack()
      } catch (error) {
        captureException(error, 'handlePurchase')
        Alert.alert(
          'Error',
          `There was an error processing your purchase. ${error}}`
        )
      }
    }
  }

  const onPress = () => goBack()

  const onWhyAmISeeingThis = () => {
    Alert.alert(
      t('subscriptionHelper.title'),
      t('subscriptionHelper.message'),
      [
        { text: t('subscriptionHelper.close'), style: 'cancel' },
        {
          text: t('subscriptionHelper.restore'),
          onPress: onAlreadyBought
        }
      ]
    )
  }

  const onAlreadyBought = async () => {
    try {
      if (restorePermissions) {
        await restorePermissions()
      }
    } catch (error) {
      captureException(error, 'onAlreadyBought')
      Alert.alert(
        'Error',
        `There was an error processing your purchase. ${error}}`
      )
    }
  }

  const { dark } = useTheme()

  /*
   * One palette, from `src/theme`.
   *
   * This screen used `secondary` (#ff06f4) for its borders and links and
   * `lightGray` for a selected package - names describing a colour rather than
   * a role, and neither with a counterpart in the other scheme. Next to a board
   * whose accent is green, a magenta rule reads as a different app.
   *
   * Built from `dark`, which the screen was already reading and doing nothing
   * with beyond one image.
   */
  const palette = paletteFor(dark)
  const styles = React.useMemo(() => stylesFor(palette), [palette])

  return (
    <View style={styles.root}>
      {/*
        Scrolling, because this screen no longer fits.
        It was a centred column on a fixed height: with the promises now printed
        on the page rather than hidden behind a link, and the renewal terms
        under the button, the bottom of it left the screen on a small phone -
        and what left first was the price and the way to restore a purchase.
      */}
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/*
          The photograph scrolls with the page rather than standing over it.

          Fixed above the scroll view, it cut the list of promises in half: the
          first line slid under the hands and vanished mid-word while the second
          and third stayed, which reads as a rendering fault rather than as a
          header. Full-bleed inside a padded container by cancelling that
          padding, so the image still runs edge to edge.
        */}
        <ImageBackground style={styles.poster} source={Ganesha} />
        <Text
          h="h4"
          textStyle={styles.test}
          // The allowance is interpolated, never spelled. Every language said
          // "2 reports" while the board gave three throws; `pricing.ts` is the
          // one place that knows the number now.
          title={t('descriptionSubscriptions', { count: FREE_THROWS })}
        />
        <Text
          h="h1"
          textStyle={styles.header}
          title={t('chooseSubscription')}
        />
        {/*
          The countdown is gone, and it should be.

          It said "Limited-time trial offer — ends in 16h 54m" over a deadline
          stored once per install, and **nothing happened when it ran out**:
          `trialTimer.ts` is read by one component, for display, and no price,
          plan or entitlement anywhere consults it. The urgency was real on
          screen and imaginary everywhere else, which is the definition App
          Review uses for a misleading subscription claim.

          `TrialTimer` is left in the tree with its tests. The day there is an
          offer that genuinely expires - a launch price, a seasonal discount -
          this is one line to put back, and it will be telling the truth.
        */}

        {/*
          What the money buys, on the page.

          It was one underlined link - "What is included in Pro?" - opening a
          modal a player had to page through three times. A paywall that hides
          its own offer is asking to be dismissed; the three claims are short
          enough to simply print, and the link stays for the detail.
        */}
        <View style={styles.benefits}>
          {PROMISES.map((key) => (
            <View key={key} style={styles.benefitRow}>
              <Text h="h5" textStyle={styles.benefitMark} title="•" />
              <Text
                h="h5"
                textStyle={styles.benefitText}
                title={t(`proFeatureExplainer.features.${key}.title`)}
              />
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => setShowFeatureExplainer(true)}
          style={styles.featureLink}
        >
          <Text
            h="h4"
            textStyle={styles.featureLinkText}
            title={t('proFeatureExplainer.link')}
          />
        </Pressable>
        {isLoading ? (
          <Loading />
        ) : (
          <>
            {packages.map((pack) => (
              <TouchableOpacity
                key={pack.identifier}
                onPress={() => handlePackageSelection(pack)}
                /*
                 * A plan, its price, and whether it is the chosen one.
                 *
                 * Without this the row read as two unrelated fragments -
                 * "One month", "$9.99" - and nothing said which was selected,
                 * so a player using VoiceOver could not tell what the purchase
                 * button was about to buy. `radio` is the right role: these are
                 * three options and exactly one is taken.
                 */
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedPackage === pack }}
                accessibilityLabel={`${t(`${[pack.identifier]}.title`)}, ${
                  pack.product.priceString
                }`}
                style={[
                  styles.packageItem,
                  selectedPackage === pack && styles.selectedPackage
                ]}
              >
                <Text
                  h="h5"
                  textStyle={styles.packageTitle}
                  title={t(`${[pack.identifier]}.title`)}
                />
                <Text
                  h="h5"
                  textStyle={styles.packagePrice}
                  title={pack.product.priceString}
                />
              </TouchableOpacity>
            ))}
          </>
        )}
        <PayWhatYouWantOption selectedPackage={selectedPackage} />
        <Space height={10} />
        <PurchaseButton
          title="buy"
          selectedPackage={selectedPackage}
          onPress={handlePurchase}
        />
        <GiftSubscriptionButton selectedPackage={selectedPackage} />

        {/*
          What the player is agreeing to, under the button that agrees to it.

          App Review asks for this on the page where the purchase happens -
          that it renews, that it can be cancelled, and working links to the
          terms and the privacy policy. This app has both documents and opened
          them from the `Hello` screen, which is no longer reachable: the sign-
          in flow was removed, so the only two legal links in the app went with
          it and the paywall carried none.
        */}
        <Space height={SPACE.md} />
        <Text
          h="h4"
          textStyle={styles.renewal}
          title={t('subscription.renewal')}
        />
        <Space height={SPACE.sm} />
        <View style={styles.legalRow}>
          <Text
            h="h4"
            textStyle={styles.legalLink}
            title={t('subscription.terms')}
            onPress={openURLEula}
          />
          <Text h="h4" textStyle={styles.legalDot} title="·" />
          <Text
            h="h4"
            textStyle={styles.legalLink}
            title={t('subscription.privacy')}
            onPress={openURLPolicy}
          />
        </View>

        <Space height={SPACE.md} />
        <Text
          h="h4"
          textStyle={styles.bought}
          title={t('alreadyBought')}
          onPress={onAlreadyBought}
        />
        <Space height={SPACE.sm} />
        <Text
          h="h4"
          textStyle={styles.helper}
          title={t('subscriptionHelper.title')}
          onPress={onWhyAmISeeingThis}
        />
        <Space height={SPACE.sm} />
        <Text
          h="h4"
          textStyle={styles.sampleLink}
          title={t('sampleAnswer.title')}
          onPress={() => setShowSample(true)}
        />
        <Space height={SPACE.xl} />
        <SampleAnswerModal
          visible={showSample}
          onClose={() => setShowSample(false)}
          onContinue={() => setShowSample(false)}
        />
        <ProFeatureExplainer
          visible={showFeatureExplainer}
          onClose={() => setShowFeatureExplainer(false)}
        />
      </ScrollView>

      {/*
        The way out, pinned.

        It used to live inside the photograph, so moving the photograph into the
        scroll view would have carried the only exit off the top of the screen.
      */}
      {/*
        Named, because an emoji is not a word. VoiceOver reads
        ":heavy_multiplication_x:" as "heavy multiplication x" - which is what
        the glyph is, and not what the button does.
      */}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('subscriptionHelper.close') || 'Close'}
        style={styles.iconStyle}
      >
        <Emoji name=":heavy_multiplication_x:" style={styles.leftIconStyle} />
      </Pressable>
    </View>
  )
}

/**
 * The sheet, as a function of the palette.
 *
 * `StyleSheet.create` at module scope cannot see a scheme that changes while
 * the app runs; a screen built that way keeps yesterday's colours until it is
 * remounted. Memoised by the caller, so the objects are still created once per
 * scheme rather than once per render.
 */
const stylesFor = (palette: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: palette.bg
    },
    container: {
      // `flexGrow`, not `flex`. As a scroll view's content container, `flex: 1`
      // pins the content to the viewport and the screen silently stops
      // scrolling - which is the same as the overflow it was meant to fix.
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      // The page's own margin, from the shared ladder. It was 20 - a number
      // chosen for this screen alone, which nothing else could align to.
      padding: SPACE.md,
      // And air under the poster: the first paragraph was printed across the
      // photograph's bottom edge, over a dozen pale hands, where it could not be
      // read at all.
      paddingTop: SPACE.lg
    },
    // `flex: 1` and a percentage height fought each other: flex grew the poster
    // to half the screen while the height asked for something else, and the copy
    // below was pulled up on top of it. A fixed share, no flex.
    poster: {
      width: '100%',
      height: vs(220),
      // Cancels the container's own padding, so the photograph still bleeds to
      // the edges now that it sits inside it.
      marginHorizontal: -SPACE.md,
      marginTop: -SPACE.lg,
      marginBottom: SPACE.lg
    },
    iconStyle: {
      position: 'absolute',
      top: SPACE.xl,
      left: SPACE.md,
      // A target a thumb can find, over a photograph of hands where a small
      // dark glyph has nothing to sit against.
      width: TOUCH,
      height: TOUCH,
      borderRadius: TOUCH / 2,
      alignItems: 'center',
      justifyContent: 'center',
      /*
       * A pale disc under the cross, in both schemes.
       *
       * The glyph is an emoji, so its colour is not ours to set: it is dark
       * grey whatever the palette says, and it sat directly on a photograph of
       * pale hands and sand where it was nearly invisible - the only way off
       * this screen. The disc is not a surface from the palette but a scrim
       * over an arbitrary image, which is why it is written here.
       */
      backgroundColor: 'rgba(255, 255, 255, 0.82)'
    },
    leftIconStyle: {
      fontSize: Platform.OS === 'ios' ? ms(30, 0.6) : ms(20, 0.6),
      bottom: Platform.OS === 'ios' ? 0 : 30
    },
    header: {
      fontSize: ms(TYPE.head, 0.6),
      fontWeight: 'bold',
      color: palette.text,
      marginBottom: SPACE.lg
    },
    bought: {
      fontSize: ms(13, 0.6),
      fontWeight: 'bold',
      color: palette.hint,
      alignSelf: 'center',
      textDecorationLine: 'underline'
    },
    helper: {
      fontSize: ms(12, 0.6),
      alignSelf: 'center',
      textAlign: 'center',
      color: palette.hint,
      textDecorationLine: 'underline'
    },
    sampleLink: {
      fontSize: ms(13, 0.6),
      fontWeight: 'bold',
      alignSelf: 'center',
      color: palette.accent,
      textDecorationLine: 'underline'
    },
    // The promises, printed rather than hidden behind a link. Left-aligned as a
    // list: three centred lines read as a slogan, and a slogan is not an offer.
    benefits: {
      width: '100%',
      marginBottom: SPACE.md
    },
    benefitRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: SPACE.xs
    },
    benefitMark: {
      color: palette.accent,
      fontSize: ms(TYPE.body, 0.6),
      marginRight: SPACE.sm
    },
    benefitText: {
      flex: 1,
      color: palette.text,
      fontSize: ms(TYPE.body, 0.6)
    },
    // The terms, quiet but legible: this is the small print, not a whisper.
    // `hint` is measured against the page in both schemes for exactly this.
    renewal: {
      fontSize: ms(TYPE.small, 0.6),
      textAlign: 'center',
      color: palette.hint,
      width: '92%'
    },
    legalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center'
    },
    legalLink: {
      fontSize: ms(TYPE.small, 0.6),
      color: palette.hint,
      textDecorationLine: 'underline'
    },
    legalDot: {
      fontSize: ms(TYPE.small, 0.6),
      color: palette.hint,
      marginHorizontal: SPACE.sm
    },
    featureLink: {
      alignSelf: 'center',
      marginBottom: SPACE.sm
    },
    featureLinkText: {
      color: palette.accent,
      textDecorationLine: 'underline',
      fontWeight: 'bold'
    },
    // The `bottom` offset lifted this paragraph onto the photo above it, where
    // it sat unreadable across a dozen hands. It reads under the poster now.
    test: {
      fontSize: ms(TYPE.body, 0.6),
      alignSelf: 'center',
      textAlign: 'center',
      color: palette.hint,
      width: '86%',
      marginBottom: SPACE.md
    },
    packageItem: {
      borderWidth: 1,
      borderColor: palette.rule,
      // The same corner as every card and field on the board.
      borderRadius: RADIUS,
      paddingHorizontal: SPACE.md,
      // A row a thumb can hit, which is Apple's number and not ours.
      minHeight: TOUCH,
      marginBottom: SPACE.sm,
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    selectedPackage: {
      // Marked by the accent, not by a grey that exists in one scheme only. Two
      // pixels, because a one-pixel change of colour alone is not a selection a
      // person notices.
      borderColor: palette.accent,
      borderWidth: 2,
      backgroundColor: palette.raised
    },
    packageTitle: {
      fontSize: ms(TYPE.title, 0.6),
      fontWeight: 'bold',
      color: palette.text
    },
    packagePrice: {
      fontSize: ms(TYPE.title, 0.6),
      color: palette.text
    }
  })

export { SubscriptionScreen }
