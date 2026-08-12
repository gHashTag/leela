import React, { useState } from 'react'

import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

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
    <View testID="buttons-selector">
      <View style={styles.container}>
        {data.map((a) => (
          <Pressable
            key={a}
            onPress={() => setSelected(a)}
            accessibilityRole="radio"
            accessibilityState={{ selected: selected === a }}
            accessibilityLabel={t('selectPlayers.playerCount', { count: a })}
            testID={`player-count-${a}`}
          >
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
      <Space height={vs(24)} />
      <Button
        title={t('actions.start')}
        onPress={() => onPress(selected - 1)}
        testID="select-players-start-button"
      />
    </View>
  )
})

export { ButtonsSelector }
