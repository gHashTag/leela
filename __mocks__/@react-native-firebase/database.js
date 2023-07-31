// __mocks__/@react-native-firebase/database.js

export const firebase = {
  database: jest.fn(() => ({
    ref: jest.fn(() => ({
      once: jest.fn(() =>
        Promise.resolve({
          val: jest.fn(() => ({
            // Ваш мок-данные здесь
          }))
        })
      )
    }))
  }))
}

export const FirebaseDatabaseTypes = {
  // Здесь мокаем все типы данных, которые вы используете из FirebaseDatabaseTypes
}
