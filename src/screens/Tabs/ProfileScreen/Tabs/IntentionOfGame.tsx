import React, { useContext } from 'react'

import { observer } from 'mobx-react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import { s, vs } from 'react-native-size-matters'

import {
  Button,
  ButtonEdit,
  EmptyComments,
  Space,
  Text
} from '../../../../components'
import { useTypedNavigation } from '../../../../hooks'
import { OnlinePlayer } from '../../../../store'
import { TabContext } from '../TabContext'
import { triggerHaptic } from '../../../../utils/haptics'

export const IntentionOfGame = observer(() => {
  const { t } = useTranslation()
  const { navigate } = useTypedNavigation()
  const { headerGesture } = useContext(TabContext) as any
  const intention = OnlinePlayer.store.profile.intention

  const handleEdit = () => {
    triggerHaptic('impactMedium')
    navigate('CHANGE_INTENTION_SCREEN', { prevIntention: intention })
  }

  const isEmpty = !intention || intention.trim().length === 0

  return (
    <GestureDetector gesture={headerGesture}>
      <View style={container}>
        <Space height={5} />
        {!isEmpty && <ButtonEdit viewStyle={btnEdit} onPress={handleEdit} />}
        {!isEmpty && <Space height={5} />}
        {!isEmpty && <Text title={intention} h="h5" />}
        {isEmpty && (
          <View style={styles.emptyContainer}>
            <EmptyComments />
            <Space height={vs(16)} />
            <Text
              h="h4"
              title={t('profileEmpty.intentionTitle')}
              textStyle={styles.title}
            />
            <Space height={vs(8)} />
            <Text
              h="h6"
              title={t('profileEmpty.intentionMessage')}
              textStyle={styles.message}
            />
            <Space height={vs(24)} />
            <Button
              title={t('profileEmpty.intentionAction')}
              onPress={handleEdit}
              testID="intention-empty-action"
            />
          </View>
        )}
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
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(24)
  },
  title: {
    textAlign: 'center',
    fontWeight: 'bold'
  },
  message: {
    textAlign: 'center'
  }
})

const { container, btnEdit } = styles
