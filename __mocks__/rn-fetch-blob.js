export default {
  fetch: jest.fn().mockResolvedValue({
    path: jest.fn().mockResolvedValue('/mock/path'),
    flush: jest.fn().mockResolvedValue(undefined)
  }),
  config: jest.fn().mockReturnValue({
    fetch: jest.fn().mockResolvedValue({
      path: jest.fn().mockResolvedValue('/mock/path'),
      flush: jest.fn().mockResolvedValue(undefined)
    })
  }),
  fs: {
    dirs: {
      MainBundleDir: jest.fn(),
      CacheDir: '/mock/cache',
      DocumentDir: '/mock/documents'
    },
    createFile: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(''),
    exists: jest.fn().mockResolvedValue(true),
    dirs: {
      MainBundleDir: jest.fn(),
      CacheDir: '/mock/cache',
      DocumentDir: '/mock/documents'
    }
  },
  wrap: jest.fn((value) => value)
}
