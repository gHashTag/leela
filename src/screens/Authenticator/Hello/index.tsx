import React, { ReactElement } from 'react'

import { ScaledSheet, ms, s } from 'react-native-size-matters'

import { I18n } from '../../../utils'
import { StackNavigationProp } from '@react-navigation/stack'
import { AppContainer, Button, IconLeela, Space, Txt } from '../../../components'
import { white, black, goBack } from '../../../constants'
import { RootStackParamList } from '../../../types'
import { useTheme } from '@react-navigation/native'

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'HELLO'>

type HelloT = {
  navigation: ProfileScreenNavigationProp
}

const styles = ScaledSheet.create({
  img: {
    justifyContent: 'center',
    alignSelf: 'center',
    height: ms(150, 0.5),
    width: ms(150, 0.5)
  },
  h6: { alignSelf: 'center' }
})

const Hello = ({ navigation }: HelloT): ReactElement => {
  const { dark } = useTheme()
  const color = dark ? white : black

  return (
    <AppContainer backgroundColor={dark ? black : white} onPress={goBack(navigation)} title=" " colorLeft={color}>
      <Space height={s(80)} />
      <IconLeela />
      <Space height={s(30)} />
      <Button title={I18n.t('signIn')} onPress={() => navigation.navigate('SIGN_IN')} color={color} />
      <Space height={10} />
      <Txt h6 title={I18n.t('or')} textStyle={styles.h6} />
      <Space height={10} />
      <Button title={I18n.t('signUp')} onPress={() => navigation.navigate('SIGN_UP')} color={color} />
      <Space height={160} />
    </AppContainer>
  )
}

export { Hello }
