import React from 'react'

import { StyleSheet } from 'react-native'
import { Icon } from 'react-native-elements'
import { s } from 'react-native-size-matters'

import { Row } from '../'
import { openUrl, secondary } from '../../constants'

interface SocialLinksT {
  music?: boolean
}

export function SocialLinks({ music }: SocialLinksT) {
  return music ? (
    <>
      <Row>
        <Icon
          name="soundcloud"
          type="font-awesome"
          color={secondary}
          size={s(40)}
          containerStyle={containerStyle}
          onPress={() => openUrl('https://soundcloud.com/play_ra/sets/all-mix-playra')}
        />
        <Icon
          name="instagram"
          type="font-awesome"
          color={secondary}
          size={s(40)}
          containerStyle={containerStyle}
          onPress={() => openUrl('https://instagram.com/playra')}
        />
        <Icon
          name="facebook"
          type="font-awesome"
          color={secondary}
          size={s(40)}
          containerStyle={containerStyle}
          onPress={() => openUrl('https://www.facebook.com/playraMusic')}
        />
        <Icon
          name="spotify"
          type="font-awesome"
          color={secondary}
          size={s(40)}
          containerStyle={containerStyle}
          onPress={() =>
            openUrl(' https://open.spotify.com/album/3oYpszdQXVgtGzVq02u79Z')
          }
        />
      </Row>
      <Row>
        <Icon
          name="telegram"
          type="font-awesome"
          color={secondary}
          size={s(40)}
          containerStyle={containerStyle}
          onPress={() => openUrl('https://t.me/leelachakraapp')}
        />
        <Icon
          name="apple"
          type="font-awesome"
          color={secondary}
          size={s(40)}
          containerStyle={containerStyle}
          onPress={() =>
            openUrl(
              'https://music.apple.com/ru/album/maha-kumbha-mela/1551347338?at=1000l9WJ&ct=bq&uo=4&app=music',
            )
          }
        />
        <Icon
          name="odnoklassniki"
          type="font-awesome"
          color={secondary}
          size={s(40)}
          containerStyle={containerStyle}
          onPress={() => openUrl('https://ok.ru/music/playlist/15044903371')}
        />
        <Icon
          name="vk"
          type="font-awesome"
          color={secondary}
          size={s(40)}
          containerStyle={containerStyle}
          onPress={() => openUrl('https://vk.com/playramusic')}
        />
      </Row>
    </>
  ) : (
    <Row>
      <Icon
        name="instagram"
        type="font-awesome"
        color={secondary}
        size={s(40)}
        containerStyle={containerStyle}
        onPress={() => openUrl('https://instagram.com/leela.chakra')}
      />
      <Icon
        name="facebook"
        type="font-awesome"
        color={secondary}
        size={s(40)}
        containerStyle={containerStyle}
        onPress={() => openUrl('https://www.facebook.com/leelachakraapp')}
      />
      <Icon
        name="vk"
        type="font-awesome"
        color={secondary}
        size={s(40)}
        containerStyle={containerStyle}
        onPress={() => openUrl('https://vk.com/leela.chakra')}
      />
      <Icon
        name="telegram"
        type="font-awesome"
        color={secondary}
        size={s(40)}
        containerStyle={containerStyle}
        onPress={() => openUrl('https://t.me/leelachakraapp')}
      />
    </Row>
  )
}

const styles = StyleSheet.create({
  containerStyle: {
    margin: s(20),
  },
})

const { containerStyle } = styles
