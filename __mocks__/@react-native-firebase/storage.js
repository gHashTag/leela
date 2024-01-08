// __mocks__/@react-native-firebase/storage.js

export default () => {
  return {
    ref: jest.fn(() => ({
      putFile: jest.fn(() =>
        Promise.resolve({
          state: 'success',
          downloadURL: 'https://example.com/image.jpg' // URL вашего мок-изображения
        })
      )
    }))
  }
}
