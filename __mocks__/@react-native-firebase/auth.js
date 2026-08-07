export default jest.fn(() => ({
  signInWithEmailAndPassword: jest.fn(() => Promise.resolve()),
  currentUser: { uid: 'test-uid', email: 'test@example.com' }
}))
