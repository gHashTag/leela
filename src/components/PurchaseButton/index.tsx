import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  TouchableOpacityProps
} from 'react-native'
import { PurchasesPackage } from 'react-native-purchases'
import { s } from 'react-native-size-matters'
import { Text } from '../../components'
import { gray, trueBlue, white } from '../../constants'

interface PurchaseButtonProps extends TouchableOpacityProps {
  title: string
  selectedPackage?: PurchasesPackage | null
  onPress: () => void
}

const PurchaseButton: React.FC<PurchaseButtonProps> = ({
  title,
  selectedPackage,
  onPress
}) => {
  const { t } = useTranslation()

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!selectedPackage}
      style={[styles.purchaseButton, !selectedPackage && styles.disabledButton]}
    >
      <Text h="h3" textStyle={styles.buttonText} title={t(title)} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  purchaseButton: {
    backgroundColor: trueBlue,
    paddingVertical: Platform.OS === 'ios' ? s(12) : s(5),
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'center',
    width: s(170)
  },
  disabledButton: {
    width: s(170),
    backgroundColor: gray
  },
  buttonText: {
    color: white,
    fontWeight: 'bold',
    textAlign: 'center',
    alignSelf: 'center'
  }
})

export { PurchaseButton }
