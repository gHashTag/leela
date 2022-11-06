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
        <Txt h4 title="H4" />
        <Txt h5 title="H5" />
        <Txt h6 title="H6" />
        <Txt h7 title="H7" />
        <Txt h8 title="H8" />
        <Txt h9 title="H9" />
        <Txt h10 title="H10" />
        <Txt h11 title="H11" />
        <Space height={50} />
        <Txt h0 title="GameBoard" />
        {/* <Dice /> */}
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
