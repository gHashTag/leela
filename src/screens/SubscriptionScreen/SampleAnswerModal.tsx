import React from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { ms } from 'react-native-size-matters'

import { ButtonWithIcon, Space, Text } from '../../components'
import { black, secondary, white } from '../../constants'

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
            <Text h="h5" textStyle={styles.answer} title={t('sampleAnswer.answer')} />
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end'
  },
  card: {
    backgroundColor: white,
    borderTopLeftRadius: ms(20, 0.6),
    borderTopRightRadius: ms(20, 0.6),
    paddingHorizontal: ms(20, 0.6),
    paddingTop: ms(16, 0.6),
    paddingBottom: ms(34, 0.6),
    maxHeight: '88%'
  },
  closeRow: {
    alignSelf: 'flex-end',
    padding: ms(4, 0.6)
  },
  title: {
    fontWeight: 'bold',
    color: black,
    textAlign: 'center'
  },
  question: {
    color: secondary,
    fontStyle: 'italic'
  },
  answer: {
    lineHeight: ms(22, 0.6),
    color: black
  },
  dismiss: {
    textAlign: 'center',
    textDecorationLine: 'underline',
    color: '#888'
  }
})
