import React, { useContext } from 'react'

import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import { s, vs } from 'react-native-size-matters'

import {
  AiLanguageToggle,
  AiPersonaSelector,
  Space,
  Text
} from '../../../../components'
import { TabContext } from '../TabContext'

export const AiPersonaScene = observer(() => {
  const { t } = useTranslation()
  const { headerGesture } = useContext(TabContext) as any

  return (
    <GestureDetector gesture={headerGesture}>
      <View style={container}>
        <Space height={5} />
        <Text title={t('aiPersona.title')} h="h5" textStyle={styles.title} />
        <Space height={10} />
        <AiPersonaSelector />
        <Space height={vs(12)} />
        <AiLanguageToggle />
      </View>
    </GestureDetector>
  )
})

const styles = StyleSheet.create({
  container: {
    padding: s(10),
    flex: 1
  },
  title: {
    textAlign: 'center'
  }
})

const { container } = styles
