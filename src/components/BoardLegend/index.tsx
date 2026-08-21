import React, { memo, useState } from 'react'

import { useTranslation } from 'react-i18next'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { s } from 'react-native-size-matters'

import { Space, Text } from '../../components'
import { black, dimGray, primary, red, secondary, white } from '../../constants'
import { useReducedMotion } from '../../utils/useReducedMotion'

interface BoardLegendT {
  visible: boolean
  onClose: () => void
}

const SYMBOL_KEYS = [
  { key: 'planes', color: primary, bodyKey: 'boardLegend.planesBody' },
  { key: 'chakras', color: secondary, bodyKey: 'boardLegend.chakrasBody' },
  { key: 'arrows', color: '#50E3C2', bodyKey: 'boardLegend.arrowsBody' },
  { key: 'snakes', color: red, bodyKey: 'boardLegend.snakesBody' }
] as const

const getShapeStyle = (key: (typeof SYMBOL_KEYS)[number]['key']) => {
  switch (key) {
    case 'planes':
      return styles.circle
    case 'chakras':
      return styles.diamond
    case 'arrows':
      return styles.arrow
    case 'snakes':
      return styles.snake
    default:
      return styles.circle
  }
}

export const BoardLegend = memo(({ visible, onClose }: BoardLegendT) => {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const [activeIndex, setActiveIndex] = useState(0)

  const active = SYMBOL_KEYS[activeIndex]
  const activeShape = getShapeStyle(active.key)

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      accessibilityViewIsModal
      accessibilityLabel={t('boardLegend.title')}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Pressable
            onPress={onClose}
            style={styles.closeRow}
            accessibilityRole="button"
            accessibilityLabel={t('boardLegend.close')}
          >
            <Text h="h5" title="✕" />
          </Pressable>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text
              h="h2"
              textStyle={styles.title}
              title={t('boardLegend.title')}
            />
            <Space height={s(16)} />
            <View style={styles.grid}>
              {SYMBOL_KEYS.map((symbol, idx) => {
                const shapeStyle = getShapeStyle(symbol.key)
                return (
                  <Pressable
                    key={symbol.key}
                    onPress={() => setActiveIndex(idx)}
                    style={styles.gridItem}
                    accessibilityRole="radio"
                    accessibilityLabel={t(`boardLegend.${symbol.key}`)}
                    accessibilityState={{ checked: idx === activeIndex }}
                  >
                    <View
                      style={[
                        styles.symbol,
                        shapeStyle,
                        {
                          backgroundColor:
                            idx === activeIndex ? symbol.color : dimGray,
                          borderWidth: idx === activeIndex ? 2 : 0,
                          borderColor: black
                        }
                      ]}
                    />
                    <Text
                      h="h0"
                      textStyle={[
                        styles.symbolLabel,
                        idx === activeIndex && { color: symbol.color }
                      ]}
                      title={t(`boardLegend.${symbol.key}`)}
                    />
                  </Pressable>
                )
              })}
            </View>
            <Space height={s(16)} />
            <View
              style={[
                styles.symbol,
                activeShape,
                { alignSelf: 'center', backgroundColor: active.color }
              ]}
            />
            <Space height={s(10)} />
            <Text
              h="h3"
              textStyle={styles.activeTitle}
              title={t(`boardLegend.${active.key}`)}
            />
            <Space height={s(10)} />
            <Text
              h="h5"
              textStyle={styles.activeBody}
              title={t(active.bodyKey)}
            />
          </ScrollView>
          <Space height={s(16)} />
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel={t('boardLegend.close')}
          >
            <Text
              h="h4"
              textStyle={styles.closeButtonText}
              title={t('boardLegend.close')}
            />
          </Pressable>
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
    maxHeight: '72%'
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  gridItem: {
    alignItems: 'center',
    marginHorizontal: s(12),
    marginVertical: s(8)
  },
  symbol: {
    width: s(28),
    height: s(28),
    marginBottom: s(6)
  },
  circle: {
    borderRadius: s(14)
  },
  diamond: {
    transform: [{ rotate: '45deg' }]
  },
  arrow: {
    borderTopEndRadius: s(14),
    borderBottomStartRadius: s(14)
  },
  snake: {
    borderRadius: s(14),
    borderTopLeftRadius: s(4),
    borderBottomRightRadius: s(4)
  },
  symbolLabel: {
    color: dimGray
  },
  activeTitle: {
    color: black,
    textAlign: 'center',
    fontWeight: 'bold'
  },
  activeBody: {
    color: black,
    lineHeight: s(22),
    textAlign: 'center'
  },
  closeButton: {
    backgroundColor: secondary,
    paddingVertical: s(12),
    borderRadius: s(8),
    alignItems: 'center'
  },
  closeButtonText: {
    color: white,
    fontWeight: 'bold'
  }
})
