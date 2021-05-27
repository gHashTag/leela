import React, { Component } from 'react'
import { Animated, Easing, StyleSheet } from 'react-native'
import { ms } from 'react-native-size-matters'
import {
  DiceStore,
  actionPlayerOne,
  actionPlayerTwo,
  actionPlayerThree,
  actionPlayerFour,
  actionPlayerFive,
  actionPlayerSix
} from '../../store'

const getImage = (number: number) => {
  switch (number) {
    case 1:
      return require('./assets/1.png')
      break
    case 2:
      return require('./assets/2.png')
      break
    case 3:
      return require('./assets/3.png')
      break
    case 4:
      return require('./assets/4.png')
      break
    case 5:
      return require('./assets/5.png')
      break
    case 6:
      return require('./assets/6.png')
      break
  }
}

const updateStep = (number: number) => {
  switch (number) {
    case 1:
      actionPlayerOne.updateStep()
      break
    case 2:
      actionPlayerTwo.updateStep()
      break
    case 3:
      actionPlayerThree.updateStep()
      break
    case 4:
      actionPlayerFour.updateStep()
      break
    case 5:
      actionPlayerFive.updateStep()
      break
    case 6:
      actionPlayerSix.updateStep()
      break
  }
}

const styles = StyleSheet.create({
  image: {
    height: ms(65, 0.4),
    width: ms(65, 0.4),
    margin: 30
  }
})

interface CubeT {
  duration: number
}

class Cube extends Component<CubeT> {
  private spinValue: Animated.Value

  constructor(props: any) {
    super(props)

    this.spinValue = new Animated.Value(0)
  }

  UNSAFE_componentWillReceiveProps({ duration }: { duration: number }) {
    this.spin(duration)
  }

  spin = (value: number) => {
    const duration = (value / 2) * 500
    this.spinValue.setValue(0)

    Animated.timing(this.spinValue, {
      toValue: value,
      duration: duration,
      easing: Easing.linear,
      useNativeDriver: true
    }).start(() => updateStep(DiceStore.players))
  }

  render() {
    const { duration } = this.props
    const spin = this.spinValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg']
    })

    return <Animated.Image style={[styles.image, { transform: [{ rotate: spin }] }]} source={getImage(duration)} />
  }
}

export { Cube }
