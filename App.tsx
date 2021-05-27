import React from 'react'
import { Text, View, Button, StyleSheet } from 'react-native'
import { LocalNotification } from './LocalPushController'
import RemotePushController from './RemotePushController'

const App = () => {
  const handleButtonPress = () => {
    LocalNotification()
  }

  return (
    <View style={styles.container}>
      <RemotePushController />
      <Text>Press a button to trigger the notification</Text>
      <View style={{ marginTop: 20 }}>
        <Button title={'Local Push Notification'} onPress={handleButtonPress} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  buttonContainer: {
    marginTop: 20
  }
})

export default App
