import React, { memo, useState } from 'react'

import { useTranslation } from 'react-i18next'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { s } from 'react-native-size-matters'

import { Space, Text } from '../../components'
import { black, secondary, white } from '../../constants'

interface ProFeatureExplainerT {
  visible: boolean
  onClose: () => void
}

const FEATURE_KEYS = [
  'aiGuide',
  'dailyVerse',
  'community',
  'offlineCache',
  'reports'
] as const

export const ProFeatureExplainer = memo(({ visible, onClose }: ProFeatureExplainerT) => {
  const { t } = useTranslation()
  const [activeIndex, setActiveIndex] = useState(0)

  const featureKey = FEATURE_KEYS[activeIndex]

  const handleNext = () => {
    if (activeIndex < FEATURE_KEYS.length - 1) {
      setActiveIndex(activeIndex + 1)
    } else {
      setActiveIndex(0)
      onClose()
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Pressable onPress={onClose} style={styles.closeRow}>
            <Text h="h5" title="✕" />
          </Pressable>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text
              h="h2"
              textStyle={styles.title}
              title={t('proFeatureExplainer.title')}
            />
            <Space height={s(16)} />
            <View style={styles.pager}>
              {FEATURE_KEYS.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    idx === activeIndex && styles.activeDot
                  ]}
                />
              ))}
            </View>
            <Space height={s(16)} />
            <Text
              h="h3"
              textStyle={styles.featureTitle}
              title={t(`proFeatureExplainer.features.${featureKey}.title`)}
            />
            <Space height={s(12)} />
            <Text
              h="h5"
              textStyle={styles.featureBody}
              title={t(`proFeatureExplainer.features.${featureKey}.body`)}
            />
          </ScrollView>
          <Space height={s(16)} />
          <Pressable onPress={handleNext} style={styles.nextButton}>
            <Text
              h="h4"
              textStyle={styles.nextText}
              title={
                activeIndex < FEATURE_KEYS.length - 1
                  ? t('proFeatureExplainer.next')
                  : t('proFeatureExplainer.gotIt')
              }
            />
          </Pressable>
          <Space height={s(10)} />
          <Text
            h="h5"
            textStyle={styles.dismiss}
            title={t('proFeatureExplainer.dismiss')}
            onPress={onClose}
          />
        </View>
      </View>
    </Modal>
  )
})

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end'
  },
  card: {
    backgroundColor: white,
    borderTopLeftRadius: s(20),
    borderTopRightRadius: s(20),
    paddingHorizontal: s(20),
    paddingTop: s(16),
    paddingBottom: s(34),
    maxHeight: '88%'
  },
  closeRow: {
    alignSelf: 'flex-end',
    padding: s(4)
  },
  title: {
    fontWeight: 'bold',
    color: black,
    textAlign: 'center'
  },
  pager: {
    flexDirection: 'row',
    justifyContent: 'center'
  },
  dot: {
    width: s(8),
    height: s(8),
    borderRadius: s(4),
    backgroundColor: '#CCCCCC',
    marginHorizontal: s(4)
  },
  activeDot: {
    backgroundColor: secondary
  },
  featureTitle: {
    color: black,
    textAlign: 'center',
    fontWeight: 'bold'
  },
  featureBody: {
    color: black,
    lineHeight: s(22),
    textAlign: 'center'
  },
  nextButton: {
    backgroundColor: secondary,
    paddingVertical: s(12),
    borderRadius: s(8),
    alignItems: 'center'
  },
  nextText: {
    color: white,
    fontWeight: 'bold'
  },
  dismiss: {
    textAlign: 'center',
    textDecorationLine: 'underline',
    color: '#888'
  }
})
