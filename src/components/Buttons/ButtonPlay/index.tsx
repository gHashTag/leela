import { useTheme } from '@react-navigation/native'
import React, { memo, useState } from 'react'
import { TouchableOpacity, Image, StyleSheet, View } from 'react-native'
import { useNetInfo } from '@react-native-community/netinfo'
import { actionPlay, TrackT } from '../../../store'
import { NetworkCheckingModal } from '../../'

import { ICONS } from './images'
import { s, ms } from 'react-native-size-matters'

interface ButtonPlayT {
  type: boolean
  obj: TrackT
  onPress?: () => void
}
const circle = ms(60)

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
    width: ms(70, 0.5),
    height: ms(70, 0.5)
  }
})

const ButtonPlay = memo<ButtonPlayT>(({ type = false, obj }) => {
  const [modalVisible, setVisible] = useState(false)

  const source = () => ICONS[type ? 'pause' : 'play']
  const { container, buttonStyle } = styles

  const netInfo = useNetInfo()

  const start = async () => {
    !netInfo.isConnected && setVisible(prev => !prev)
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
