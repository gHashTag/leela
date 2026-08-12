import React, { useCallback, useRef } from 'react'

import { RouteProp, useFocusEffect } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
// eslint-disable-next-line react-native/split-platform-components
import {
  BackHandler,
  Platform,
  ScrollView,
  StyleSheet,
  ToastAndroid
} from 'react-native'
import { s, vs } from 'react-native-size-matters'
import Sound from 'react-native-sound'
import {
  AppContainer,
  // ButtonPlay,
  CreatePost,
  KeyboardContainer,
  // Loading,
  SelectableIOS,
  Space,
  Text
} from '../../components'
import { OnlinePlayer } from '../../store'
import { RootStackParamList } from '../../types/types'

type navigation = NativeStackNavigationProp<
  RootStackParamList,
  'PLANS_DETAIL_SCREEN'
>
type route = RouteProp<RootStackParamList, 'PLANS_DETAIL_SCREEN'>

type PlansDetailScreenT = {
  navigation: navigation
  route: route
}

const PlansDetailScreen = observer(
  ({ navigation, route }: PlansDetailScreenT) => {
    const { plan, report } = route.params
    const soundRef = useRef<Sound>()
    const { h3 } = styles
    const { isReported } = OnlinePlayer.store
    // const [isPlaying, setIsPaying] = useState<boolean>(false)
    // const [soundLoading, setSoundLoading] = useState<boolean>(false)
    const { t } = useTranslation()

    const handleCross = useCallback(() => {
      if (isReported) {
        navigation.goBack()
        soundRef.current?.stop()
      } else {
        Platform.OS === 'android' &&
          ToastAndroid.showWithGravityAndOffset(
            t('online-part.notReported'),
            ToastAndroid.LONG,
            ToastAndroid.BOTTOM,
            25,
            50
          )
      }
    }, [isReported, navigation, t])

    useFocusEffect(
      useCallback(() => {
        const backhandler = BackHandler.addEventListener(
          'hardwareBackPress',
          () => {
            handleCross()
            return true
          }
        )
        return () => {
          soundRef.current?.stop()
          backhandler.remove()
        }
      }, [handleCross])
    )

    // const onToggle = () => {
    //   if (!soundRef.current) {
    //     const sound = new Sound(t(`plan_${plan}.url`), undefined)
    //     soundRef.current = sound
    //     const interval = setInterval(() => {
    //       const isLoaded = soundRef.current?.isLoaded()
    //       setSoundLoading(!isLoaded)
    //       if (isLoaded) {
    //         soundRef.current?.play()
    //         setIsPaying(true)
    //         clearInterval(interval)
    //       }
    //     }, 400)
    //     return
    //   }
    //   if (soundRef.current?.isPlaying()) {
    //     soundRef.current.pause()
    //     setIsPaying(false)
    //   } else {
    //     soundRef.current?.play()
    //     if (soundRef.current && soundRef.current.isLoaded()) {
    //       setIsPaying(true)
    //     }
    //   }
    // }

    return (
      <AppContainer
        onPress={handleCross}
        title={t(`plan_${plan}.title`)}
        iconRight={null}
        iconLeftOpacity={isReported ? 1 : 0.4}
        iconLeft=":heavy_multiplication_x:"
        status="1x1"
      >
        <KeyboardContainer>
          {/* keyboardShouldPersistTaps: with the keyboard up, the scroll view
              swallows the first tap to dismiss it, so Send needed pressing
              twice - once to close the keyboard, once to actually submit. */}
          <ScrollView keyboardShouldPersistTaps="handled">
            <Space height={vs(10)} />
            {/* {soundLoading ? (
            <Loading size={s(60)} />
          ) : (
            <ButtonPlay onPress={onToggle} isStop={isPlaying} />
          )} */}
            <Space height={vs(10)} />
            {Platform.OS === 'ios' ? (
              <SelectableIOS
                h={'h7'}
                title={t(`plan_${plan}.content`)}
                textStyle={h3}
              />
            ) : (
              <Text
                selectable
                h={'h7'}
                title={t(`plan_${plan}.content`)}
                textStyle={h3}
              />
            )}
            {report && <CreatePost plan={plan} />}
            {/* Report mode ends in the Send button, so it needs MORE room at
                the bottom, not less. This was inverted - 20pt in report mode
                against 70 otherwise - which pinned Send to the very edge of
                the screen, under the home indicator. */}
            <Space height={report ? vs(90) : vs(70)} />
          </ScrollView>
        </KeyboardContainer>
      </AppContainer>
    )
  }
)
const styles = StyleSheet.create({
  h3: {
    padding: s(20)
  }
})
export { PlansDetailScreen }
