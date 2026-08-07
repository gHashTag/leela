export default {
  captureRef: jest.fn().mockResolvedValue('/mock/path/to/capture.png'),
  captureScreen: jest.fn().mockResolvedValue('/mock/path/to/screen.png'),
  releaseCapture: jest.fn()
}
