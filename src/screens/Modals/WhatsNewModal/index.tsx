import React from 'react'

import { useNavigation, useTheme } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { ButtonSimple, Space, Text } from '../../../components'
import { black, blackOpacity } from '../../../constants'
import { version } from '../../../../package.json'

export function WhatsNewModal() {
  const {
    colors: { background }
  } = useTheme()
  const { t } = useTranslation()
  const navigation = useNavigation()

  const onClose = () => navigation.goBack()

  // `returnObjects: true` lets us render a list of translated changelog bullets.
  const items = t<string[]>('whatsNew.items', { returnObjects: true })

  return (
    <View style={styles.container}>
      <View style={[styles.modalView, { backgroundColor: background }]}>
        <Text
          h="h2"
          textStyle={styles.title}
          title={t('whatsNew.title')}
        />
        <Space height={vs(8)} />
        <Text
          h="h5"
          textStyle={styles.version}
          title={t('whatsNew.version', { version })}
        />
        <Space height={vs(20)} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {items.map((item, index) => (
            <View key={index} style={styles.row}>
              <Text h="h5" title="•" textStyle={styles.bullet} />
              <Text h="h5" textStyle={styles.item} title={item} />
            </View>
          ))}
        </ScrollView>
        <Space height={vs(20)} />
        <ButtonSimple
          h="h3"
          title={t('whatsNew.close')}
          onPress={onClose}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    height: '100%',
    width: '100%',
    backgroundColor: blackOpacity,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalView: {
    margin: s(20),
    borderRadius: s(20),
    padding: s(24),
    maxHeight: '80%',
    width: '85%',
    alignItems: 'center',
    shadowColor: black,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5
  },
  title: {
    textAlign: 'center'
  },
  version: {
    textAlign: 'center',
    opacity: 0.7
  },
  scroll: {
    width: '100%'
  },
  scrollContent: {
    paddingVertical: vs(4)
  },
  row: {
    flexDirection: 'row',
    marginBottom: vs(10),
    paddingRight: s(4)
  },
  bullet: {
    marginRight: s(8),
    width: s(16)
  },
  item: {
    flex: 1,
    lineHeight: vs(20)
  }
})
