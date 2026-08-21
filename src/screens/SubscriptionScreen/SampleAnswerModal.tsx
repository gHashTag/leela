import React from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ms } from 'react-native-size-matters'

import { ButtonWithIcon, Space, Text } from '../../components'
import { RADIUS, SPACE, TOUCH, useTheme, type Palette } from '../../theme'

interface SampleAnswerModalT {
  visible: boolean
  onClose: () => void
  onContinue: () => void
}

export const SampleAnswerModal: React.FC<SampleAnswerModalT> = ({
  visible,
  onClose,
  onContinue
}) => {
  const { t } = useTranslation()
  const palette = useTheme()
  const styles = React.useMemo(() => stylesFor(palette), [palette])
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
              title={t('sampleAnswer.title')}
            />
            <Space height={16} />
            <Text
              h="h4"
              textStyle={styles.question}
              title={`“${t('sampleAnswer.question')}”`}
            />
            <Space height={16} />
            <Text
              h="h5"
              textStyle={styles.answer}
              title={t('sampleAnswer.answer')}
            />
          </ScrollView>
          <Space height={16} />
          <ButtonWithIcon
            h="h5"
            title={t('sampleAnswer.cta')}
            onPress={onContinue}
          />
          <Space height={10} />
          <Text
            h="h5"
            textStyle={styles.dismiss}
            title={t('sampleAnswer.dismiss')}
            onPress={onClose}
          />
        </View>
      </View>
    </Modal>
  )
}

/**
 * The sample answer, in whichever light the phone is set to.
 *
 * This sheet knew nothing about the scheme: white paper, black type and a
 * magenta question, opened from a paywall that had just drawn itself black. On
 * a dark phone it arrived as a rectangle of daylight, and it is the one place a
 * player reads a long passage before deciding to pay.
 */
const stylesFor = (palette: Palette) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      // Shadow, not surface: the scrim stays black in both schemes.
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'flex-end'
    },
    card: {
      backgroundColor: palette.surface,
      borderTopLeftRadius: RADIUS,
      borderTopRightRadius: RADIUS,
      paddingHorizontal: SPACE.md,
      paddingTop: SPACE.md,
      paddingBottom: SPACE.xl,
      maxHeight: '88%'
    },
    closeRow: {
      alignSelf: 'flex-end',
      // Four points of padding around a glyph is not a button.
      minWidth: TOUCH,
      minHeight: TOUCH,
      alignItems: 'flex-end',
      justifyContent: 'center'
    },
    title: {
      fontWeight: 'bold',
      color: palette.text,
      textAlign: 'center'
    },
    question: {
      // The player's own words, set apart by the accent rather than by a
      // magenta that belongs to no scheme.
      color: palette.accent,
      fontStyle: 'italic'
    },
    answer: {
      lineHeight: ms(22, 0.6),
      color: palette.text
    },
    dismiss: {
      textAlign: 'center',
      textDecorationLine: 'underline',
      color: palette.hint
    }
  })
