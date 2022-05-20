import React, { useState } from 'react'
import { useNetInfo, NetInfoStateType } from '@react-native-community/netinfo'
import { View, Modal } from 'react-native'
import { ScaledSheet } from 'react-native-size-matters'
import { I18n } from '../../utils'
import { ButtonSimple } from '../'
import { Text } from '../Text'
import { Space } from '../Space'

const styles = ScaledSheet.create({
  container: {
    height: '100%',
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)'
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5
  }
})

const NetworkCheckingModal = () => {
  const [modalVisible, setModalVisible] = useState(true)
  const netInfo = useNetInfo()
  const { container, centeredView, modalView } = styles

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
    >
      <View style={container}>
        <View style={centeredView}>
          <View style={modalView}>
            <Text h={'h3'} title={I18n.t('disconnected')} />
            <Space height={20} />
            <ButtonSimple
              h="h1"
              title={I18n.t('hide')}
              onPress={() => setModalVisible(!modalVisible)}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

export { NetworkCheckingModal }
