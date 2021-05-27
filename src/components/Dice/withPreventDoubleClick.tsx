import React from 'react'
import { debounce } from 'lodash' // 4.0.8

const withPreventDoubleClick = WrappedComponent => {
  class PreventDoubleClick extends React.PureComponent {
    debouncedOnPress = () => {
      this.props.onPress && this.props.onPress()
    }

    onPress = debounce(this.debouncedOnPress, 300, { leading: true, trailing: false })

    render() {
      return <WrappedComponent {...this.props} onPress={this.onPress} />
    }
  }
  return PreventDoubleClick
}

export default withPreventDoubleClick
