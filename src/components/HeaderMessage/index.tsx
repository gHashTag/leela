import { observer } from 'mobx-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { s } from 'react-native-size-matters'
import { useRevenueCat } from 'src/providers/RevenueCatProvider'

import { DiceStore, PostStore } from '../../store'
import { Space } from '../Space'
import { Text } from '../TextComponents'

export const HeaderMessage = observer(() => {
  const { t } = useTranslation()
  const { user } = useRevenueCat()

  let subscribeMess

  if (user.pro) {
    subscribeMess = DiceStore.topMessage
  } else {
    subscribeMess = PostStore.store.isBlockGame
      ? t('paySub')
      : DiceStore.topMessage
  }

  return (
    <>
      {DiceStore.topMessage !== ' ' && DiceStore.topMessage && (
        <View style={messContainer}>
          <Text
            numberOfLines={2}
            h="h5"
            title={subscribeMess}
            textStyle={styles.textStyle}
          />
        </View>
      )}
      <Space height={s(1)} />
      {DiceStore.message !== ' ' && DiceStore.message && (
        <View style={messContainer}>
          <Text numberOfLines={1} h="h5" title={DiceStore.message} />
        </View>
      )}
    </>
  )
})

const styles = StyleSheet.create({
  messContainer: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  textStyle: {
    lineHeight: s(22),
    width: '100%',
    textAlign: 'center',
  },
})

const { messContainer } = styles
