import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native'
import { PurchasesPackage } from 'react-native-purchases'
import { ms, s } from 'react-native-size-matters'
import { Text } from 'src/components'

interface PurchaseButtonProps extends TouchableOpacityProps {
  title: string
  selectedPackage?: PurchasesPackage | null
  onPress: () => void
}

const PurchaseButton: React.FC<PurchaseButtonProps> = ({
  title,
  selectedPackage,
  onPress,
}) => {
  const { t } = useTranslation()

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!selectedPackage}
      style={[styles.purchaseButton, !selectedPackage && styles.disabledButton]}
    >
      <Text h="h0" textStyle={styles.buttonText} title={t(title)} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  purchaseButton: {
    backgroundColor: '#007bff',
    paddingVertical: Platform.OS === 'ios' ? s(12) : s(5),
    paddingHorizontal: 24,
    borderRadius: 8,
    width: 200,
    alignSelf: 'center',
  },
  disabledButton: {
    width: 200,
    backgroundColor: 'gray',
  },
  buttonText: {
    color: '#fff',
    fontSize: Platform.OS === 'ios' ? s(30) : s(23),
    fontWeight: 'bold',
    width: 200,
    textAlign: 'center',
    alignSelf: 'center',
  },
})

export { PurchaseButton }
