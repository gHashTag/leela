import React, { memo, useCallback, useEffect, useState } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useColorScheme
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { s, vs } from 'react-native-size-matters'

import { ButtonWithIcon, Space, Text } from '../../components'
import { captureException, dimGray, white } from '../../constants'
import {
  clearTodayIntention,
  loadTodayIntention,
  saveTodayIntention
} from '../../utils/intention'
import { triggerHaptic } from '../../utils/haptics'

export const IntentionPrompt = memo(() => {
  const { t } = useTranslation()
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'

  const [visible, setVisible] = useState(false)
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    let mounted = true
    loadTodayIntention()
      .then((value) => {
        if (!mounted) return
        if (!value) {
          setVisible(true)
        } else {
          setSaved(value)
        }
      })
      .catch((error) => captureException(error, 'IntentionPrompt:load'))
    return () => {
      mounted = false
    }
  }, [])

  const handleSave = useCallback(async () => {
    const intention = draft.trim()
    if (!intention) return
    await saveTodayIntention(intention)
    setSaved(intention)
    setVisible(false)
    triggerHaptic('impactLight')
  }, [draft])

  const handleSkip = useCallback(async () => {
    await clearTodayIntention()
    setVisible(false)
    triggerHaptic('notificationWarning')
  }, [])

  // Once the intention is saved this component has nothing left to show. The
  // card that displays it belongs with the other daily numbers in the profile
  // tab, not floating over the board where its text landed in the artwork.
  if (!visible) {
    return null
  }

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.dialog, isDark && styles.dialogDark]}>
          <Text
            h="h2"
            title={t('intentionPrompt.title')}
            textStyle={styles.title}
          />
          <Space height={vs(12)} />
          <Text h="h10" title={t('intentionPrompt.body')} oneColor="#E0E0E0" />
          <Space height={vs(16)} />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('intentionPrompt.placeholder')}
            placeholderTextColor={dimGray}
            multiline
            maxLength={200}
            style={[styles.input, { color: isDark ? white : '#1c1c1c' }]}
            accessibilityLabel={t('intentionPrompt.inputLabel')}
          />
          <Space height={vs(16)} />
          <View style={styles.row}>
            <ButtonWithIcon
              h="h5"
              title={t('actions.skip')}
              onPress={handleSkip}
              viewStyle={styles.flex}
            />
            <Space width={s(12)} />
            <ButtonWithIcon
              h="h5"
              title={t('done')}
              onPress={handleSave}
              viewStyle={styles.flex}
            />
          </View>
          <Pressable style={styles.close} onPress={handleSkip}>
            <Text h="h5" title="✕" />
          </Pressable>
        </View>
      </View>
    </Modal>
  )
})

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: s(24)
  },
  dialog: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: s(16),
    padding: s(20)
  },
  dialogDark: {
    backgroundColor: '#2C2C2C'
  },
  title: {
    textAlign: 'center'
  },
  input: {
    minHeight: vs(80),
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.4)',
    borderRadius: s(10),
    padding: s(10),
    textAlignVertical: 'top',
    fontSize: s(14)
  },
  row: {
    flexDirection: 'row'
  },
  flex: {
    flex: 1
  },
  close: {
    position: 'absolute',
    top: s(12),
    right: s(16)
  },
  card: {
    marginHorizontal: s(16),
    marginTop: vs(6),
    marginBottom: vs(6),
    padding: s(12),
    borderRadius: s(12),
    backgroundColor: 'rgba(179, 157, 219, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(179, 157, 219, 0.5)'
  },
  cardDark: {
    backgroundColor: 'rgba(179, 157, 219, 0.28)'
  },
  label: {
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  }
})
