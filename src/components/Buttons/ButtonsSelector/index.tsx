import React, { useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { s } from 'react-native-size-matters'
import { observer } from 'mobx-react-lite'
import { I18n } from '../../../utils'
import { Button } from '../Button'
//import { SubscribeStore } from '../../store'
import { Space } from '../../Space'
import { Text } from '../../'

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row'
  }
})

const data = [1, 2, 3, 4, 5, 6]

// const numbers = ['one', 'two', 'three', 'four', 'five', 'six']

interface ButtonsSelectorT {
  onPress: (selectItem: number) => void
}

const ButtonsSelector = observer(({ onPress }: ButtonsSelectorT) => {
  const [selected, setSelected] = useState<number>(1)

  return (
    <View style={{ alignSelf: 'center' }}>
      <Space height={s(150)} />

      <Text h={'h3'} title={`${I18n.t('selectPlayers')}`} />
      <Space height={s(20)} />
      {/* {!SubscribeStore.subscriptionActive && <Txt h3 title={`${I18n.t('free')}`} />} */}
      <Space height={s(20)} />
      <View style={styles.container}>
        {data.map(a => (
          <TouchableOpacity key={a} onPress={() => setSelected(a)}>
            {selected === a ? (
              <Text h={'h0'} title={a.toString()} textStyle={{ padding: 10 }} />
            ) : (
              <Text h={'h1'} title={a.toString()} textStyle={{ padding: 10 }} />
            )}
          </TouchableOpacity>
        ))}
      </View>
      <Button
        title={I18n.t('startGame')}
        onPress={() => onPress(selected - 1)}
      />
    </View>
  )
})

export { ButtonsSelector }
