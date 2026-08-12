import React, { memo } from 'react'

import { useTheme } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import {
  Modal,
  Pressable,
  StyleSheet,
  useColorScheme,
  View
} from 'react-native'
import { s, vs } from 'react-native-size-matters'

import { Space, Text } from '../'
import { black, lightGray, red, secondary, white } from '../../constants'
import { triggerHaptic } from '../../utils/haptics'

export interface ConfirmDialogT {
  visible: boolean
  title: string
  message: string
  confirmTitle?: string
  cancelTitle?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog = memo(
  ({
    visible,
    title,
    message,
    confirmTitle,
    cancelTitle,
    destructive = false,
    onConfirm,
    onCancel
  }: ConfirmDialogT) => {
    const { t } = useTranslation()
    const { dark, colors } = useTheme()
    const scheme = useColorScheme()
    const backgroundColor = dark ? '#1C1C1E' : white
    const textColor = dark ? white : black

    const handleConfirm = () => {
      if (destructive) {
        triggerHaptic('notificationWarning')
      } else {
        triggerHaptic('impactMedium')
      }
      onConfirm()
    }

    const handleCancel = () => {
      triggerHaptic('impactLight')
      onCancel()
    }

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleCancel}
        accessibilityViewIsModal
      >
        <View style={styles.overlay}>
          <View
            style={[
              styles.card,
              {
                backgroundColor,
                borderColor: scheme === 'dark' ? '#3A3A3C' : lightGray
              }
            ]}
          >
            <Text
              h="h2"
              title={title}
              textStyle={[styles.title, { color: textColor }]}
            />
            <Space height={vs(10)} />
            <Text
              h="h5"
              title={message}
              textStyle={[styles.message, { color: textColor }]}
            />
            <Space height={vs(20)} />
            <View style={styles.buttonRow}>
              <Pressable
                onPress={handleCancel}
                style={[
                  styles.button,
                  styles.cancelButton,
                  { backgroundColor: colors.background }
                ]}
                accessibilityRole="button"
                accessibilityLabel={cancelTitle || t('actions.cancel')}
              >
                <Text
                  h="h4"
                  title={cancelTitle || t('actions.cancel')}
                  textStyle={{ color: textColor }}
                />
              </Pressable>
              <Pressable
                onPress={handleConfirm}
                style={[
                  styles.button,
                  styles.confirmButton,
                  {
                    backgroundColor: destructive
                      ? red
                      : secondary
                  }
                ]}
                accessibilityRole="button"
                accessibilityLabel={confirmTitle || t('actions.confirm')}
              >
                <Text
                  h="h4"
                  title={confirmTitle || t('actions.confirm')}
                  textStyle={{ color: white }}
                />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    )
  }
)

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(24)
  },
  card: {
    width: '100%',
    maxWidth: s(320),
    borderRadius: s(16),
    borderWidth: 1,
    padding: s(20)
  },
  title: {
    textAlign: 'center',
    fontWeight: 'bold'
  },
  message: {
    textAlign: 'center',
    lineHeight: s(20)
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: s(12)
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: s(12),
    borderRadius: s(10)
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: lightGray
  },
  confirmButton: {}
})
