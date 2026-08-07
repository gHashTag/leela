import React, { memo } from 'react'

import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Text } from '../'
import { fuchsia, white } from '../../constants'

interface ProBadgeT {
  small?: boolean
}

export const ProBadge = memo(({ small }: ProBadgeT) => {
  const { t } = useTranslation()
  return (
    <View style={[styles.container, small && styles.smallContainer]}>
      <Text
        h={small ? 'h11' : 'h10'}
        title={t('profile.proBadge')}
        oneColor={white}
        textStyle={styles.text}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    backgroundColor: fuchsia,
    borderRadius: s(8),
    paddingHorizontal: s(8),
    paddingVertical: vs(2),
    alignSelf: 'flex-start'
  },
  smallContainer: {
    borderRadius: s(6),
    paddingHorizontal: s(5),
    paddingVertical: vs(1)
  },
  text: {
    fontWeight: '700'
  }
})
