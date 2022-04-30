import * as React from 'react'
import { FlatList } from 'react-native'
import { observer } from 'mobx-react-lite'

import { AppContainer, ModalSubscribe, RadioItem, Space } from '../../components'
import { data } from '../../components/RadioItem/data'
import { Player } from './Player'
import { actionPlay, PlayButtonStore } from '../../store'
import { useRef } from 'react'
// import { StackNavigationProp } from '@react-navigation/stack'
// import { RootStackParamList } from '../../types'
//import { actionPlay, PlayButtonStore } from '../../store/PlayButtonStore'

// type navigation = StackNavigationProp<RootStackParamList, 'RADIO_SCREEN'>

// type RadioScreenT = {
//   navigation: navigation
// }

interface RadioItemT {
  item: {
    id: number
    title: string
    url: string
    artwork: string
  }
}

const RadioScreen = observer(() => {
  const _renderItem = ({ item: { id, url } }: RadioItemT) => {
    return <RadioItem id={id} onPress={() => actionPlay.radio(id, url)} />
  }

  const _keyExtractor = (obj: any) => obj.id.toString()

  return (
    <AppContainer>
      <FlatList
        showsVerticalScrollIndicator={false}
        numColumns={2}
        ListFooterComponent={
          <>
            <Space height={20} />
            <Player />
            <ModalSubscribe />
          </>
        }
        columnWrapperStyle={{
          justifyContent: 'space-around',
          alignSelf: 'center'
        }}
        data={data.slice()}
        renderItem={_renderItem}
        keyExtractor={_keyExtractor}
      />
    </AppContainer>
  )
})

export { RadioScreen }
