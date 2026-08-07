export default {
  configure: jest.fn(),
  setLogLevel: jest.fn(),
  getOfferings: jest.fn().mockResolvedValue({
    current: null,
    all: {}
  }),
  purchasePackage: jest.fn().mockResolvedValue({
    customerInfo: { entitlements: { all: {} } }
  }),
  restorePurchases: jest.fn().mockResolvedValue({
    customerInfo: { entitlements: { all: {} } }
  }),
  getCustomerInfo: jest.fn().mockResolvedValue({
    entitlements: { all: {} }
  }),
  addCustomerInfoUpdateListener: jest.fn().mockReturnValue({ remove: jest.fn() })
}

export const LOG_LEVEL = {
  VERBOSE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4
}
