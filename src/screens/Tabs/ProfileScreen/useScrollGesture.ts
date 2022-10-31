import { useRef, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import { Gesture, PanGestureHandlerEventPayload } from 'react-native-gesture-handler'
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { s, vs } from 'react-native-size-matters'
import { isIos } from '../../../constants'

export const useScrollGesture = () => {
  const { height: H } = useWindowDimensions()
  const { bottom: bottomInsets } = useSafeAreaInsets()

  let topPartH = vs(15) + s(120) + bottomInsets
  topPartH += isIos ? 0 : vs(10) + s(30)
  const tabViewH = H - topPartH
  const screenH = tabViewH + topPartH - vs(10)

  const SNAP_POINTS_FROM_TOP = [-topPartH, 0]

  const FULLY_OPEN_SNAP_POINT = SNAP_POINTS_FROM_TOP[0]
  const CLOSED_SNAP_POINT = SNAP_POINTS_FROM_TOP[SNAP_POINTS_FROM_TOP.length - 1]

  const [snapPoint, setSnapPoint] = useState(CLOSED_SNAP_POINT)

  const panGestureRef = useRef(Gesture.Pan())
  const blockScrollUntilAtTheTopRef = useRef(Gesture.Tap())
  const translationY = useSharedValue(0)
  const scrollOffset = useSharedValue(0)
  const bottomSheetTranslateY = useSharedValue(CLOSED_SNAP_POINT)

  const onHandlerEndOnJS = (point: number) => {
    setSnapPoint(point)
  }
  const onHandlerEnd = ({ velocityY }: PanGestureHandlerEventPayload) => {
    'worklet'
    const dragToss = 0.05
    const endOffsetY =
      bottomSheetTranslateY.value + translationY.value + velocityY * dragToss
    // calculate nearest snap point
    let destSnapPoint = FULLY_OPEN_SNAP_POINT

    if (snapPoint === FULLY_OPEN_SNAP_POINT && endOffsetY < FULLY_OPEN_SNAP_POINT) {
      return
    }

    for (const snapPoint of SNAP_POINTS_FROM_TOP) {
      const distFromSnap = Math.abs(snapPoint - endOffsetY)
      if (distFromSnap < Math.abs(destSnapPoint - endOffsetY)) {
        destSnapPoint = snapPoint
      }
    }

    // update current translation to be able to animate withSpring to snapPoint
    bottomSheetTranslateY.value = bottomSheetTranslateY.value + translationY.value
    translationY.value = 0

    bottomSheetTranslateY.value = withTiming(destSnapPoint, {
      duration: 300
    })
    runOnJS(onHandlerEndOnJS)(destSnapPoint)
  }
  const panGesture = Gesture.Pan()
    .onUpdate(e => {
      // when bottom sheet is not fully opened scroll offset should not influence
      // its position (prevents random snapping when opening bottom sheet when
      // the content is already scrolled)

      if (snapPoint === FULLY_OPEN_SNAP_POINT) {
        translationY.value = e.translationY - scrollOffset.value
      } else {
        translationY.value = e.translationY
      }
    })
    .onEnd(onHandlerEnd)
    .withRef(panGestureRef)

  const blockScrollUntilAtTheTop = Gesture.Tap()
    .maxDeltaY(snapPoint - FULLY_OPEN_SNAP_POINT)
    .maxDuration(100000)
    .simultaneousWithExternalGesture(panGesture)
    .withRef(blockScrollUntilAtTheTopRef)

  const headerGesture = Gesture.Pan()
    .onUpdate(e => {
      translationY.value = e.translationY
    })
    .onEnd(onHandlerEnd)

  const scrollViewGesture = Gesture.Native().requireExternalGestureToFail(
    blockScrollUntilAtTheTop
  )

  const screenStyle = useAnimatedStyle(() => {
    const translateY = bottomSheetTranslateY.value + translationY.value

    const minTranslateY = Math.max(FULLY_OPEN_SNAP_POINT, translateY)
    const clampedTranslateY = Math.min(CLOSED_SNAP_POINT, minTranslateY)
    return {
      height: screenH,
      transform: [{ translateY: clampedTranslateY }]
    }
  })
  return {
    tabViewH,
    screenStyle,
    panGesture,
    headerGesture,
    scrollViewGesture,
    scrollOffset,
    blockScrollUntilAtTheTop
  }
}
