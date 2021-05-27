import React from 'react'
import { ScrollView } from 'react-native'
import { Txt, GameBoard, ButtonSimple, ButtonIcon, Space, Background, Dice } from './components'

const UI = () => {
  return (
    <Background>
      <ScrollView>
        <Space height={50} />
        <Txt h0 title="Buttons" />
        <Space height={10} />
        <Txt h0 title="H0" />
        <Txt h1 title="H1" />
        <Txt h2 title="H2" />
        <Txt h3 title="H3" />
        <Space height={50} />
        <Txt h0 title="GameBoard" />
        <Dice />
        <GameBoard />
        <Space height={50} />
        <Txt h0 title="Buttons" />
        <ButtonSimple title="Sign In" />
        <ButtonIcon type="plus" width={50} height={50} onPress={() => {}} />
      </ScrollView>
    </Background>
  )
}

export { UI }
