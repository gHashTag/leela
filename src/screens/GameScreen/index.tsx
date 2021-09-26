import React, { useEffect, useState } from 'react'
import { Auth, API, graphqlOperation, DataStore } from 'aws-amplify'
import { observer } from 'mobx-react-lite'
import { StackNavigationProp } from '@react-navigation/stack'
import { ms, s } from 'react-native-size-matters'
import { I18n } from '../../utils'
import { listProfiles } from '../../../src/graphql/queries'
import { RootStackParamList } from '../../types'
import { Background, Dice, GameBoard, Header, Space, Txt, ButtonElements, Spin  } from '../../components'
import {
  DiceStore,
  actionPlayerOne,
  actionsDice
} from '../../store'
import { Button } from 'react-native'
import Rate from 'react-native-rate'
import { isLoggedIn, _onPressReset } from '../helper'
import { Profile } from '../../models'


type navigation = StackNavigationProp<RootStackParamList, 'TAB_BOTTOM_0'>

type GameScreenT = {
  navigation: navigation
}

const GameScreen = observer(({ navigation }: GameScreenT) => {
  const [loading, setLoading] = useState<boolean>(true)
 
  // const fetchData = async () => {
  //   // let isLog = await isLoggedIn()
  //   // if (isLog) {
  //     try {
  //       const arrProfile = await API.graphql(graphqlOperation(listProfiles))
  //       console.log(`plan`, arrProfile.data.listProfiles.items[0].plan)
  //       const plan = arrProfile.data.listProfiles.items[0].plan
  //       console.log(`plan`, plan)
  //       if(plan) {
  //         actionPlayerOne.initOnlineGame(plan)
  //       }
  //       setLoading(false)
  //     } catch (error) {
  //       console.log(`error`, error)
  //       setLoading(false)
  //     }
  //   //} 
  // }

 
  const fetchData = async () => {
    let isLog = await isLoggedIn()
    if (isLog) {
      try {
        const arrProfile = await DataStore.query(Profile)
        console.log(`arrProfile`, arrProfile)
        const plan = arrProfile[0].plan
        if(plan) {
          actionPlayerOne.initOnlineGame(plan)
        }
        setLoading(false)
      } catch (error) {
        console.log(`error`, error)
    
        setLoading(false)
      }
    } 
  }

  useEffect(() => {
    //fetchData() 
    
    setTimeout(fetchData, 1000)
  }, [navigation])
  
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

  return (
    <Background>
      {loading ? <Spin/> :
        <>
        <Header
        iconLeft=":information_source:"
        onPress={() => navigation.navigate('RULES_SCREEN')}
        iconRight=":books:"
        onPressRight={() => navigation.navigate('PLANS_SCREEN')}
      >
        <>
          {DiceStore.finishArr.indexOf(true) !== -1 ? (
            <>
              <Txt h3 title={`${I18n.t('playerTurn')} # ${DiceStore.players}`} />
              <Space height={1} />
              <Txt h3 title={DiceStore.message} />
              <Dice />
            </>
          ) : (
            <>
              <Space height={s(60)} />
              <ButtonElements
                title={I18n.t('startOver')}
                onPress={() => _onPressReset(navigation)}
              />
              <Space height={s(10)} />
              <Txt h0 title={`${I18n.t('win')}`} />
              {!DiceStore.rate && (
                <Button
                  title={I18n.t('leaveFeedback')}
                  onPress={_onPress}
                />
              )}
            </>
          )}
        </>
        
      </Header>
      <Space height={ms(85, 0.1)} />
      <GameBoard />
      
      <Space height={s(0)} />
        </>
      }
      
    </Background>
  )
})

export { GameScreen }
