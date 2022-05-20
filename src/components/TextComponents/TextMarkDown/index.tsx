import React, { memo } from 'react'
import { StyleSheet, useColorScheme } from 'react-native'
import Markdown from 'react-native-markdown-display'
import { s } from 'react-native-size-matters'

const stylesLight = StyleSheet.create({
  heading1: {
    fontSize: s(20),
    color: 'black',
    fontFamily: 'Montserrat'
  },
  heading2: {
    fontSize: s(24),
    fontFamily: 'Montserrat',
    color: 'gray'
  },
  heading3: {
    fontSize: s(18),
    fontFamily: 'Montserrat',
    color: 'gray'
  },
  heading4: {
    fontSize: s(16),
    fontFamily: 'Montserrat',
    color: 'gray'
  },
  heading5: {
    fontSize: s(13),
    fontFamily: 'Montserrat',
    color: 'gray'
  },
  heading6: {
    fontSize: s(11),
    fontFamily: 'Montserrat',
    color: 'gray'
  }
})

const stylesDark = StyleSheet.create({
  heading1: {
    fontSize: s(20),
    color: 'white',
    fontFamily: 'Montserrat'
  },
  heading2: {
    fontSize: s(24),
    fontFamily: 'Montserrat',
    color: 'gray'
  },
  heading3: {
    fontSize: s(18),
    fontFamily: 'Montserrat',
    color: 'gray'
  },
  heading4: {
    fontSize: s(16),
    fontFamily: 'Montserrat',
    color: 'gray'
  },
  heading5: {
    fontSize: s(13),
    fontFamily: 'Montserrat',
    color: 'gray'
  },
  heading6: {
    fontSize: s(11),
    fontFamily: 'Montserrat',
    color: 'gray'
  }
})

interface TextMarkDownT {
  title: string
}

const TextMarkDown = memo<TextMarkDownT>(({ title }) => {
  const scheme = useColorScheme()
  const styles = scheme === 'dark' ? stylesDark : stylesLight
  return <Markdown style={styles}>{title}</Markdown>
})

export { TextMarkDown }
