import React, { memo } from 'react'
import { StyleSheet, View, useColorScheme } from 'react-native'
import { s, vs } from 'react-native-size-matters'
import { Space } from '../../components'

interface PostsSkeletonT {
  count?: number
}

const SkeletonCard = memo(() => {
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'
  const bone = isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.12)'

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: bone }]} />
        <View style={styles.lines}>
          <View style={[styles.line, styles.lineShort, { backgroundColor: bone }]} />
          <View style={[styles.line, styles.lineLong, { backgroundColor: bone }]} />
        </View>
      </View>
      <View style={styles.body}>
        <View style={[styles.line, styles.lineLong, { marginBottom: vs(6), backgroundColor: bone }]} />
        <View style={[styles.line, styles.lineMedium, { backgroundColor: bone }]} />
      </View>
      <View style={styles.actions}>
        <View style={[styles.chip, { backgroundColor: bone }]} />
        <View style={[styles.chip, { backgroundColor: bone }]} />
      </View>
    </View>
  )
})

export const PostsSkeleton = memo(({ count = 4 }: PostsSkeletonT) => {
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'
  const bone = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index}>
          <SkeletonCard />
          <Space height={vs(10)} />
        </View>
      ))}
      {/* footer shimmer bar */}
      <View style={[styles.footer, { backgroundColor: bone }]} />
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: s(16),
    paddingTop: vs(10)
  },
  card: {
    borderRadius: s(12),
    padding: s(12)
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatar: {
    width: s(40),
    height: s(40),
    borderRadius: s(20)
  },
  lines: {
    flex: 1,
    marginLeft: s(10)
  },
  line: {
    height: s(10),
    borderRadius: s(5),
    backgroundColor: 'rgba(255, 255, 255, 0.25)'
  },
  lineShort: {
    width: '30%',
    marginBottom: vs(6)
  },
  lineMedium: {
    width: '60%'
  },
  lineLong: {
    width: '90%'
  },
  body: {
    marginTop: vs(12)
  },
  actions: {
    flexDirection: 'row',
    marginTop: vs(12)
  },
  chip: {
    width: s(70),
    height: s(24),
    borderRadius: s(12),
    marginRight: s(10)
  },
  footer: {
    height: s(12),
    borderRadius: s(6),
    width: '60%',
    alignSelf: 'center',
    marginTop: vs(10)
  }
})
