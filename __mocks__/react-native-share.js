export default {
  default: jest.fn().mockResolvedValue(true),
  Share: {
    shareSingle: jest.fn().mockResolvedValue(true)
  },
  Social: {
    Instagram: 'instagram',
    InstagramStories: 'instagramstories',
    Facebook: 'facebook',
    FacebookStories: 'facebookstories',
    Twitter: 'twitter'
  }
}
