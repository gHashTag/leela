import React, { useState } from 'react'
import { useNetInfo, NetInfoStateType } from '@react-native-community/netinfo'
import { View, Modal } from 'react-native'

const NetworkCheckingModal = () => {
  const [modalVisible, setModalVisible] = useState(true)
  const netInfo = useNetInfo()

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={
        modalVisible &&
        netInfo.type !== NetInfoStateType.unknown &&
        netInfo.isInternetReachable !== null &&
        netInfo.isInternetReachable !== undefined &&
        !netInfo.isInternetReachable
      }
    ></Modal>
  )
}

export { NetworkCheckingModal }
