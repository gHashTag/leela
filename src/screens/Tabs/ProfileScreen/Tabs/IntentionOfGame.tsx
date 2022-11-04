import React, { useContext } from 'react'
import { StyleSheet, View } from 'react-native'
import { observer } from 'mobx-react'
import { s } from 'react-native-size-matters'

import { Text, Space, ButtonEdit } from '../../../../components'
import { GestureDetector } from 'react-native-gesture-handler'
import { TabContext } from '../TabContext'
import { OnlinePlayer } from '../../../../store'
import { useTypedNavigation } from '../../../../hooks'

export const IntentionOfGame = observer(() => {
  const { navigate } = useTypedNavigation()
  const { headerGesture } = useContext(TabContext) as any
  const intention = OnlinePlayer.store.profile.intention

  const handleEdit = () => {
    navigate('CHANGE_INTENTION_SCREEN', { prevIntention: intention })
  }

  return (
    <GestureDetector gesture={headerGesture}>
      <View style={container}>
        <Space height={5} />
        <ButtonEdit viewStyle={btnEdit} onPress={handleEdit} />
        <Space height={5} />
        <Text title={intention} h="h5" />
      </View>
    </GestureDetector>
  )
})

const styles = StyleSheet.create({
  container: {
    padding: s(10),
    flex: 1
  },
  btnEdit: {
    alignSelf: 'flex-end'
  }
})

const { container, btnEdit } = styles
