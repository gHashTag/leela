import React, { useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { s } from 'react-native-size-matters'
import { observer } from 'mobx-react-lite'
import { I18n } from '../../utils'
import { ButtonElements } from '../ButtonElements'
import { SubscribeStore } from '../../store'
import { Space } from '../Space'
import { Txt } from '../Txt'

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row'
  }
})

const data = [
  {
    id: 1
  },
  {
    id: 2
  },
  {
    id: 3
  },
  {
    id: 4
  },
  {
    id: 5
  },
  {
    id: 6
  }
]

const numbers = ['one', 'two', 'three', 'four', 'five', 'six']

interface ButtonsSlectorT {
  onPress: (selectItem: number) => void
}

const ButtonsSlector = observer(({ onPress }: ButtonsSlectorT) => {
  const [value, setValue] = useState({
    one: true,
    two: false,
    three: false,
    four: false,
    five: false,
    six: false
  })

  const _onChangeState = (number: number) => () => {
    const defaultObject = numbers.reduce((acc, el) => ({ ...acc, [el]: false }), {})
    setValue({ ...defaultObject, [numbers[number - 1]]: true })
  }

  const arr = Object.values(value)

  const selectItem = [...arr.keys()].filter(i => arr[i])[0]

  return (
    <View style={{ alignSelf: 'center' }}>
      <Space height={s(150)} />

      <Txt h1 title={`${I18n.t('selectPlayers')}`} />
      <Space height={s(20)} />
      {!SubscribeStore.subscriptionActive && <Txt h3 title={`${I18n.t('free')}`} />}
      <Space height={s(20)} />
      <View style={styles.container}>
        {data.map(({ id }) => {
          const check = value[numbers[id - 1]]
          return (
            <TouchableOpacity key={id} onPress={_onChangeState(id)}>
              {check ? (
                <Txt h7 title={id.toString()} textStyle={{ padding: 10 }} />
              ) : (
                <Txt h0 title={id.toString()} textStyle={{ padding: 10 }} />
              )}
            </TouchableOpacity>
          )
        })}
      </View>
      <ButtonElements title={I18n.t('startGame')} onPress={() => onPress(selectItem)} />
    </View>
  )
})

export { ButtonsSlector }
