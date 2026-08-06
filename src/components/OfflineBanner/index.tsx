import NetInfo from '@react-native-community/netinfo'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { s, vs } from 'react-native-size-matters'

import { red, white } from '../../constants'
import { Text } from '../TextComponents'

export const OfflineBanner = () => {
  const { top } = useSafeAreaInsets()
  const { t } = useTranslation()
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOffline(state.isConnected === false)
    })
    return unsub
  }, [])

  if (!isOffline) return null

  return (
    <View style={[styles.banner, { paddingTop: top + vs(4) }]}>
      <Text h="h6" title={t('offlineBanner')} textStyle={styles.text} />
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: red,
    paddingHorizontal: s(16),
    paddingBottom: vs(6),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999
  },
  text: {
    color: white,
    textAlign: 'center'
  }
})
