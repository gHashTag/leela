export default {
  setString: jest.fn().mockResolvedValue(undefined),
  getString: jest.fn().mockResolvedValue(''),
  hasString: jest.fn().mockResolvedValue(false)
}
