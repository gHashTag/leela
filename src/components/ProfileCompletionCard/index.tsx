import React, { memo, useEffect, useMemo, useState } from 'react'

import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Button, Space, Text } from '../../components'
import { gray, lightGray } from '../../constants'
import { OnlinePlayer } from '../../store'
import { triggerHaptic } from '../../utils/haptics'

interface ProfileCompletionCardT {
  onCompleteStep: (step: string) => void
}

type MissingStep = {
  key: 'avatar' | 'name' | 'intention' | 'firstReport'
  label: string
}

export const ProfileCompletionCard = memo(({ onCompleteStep }: ProfileCompletionCardT) => {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!dismissed) {
      triggerHaptic('impactLight')
    }
  }, [dismissed])

  const {
    avatar,
    profile: { firstName, lastName, intention },
    history
  } = OnlinePlayer.store

  const missing = useMemo<MissingStep[]>(() => {
    const steps: MissingStep[] = []
    if (!avatar) {
      steps.push({ key: 'avatar', label: t('profileCompletion.avatar') })
    }
    if (!firstName && !lastName) {
      steps.push({ key: 'name', label: t('profileCompletion.name') })
    }
    if (!intention || intention.trim().length === 0) {
      steps.push({ key: 'intention', label: t('profileCompletion.intention') })
    }
    if (!Array.isArray(history) || history.length === 0) {
      steps.push({ key: 'firstReport', label: t('profileCompletion.firstReport') })
    }
    return steps
  }, [avatar, firstName, intention, lastName, history, t])

  const completedCount = 4 - missing.length
  const progress = (completedCount / 4) * 100

  if (missing.length === 0 || dismissed) {
    return null
  }

  const nextStep = missing[0]

  const handleComplete = () => {
    triggerHaptic('impactMedium')
    onCompleteStep(nextStep.key)
  }

  const handleDismiss = () => {
    triggerHaptic('impactLight')
    setDismissed(true)
  }

  return (
    <View style={styles.card} testID="profile-completion-card">
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text
            h="h5"
            title={t('profileCompletion.title')}
            textStyle={styles.title}
          />
          <Space height={vs(4)} />
          <Text
            h="h7"
            title={t('profileCompletion.message', { step: nextStep.label })}
            textStyle={styles.message}
          />
        </View>
        <Text
          h="h5"
          title="✕"
          onPress={handleDismiss}
          testID="profile-completion-dismiss"
        />
      </View>
      <Space height={vs(12)} />
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${progress}%` }
          ]}
        />
      </View>
      <Space height={vs(12)} />
      <Button
        title={t('profileCompletion.action')}
        onPress={handleComplete}
        testID="profile-completion-action"
      />
    </View>
  )
})

const styles = StyleSheet.create({
  card: {
    width: '92%',
    backgroundColor: '#F0F0F0',
    borderRadius: s(16),
    padding: s(16)
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  flex: {
    flex: 1
  },
  title: {
    fontWeight: 'bold'
  },
  message: {
    color: gray
  },
  progressTrack: {
    height: s(6),
    borderRadius: s(3),
    backgroundColor: lightGray,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#50E3C2'
  }
})
