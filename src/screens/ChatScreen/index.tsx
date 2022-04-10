import React, { useState, useCallback, useEffect } from 'react'
import { GiftedChat } from 'react-native-gifted-chat'
import { Header } from '../../components'
import { goBack } from '../../constants'
import { DataStore, SortDirection, Storage } from 'aws-amplify'
import { OnlinePlayerStore } from '../../store'
import { Message } from '../../models'
import { debounce } from 'lodash'
import { StackNavigationProp } from '@react-navigation/stack'
import { RootStackParamList } from '../../types'

interface Ichat {
  navigation: StackNavigationProp<RootStackParamList, 'CHAT_SCREEN'>
}

const ChatScreen: React.FC<Ichat> = ({navigation}) => {
  const [messages, setMessages] = useState<any[]>([])
  const { profile, avatar, nextAvatar } =  OnlinePlayerStore

  /*const fetchMess = async () => {
    const mess = await DataStore.query(Message, 
      c => c.mainHelper('eq', profile.mainRoomId), {
        sort: s => s.createdAt(SortDirection.DESCENDING)
      })
    const correctMess = await Promise.all(mess.map(async(a, id) => {
      const avatarUrl = a.avatar && await Storage.get(a.avatar)
        return {
        _id: a.id,
        text: a.text,
        createdAt: a.createdAt,
        user: {
          _id: a.profId,
          name: a.name,
          avatar: avatarUrl,
        },
      }
    }))
    setMessages(correctMess)
  }*/

  const updateMess = async () => {
    const mess = await DataStore.query(Message, 
      c => c.mainHelper('eq', profile.mainRoomId), {
      sort: s => s.createdAt(SortDirection.DESCENDING)
    })
    //const newMess = mess.filter((a, id) => 
    //  messages.find(b => b._id === a.id) ? false : true)
    const res = await Promise.all(mess.map(async(a, id) => {
      const avatarUrl = a.avatar && await Storage.get(a.avatar)
        return {
        _id: a.id,
        text: a.text,
        createdAt: a.createdAt,
        user: {
          _id: a.profId,
          name: a.name,
          avatar: avatarUrl,
        },
      }
    }))
    console.log(res.length)
    setMessages(res)
  }

  useEffect(() => {
    updateMess()
    const messSub = DataStore.observe(Message).subscribe(updateMess)
    return () => {
      console.log('exitMeesager')
      messSub.unsubscribe()
    }
  }, [])

  const onSend = useCallback(async (messages = []) => {
    const {user, text} = messages[0]
    await DataStore.save(new Message({
      name: user.name,
      avatar: nextAvatar,
      profId: user._id,
      text: text,
      mainHelper: profile.mainRoomId
    }))
  }, [])

  return <>
    <Header iconLeft=':back:' onPress={goBack(navigation)} />
    <GiftedChat
      keyboardShouldPersistTaps='never'
      maxInputLength={150}
      showUserAvatar
      renderUsernameOnMessage
      messages={messages}
      onSend={messages => onSend(messages)}
      user={{
        _id: profile.id,
        avatar: avatar,
        name: `${profile.firstName} ${profile.lastName}`
      }}
    />
  </>
}

export { ChatScreen }

/*import React from 'react'
import { Text, View, TextInput, Button, StyleSheet } from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { observer } from 'mobx-react-lite'
import { StackNavigationProp } from '@react-navigation/stack'
import { I18n } from '../../utils'
import { RootStackParamList } from '../../types'
import { Background, ButtonElements } from '../../components'

type navigation = StackNavigationProp<RootStackParamList, 'TAB_BOTTOM_2'>

type ChatScreenT = {
  navigation: navigation
}

const styles = StyleSheet.create({
  input: {
    height: 40,
    margin: 12,
    borderWidth: 1
  }
})

const ChatScreen = observer(({ navigation }: ChatScreenT) => {
  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm()

  const onSubmit = data => console.log(data)

  return (
    <Background imageStyle={{ justifyContent: 'center' }}>
      <View>
        <Controller
          control={control}
          rules={{
            required: true
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput style={styles.input} onBlur={onBlur} onChangeText={value => onChange(value)} value={value} />
          )}
          name="firstName"
          rules={{ required: true }}
          defaultValue=""
        />
        {errors.firstName && <Text>This is required.</Text>}

        <Controller
          control={control}
          rules={{
            maxLength: 100
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput style={styles.input} onBlur={onBlur} onChangeText={value => onChange(value)} value={value} />
          )}
          name="lastName"
          defaultValue=""
        />

        <Button title="Submit" onPress={handleSubmit(onSubmit)} />
      </View>
      <ButtonElements title={I18n.t('signIn')} onPress={() => navigation.navigate('PLAYRA_SCREEN')} />
    </Background>
  )
})

export { ChatScreen }*/
