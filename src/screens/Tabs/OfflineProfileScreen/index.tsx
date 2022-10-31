import React from 'react'
import { SectionList, StyleSheet } from 'react-native'
import { observer } from 'mobx-react-lite'
import { s } from 'react-native-size-matters'

import { I18n } from '../../../utils'
import { RootTabParamList, RootStackParamList } from '../../../types'
import {
  AppContainer,
  Text,
  Space,
  Button,
  Spin,
  CenterView,
  HistoryStep
} from '../../../components'
import { DiceStore, OfflinePlayers, OnlinePlayer } from '../../../store'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useHistoryData } from '../../../hooks'

type navigation = NativeStackNavigationProp<
  RootTabParamList & RootStackParamList,
  'TAB_BOTTOM_3'
>

type ProfileScreenT = {
  navigation: navigation
}

export const OfflineProfileScreen = observer(({ navigation }: ProfileScreenT) => {
  const { DATA } = useHistoryData()

  return (
    <AppContainer
      iconRight={':books:'}
      iconLeft={':information_source:'}
      title={I18n.t('history')}
      textAlign="center"
    >
      <CenterView>
        {OnlinePlayer.store.loadingProf && DiceStore.online ? (
          <Spin centered />
        ) : (
          <SectionList
            style={{ paddingHorizontal: s(10) }}
            ListHeaderComponent={<Space height={10} />}
            ListFooterComponent={
              <>
                <Space height={70} />
                <Button
                  title={I18n.t('startOver')}
                  onPress={
                    DiceStore.online ? OnlinePlayer.resetGame : OfflinePlayers.resetGame
                  }
                />
                <Space height={20} />
                {DiceStore.online && (
                  <>
                    <Button title={I18n.t('signOut')} onPress={OnlinePlayer.SignOut} />
                    <Space height={20} />
                  </>
                )}
                <Space height={200} />
              </>
            }
            initialNumToRender={60}
            maxToRenderPerBatch={60}
            stickySectionHeadersEnabled={false}
            sections={DATA}
            renderItem={props => <HistoryStep {...props} />}
            keyExtractor={(e, id) => String(id)}
            showsVerticalScrollIndicator={false}
            renderSectionHeader={({ section: { title } }) =>
              title ? (
                <Text h={'h3'} title={title} textStyle={{ padding: 15, marginTop: 10 }} />
              ) : (
                <Space height={20} />
              )
            }
          />
        )}
      </CenterView>
    </AppContainer>
  )
})

const styles = StyleSheet.create({
  container: {}
})

const { container } = styles
