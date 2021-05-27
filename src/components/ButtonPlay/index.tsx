import { useTheme } from '@react-navigation/native'
import React, { memo, useState } from 'react'
import { TouchableOpacity, Image, StyleSheet, View } from 'react-native'
import { useNetInfo } from '@react-native-community/netinfo'
import { actionPlay, TrackT } from '../../store'
import { NetworkCheckingModal } from '../NetworkCheckingModal'

import { ICONS } from './images'

interface ButtonPlayT {
  type: boolean
  obj: TrackT
  onPress?: () => void
}
const circle = 60

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    width: circle,
    height: circle,
    borderRadius: circle / 2,
    shadowColor: 'black',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.5,
    elevation: 5,
    alignSelf: 'center'
  },
  buttonStyle: {
    top: 2,
    width: 70,
    height: 70
  }
})

const ButtonPlay = memo<ButtonPlayT>(({ type = false, obj }) => {
  const [modalVisible, setVisible] = useState(false)

  const source = () => ICONS[type ? 'pause' : 'play']
  const { container, buttonStyle } = styles

  const netInfo = useNetInfo()

  const start = async () => {
    !netInfo.isConnected && setVisible(!modalVisible)
    actionPlay.play(obj)
  }

  const {
    colors: { background }
  } = useTheme()

  return (
    <>
      {modalVisible && <NetworkCheckingModal />}
      <TouchableOpacity onPress={start}>
        <View style={[container, { backgroundColor: background }]}>
          <Image source={source()} style={buttonStyle} />
        </View>
      </TouchableOpacity>
    </>
  )
})

export { ButtonPlay }
