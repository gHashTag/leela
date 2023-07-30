import React, { useState } from 'react'

import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { s } from 'react-native-size-matters'

import { Text } from '../../'
import { Pressable } from '../../Pressable'
import { Space } from '../../Space'
import { Button } from '../Button'

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row'
  },
  numPadding: {
    padding: 10
  }
})

const data = [1, 2, 3, 4, 5, 6]

// const numbers = ['one', 'two', 'three', 'four', 'five', 'six']

interface ButtonsSelectorT {
  onPress: (selectItem: number) => void
}

const ButtonsSelector = observer(({ onPress }: ButtonsSelectorT) => {
  const [selected, setSelected] = useState<number>(1)
  const { t } = useTranslation()

  return (
    <View>
      <Text h={'h3'} title={`${t('selectPlayers')}`} />
      <Space height={s(20)} />
      <View style={styles.container}>
        {data.map((a) => (
          <Pressable key={a} onPress={() => setSelected(a)}>
            {selected === a ? (
              <Text
                h={'h0'}
                title={a.toString()}
                textStyle={styles.numPadding}
              />
            ) : (
              <Text
                h={'h1'}
                title={a.toString()}
                textStyle={styles.numPadding}
              />
            )}
          </Pressable>
        ))}
      </View>
      <Button
        title={t('actions.start')}
        onPress={() => onPress(selected - 1)}
      />
    </View>
  )
})

export { ButtonsSelector }
