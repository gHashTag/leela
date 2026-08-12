import React, { memo, useCallback } from 'react'

import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Space, Text } from '../'
import { Pressable } from '../Pressable'
import { lightGray, primary } from '../../constants'
import { PostFeedFilter } from '../../utils/postFeedFilter'
import { triggerHaptic } from '../../utils/haptics'

interface FeedFilterI {
  selected: PostFeedFilter
  onSelect: (filter: PostFeedFilter) => void
}

const FILTERS: PostFeedFilter[] = ['newest', 'mostDiscussed', 'myPosts']

export const FeedFilter = memo(({ selected, onSelect }: FeedFilterI) => {
  const { t } = useTranslation()

  const handleSelect = useCallback((filter: PostFeedFilter) => {
    triggerHaptic('impactLight')
    onSelect(filter)
  }, [onSelect])

  return (
    <View style={styles.container}>
      {FILTERS.map((filter, index) => {
        const isActive = selected === filter
        return (
          <React.Fragment key={filter}>
            {index > 0 && <View style={styles.divider} />}
            <Pressable
              onPress={() => handleSelect(filter)}
              style={[styles.chip, isActive && styles.activeChip]}
              pressedStyle={styles.pressedChip}
              accessibilityState={{ selected: isActive }}
              accessibilityRole="button"
              accessibilityLabel={t(`feedFilter.${filter}`)}
            >
              <Text
                h="h10"
                title={t(`feedFilter.${filter}`)}
                oneColor={isActive ? primary : lightGray}
                textStyle={styles.label}
              />
            </Pressable>
          </React.Fragment>
        )
      })}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(12),
    paddingVertical: vs(8)
  },
  chip: {
    paddingHorizontal: s(12),
    paddingVertical: vs(5),
    borderRadius: s(16),
    borderWidth: 1,
    borderColor: lightGray
  },
  activeChip: {
    borderColor: primary,
    backgroundColor: `${primary}15`
  },
  pressedChip: {
    opacity: 0.6
  },
  label: {
    fontWeight: '600'
  },
  divider: {
    width: s(1),
    height: vs(16),
    backgroundColor: lightGray,
    marginHorizontal: s(8)
  }
})
