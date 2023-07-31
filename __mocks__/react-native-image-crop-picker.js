// __mocks__/react-native-image-crop-picker.js

export default {
  openPicker: jest.fn().mockResolvedValue({
    path: '../assets/icons/1024.png', // Путь к вашему мок-изображению
    width: 1920,
    height: 1080
  })
}
