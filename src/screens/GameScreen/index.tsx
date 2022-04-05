import React, { useState, useEffect } from 'react'
import { DataStore } from 'aws-amplify'
import { observer } from 'mobx-react-lite'
import { StackNavigationProp } from '@react-navigation/stack'
import { ms, s } from 'react-native-size-matters'
import { I18n } from '../../utils'
import { View } from 'react-native'
import { RootStackParamList } from '../../types'
import { Background, Dice, GameBoard, Header, Space, Txt, ButtonElements, Spin, Button } from '../../components'
import { DiceStore, actionsDice, OnlinePlayerStore, actionPlayers } from '../../store'
import Rate from 'react-native-rate'
import { _onPressReset, getCurrentUser } from '../helper'
import { Button as ClassicBtn } from 'react-native-elements'
import { Profile, MainRoom } from '../../models'

type navigation = StackNavigationProp<RootStackParamList, 'TAB_BOTTOM_0'>

type GameScreenT = {
  navigation: navigation
}

const GameScreen = observer(({ navigation }: GameScreenT) => {
  const [leftTime, setLeftTime] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      const currentDate = Date.now()
      setLeftTime(currentDate - OnlinePlayerStore.stepTime)
      if (currentDate - OnlinePlayerStore.stepTime >= 86400000
        && OnlinePlayerStore.stepTime !== 0) {
        OnlinePlayerStore.canGo = true
      } else {
        OnlinePlayerStore.canGo = false
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if(DiceStore.online) {
      actionPlayers.getProfile()
    }
  }, [DiceStore.online])

  const LeftTime = () => {
    const timeMood = () => {
      if (!(leftTime >= 86400000)) {
        const time = 86400000 - leftTime
        switch (true) {
          case leftTime > 86340000:
            return `${(time/1000).toFixed(0)} sec.`
          case leftTime > 82800000:
            return `${Math.ceil((time/60/1000)).toFixed(0)} min.`
          case leftTime <= 82800000:
            return `${Math.floor((time/60/60/1000)).toFixed(0)} h.`
        } 
      } else {
        return '0'
      }
    }
    return <Txt h3 title={`nextStep: ${timeMood()}`} />
  }
  
  // del on release
  const createRoom = async (): Promise<void> => {
    try {
      const room = await DataStore.query(MainRoom)
      if (!room) {
        DataStore.save(new MainRoom({
          code: 'dfd041-14dw'
        }))
      }
    } catch (error) {
      console.log(error)
    }
  }

  const enterRoom = async (): Promise<void> => {
    try {
      const user = await getCurrentUser()
      const room = await DataStore.query(MainRoom)
      if (user && room) {
        OnlinePlayerStore.profile.mainRoomId = room[0].id
        await DataStore.save(
          Profile.copyOf(user, updated => {
          updated.mainHelper = room[0].id
        }))
      }
    } catch (error) {
      console.log(error)
    }
    
  }

  const _onPress = () => {
    const options = {
      AppleAppID: '1296604457',
      GooglePackageName: 'com.leelagame',
      OtherAndroidURL: 'https://play.google.com/store/apps/details?id=com.leelagame',
      preferInApp: false,
      openAppStoreIfInAppFails: true
    }
    Rate.rate(options, success => actionsDice.setRate(success))
  }

  return <Background>
      {OnlinePlayerStore.loading && DiceStore.online ? 
        <Spin />
       : 
        <>
          <Header
            iconLeft=":information_source:"
            onPress={() => navigation.navigate('RULES_SCREEN')}
            iconRight=":books:"
            onPressRight={() => navigation.navigate('PLANS_SCREEN')}
          >
            {(!DiceStore.online || OnlinePlayerStore.profile.mainRoomId) &&
            <>
              {DiceStore.finishArr.indexOf(true) !== -1 ? 
              <>
                {!OnlinePlayerStore.canGo && DiceStore.online ?
                  <LeftTime />
                : 
                  <Txt h3 title={DiceStore.online ? 'Your turn' : `${I18n.t('playerTurn')} # ${DiceStore.players}`} />
                }
                <Space height={1} />
                <Txt h3 title={DiceStore.message} />
                <Dice />
              </>
               : 
              <>
                <Space height={s(60)} />
                <ButtonElements title={I18n.t('startOver')} onPress={() => _onPressReset(navigation)} />
                <Space height={s(10)} />
                <Txt h0 title={`${I18n.t('win')}`} />
                {!DiceStore.rate && <ClassicBtn title={I18n.t('leaveFeedback')} onPress={_onPress} />}
              </>
              }
            </>}
          </Header>
          <Space height={ms(85, 0.1)} />
          {DiceStore.online && !OnlinePlayerStore.profile.mainRoomId ? 
            <View style={{justifyContent: 'center', height: ms(260)}}>
              <Button title='+room' onPress={() => createRoom()} />
              <Space height={ms(15)} />
              <Button title='start?' onPress={() => enterRoom()} />
            </View>
          :
            <GameBoard />
          }
          <Space height={s(0)} />
        </>
      }
    </Background>
  
})

export { GameScreen }
