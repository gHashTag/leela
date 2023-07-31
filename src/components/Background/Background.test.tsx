import React from 'react'
import { render } from '@testing-library/react-native'

import { Background, RenderImagePart } from './' // Update with your actual path
import { Text } from 'react-native'

describe('Background', () => {
  it('renders correctly', () => {
    const { getByTestId } = render(
      <Background
        status="bg"
        sourceImages={['img1', 'img2']}
        enableBottomInsets={true}
        enableTopInsets={true}
      >
        <Text>Test</Text>
      </Background>
    )

    expect(getByTestId('container')).toBeTruthy()
    expect(getByTestId('imgContainer')).toBeTruthy()
  })
})

describe('RenderImagePart', () => {
  it('renders correctly', () => {
    const { getByTestId } = render(
      <RenderImagePart
        img="testImg"
        id={0}
        isUri={false}
        images={['img1', 'img2']}
      />
    )

    expect(getByTestId('subImgContainer')).toBeTruthy()
    expect(getByTestId('imgStyle')).toBeTruthy()
  })
})
