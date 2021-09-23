import { action } from '@storybook/addon-actions'
import { text } from '@storybook/addon-knobs'
import { storiesOf } from '@storybook/react-native'
import React from 'react'
import { Txt } from '../components'
import CenterView from '../components/CenterView'
import { useDarkMode } from 'storybook-dark-mode'
// your theme provider
const ThemeContext = React.createContext({})

const DarkTheme = {
  dark: true,
  colors: {
    primary: '#FF06F4',
    background: '#1c1c1c',
    card: 'rgb(255, 255, 255)',
    text: '#FFFF',
    border: 'rgb(199, 199, 204)',
    notification: 'rgb(255, 69, 58)'
  }
}

const LightTheme = {
  dark: false,
  colors: {
    primary: '#FF06F4',
    background: '#FFF',
    card: 'rgb(255, 255, 255)',
    text: '#1c1c1c',
    border: 'rgb(199, 199, 204)',
    notification: 'rgb(255, 69, 58)'
  }
}

// create a component that uses the dark mode hook
function ThemeWrapper(props) {
  // render your custom theme provider
  console.log(`useDarkMode()`, useDarkMode())
  return <ThemeContext.Provider value={useDarkMode() ? DarkTheme : LightTheme}>{props.children}</ThemeContext.Provider>
}

storiesOf('Txt', module)
  //.addDecorator((renderStory) => <ThemeWrapper>{renderStory()}</ThemeWrapper>)
  .addDecorator(getStory => <CenterView>{getStory()}</CenterView>)
  .add('H0', () => <Txt h0 title="H0" />)
  .add('H1', () => <Txt h1 title="H1" />)
  .add('H2', () => <Txt h2 title="H2" />)
  .add('H3', () => <Txt h3 title="H3" />)
  .add('H4', () => <Txt h4 title="H4" />)
  .add('H5', () => <Txt h5 title="H5" />)
  .add('H6', () => <Txt h6 title="H6" />)
  .add('H7', () => <Txt h7 title="H7" />)
  .add('H8', () => <Txt h8 title="H8" />)
  .add('H9', () => <Txt h9 title="H9" />)
  .add('H10', () => <Txt h10 title="H10" />)
  .add('H11', () => <Txt h11 title="H11" />)
