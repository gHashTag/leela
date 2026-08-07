import React, { memo, useCallback, useMemo, useState } from 'react'

import { useTranslation } from 'react-i18next'
import {
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { ButtonWithIcon, Space, Text } from '../../components'
import { captureException, dimGray, primary, white } from '../../constants'

export type FeedbackCategory = 'ux' | 'bug' | 'feature' | 'content'

interface UxFeedbackProps {
  storageKey?: string
}

const CATEGORIES: FeedbackCategory[] = ['ux', 'bug', 'feature', 'content']

export const UxFeedback = memo(({ storageKey = '@uxFeedback' }: UxFeedbackProps) => {
  const { t } = useTranslation()
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'

  const [visible, setVisible] = useState(false)
  const [category, setCategory] = useState<FeedbackCategory>('ux')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const categoryLabel = useMemo(
    () => t(`uxFeedback.categories.${category}`),
    [category, t]
  )

  const open = useCallback(() => {
    setCategory('ux')
    setMessage('')
    setSent(false)
    setVisible(true)
  }, [])

  const close = useCallback(() => setVisible(false), [])

  const submit = useCallback(async () => {
    const text = message.trim()
    if (!text) return

    const payload = {
      category,
      message: text,
      timestamp: new Date().toISOString(),
      locale: t('profile') === 'Profile' ? 'en' : 'ru'
    }

    try {
      // Store locally for batching/forwarding by the app later. Sending directly
      // from the client would expose an endpoint or API key, which the loop
      // instructions forbid.
      const existing = await AsyncStorageGetItem(storageKey)
      const list = existing ? JSON.parse(existing) : []
      list.unshift(payload)
      await AsyncStorageSetItem(storageKey, JSON.stringify(list.slice(0, 50)))
      setSent(true)
      setMessage('')
    } catch (error) {
      captureException(error, 'UxFeedback: submit')
    }
  }, [category, message, storageKey, t])

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={open}
        style={[styles.button, isDark && styles.buttonDark]}
        accessibilityLabel={t('uxFeedback.buttonLabel')}
      >
        <Text h="h11" title="💬" />
        <Space width={s(6)} />
        <Text h="h11" title={t('uxFeedback.button')} oneColor={primary} />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Pressable onPress={close} style={styles.closeRow}>
              <Text h="h5" title="✕" />
            </Pressable>

            <Text
              h="h2"
              textStyle={styles.modalTitle}
              title={t('uxFeedback.title')}
            />
            <Space height={vs(10)} />

            <Text h="h8" title={t('uxFeedback.categoryLabel')} oneColor={dimGray} />
            <Space height={vs(6)} />
            <View style={styles.categories}>
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[
                    styles.categoryChip,
                    category === cat && styles.categoryChipActive
                  ]}
                >
                  <Text
                    h="h10"
                    title={t(`uxFeedback.categories.${cat}`)}
                    oneColor={category === cat ? white : dimGray}
                  />
                </Pressable>
              ))}
            </View>

            <Space height={vs(12)} />
            <TextInput
              style={styles.input}
              multiline
              maxLength={1000}
              placeholder={t('uxFeedback.placeholder')}
              placeholderTextColor={dimGray}
              value={message}
              onChangeText={setMessage}
            />
            <Space height={vs(6)} />
            <Text
              h="h11"
              title={`${message.length}/1000`}
              textStyle={styles.counter}
              oneColor={dimGray}
            />

            <Space height={vs(14)} />
            {sent ? (
              <Text h="h7" title={t('uxFeedback.thanks')} textStyle={styles.thanks} />
            ) : (
              <ButtonWithIcon
                iconName="send-outline"
                title={t('uxFeedback.send')}
                onPress={submit}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  )
})

// Wrapped AsyncStorage helpers keep the component file self-contained and
// make later unit testing possible without importing RN modules directly.
const AsyncStorageGetItem = async (key: string): Promise<string | null> => {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage'))
    .default
  return AsyncStorage.getItem(key)
}

const AsyncStorageSetItem = async (key: string, value: string) => {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage'))
    .default
  await AsyncStorage.setItem(key, value)
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: s(16),
    marginTop: vs(8),
    padding: s(8),
    borderRadius: s(10),
    backgroundColor: 'rgba(80, 227, 194, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(80, 227, 194, 0.4)'
  },
  buttonDark: {
    backgroundColor: 'rgba(80, 227, 194, 0.18)'
  },
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
  modalTitle: {
    fontWeight: 'bold',
    color: '#1c1c1c',
    textAlign: 'center'
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(8)
  },
  categoryChip: {
    paddingHorizontal: s(10),
    paddingVertical: s(6),
    borderRadius: s(16),
    borderWidth: 1,
    borderColor: dimGray,
    backgroundColor: 'transparent'
  },
  categoryChipActive: {
    borderColor: primary,
    backgroundColor: primary
  },
  input: {
    width: '100%',
    minHeight: vs(120),
    borderWidth: 1,
    borderColor: dimGray,
    borderRadius: s(10),
    padding: s(10),
    color: '#1c1c1c',
    textAlignVertical: 'top'
  },
  counter: {
    alignSelf: 'flex-end'
  },
  thanks: {
    textAlign: 'center',
    color: primary
  }
})
