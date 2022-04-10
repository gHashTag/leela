/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const createProfile = /* GraphQL */ `
  mutation CreateProfile(
    $input: CreateProfileInput!
    $condition: ModelProfileConditionInput
  ) {
    createProfile(input: $input, condition: $condition) {
      id
      firstName
      lastName
      email
      plan
      mainHelper
      avatar
      firstGame
      lastStepTime
      histories {
        items {
          id
          ownerProfId
          profileID
          count
          plan
          status
          createdAt
          updatedAt
          _version
          _deleted
          _lastChangedAt
          owner
        }
        nextToken
        startedAt
      }
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      owner
    }
  }
`;
export const updateProfile = /* GraphQL */ `
  mutation UpdateProfile(
    $input: UpdateProfileInput!
    $condition: ModelProfileConditionInput
  ) {
    updateProfile(input: $input, condition: $condition) {
      id
      firstName
      lastName
      email
      plan
      mainHelper
      avatar
      firstGame
      lastStepTime
      histories {
        items {
          id
          ownerProfId
          profileID
          count
          plan
          status
          createdAt
          updatedAt
          _version
          _deleted
          _lastChangedAt
          owner
        }
        nextToken
        startedAt
      }
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      owner
    }
  }
`;
export const deleteProfile = /* GraphQL */ `
  mutation DeleteProfile(
    $input: DeleteProfileInput!
    $condition: ModelProfileConditionInput
  ) {
    deleteProfile(input: $input, condition: $condition) {
      id
      firstName
      lastName
      email
      plan
      mainHelper
      avatar
      firstGame
      lastStepTime
      histories {
        items {
          id
          ownerProfId
          profileID
          count
          plan
          status
          createdAt
          updatedAt
          _version
          _deleted
          _lastChangedAt
          owner
        }
        nextToken
        startedAt
      }
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      owner
    }
  }
`;
export const createHistory = /* GraphQL */ `
  mutation CreateHistory(
    $input: CreateHistoryInput!
    $condition: ModelHistoryConditionInput
  ) {
    createHistory(input: $input, condition: $condition) {
      id
      ownerProfId
      profileID
      profile {
        id
        firstName
        lastName
        email
        plan
        mainHelper
        avatar
        firstGame
        lastStepTime
        histories {
          nextToken
          startedAt
        }
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        owner
      }
      count
      plan
      status
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      owner
    }
  }
`;
export const updateHistory = /* GraphQL */ `
  mutation UpdateHistory(
    $input: UpdateHistoryInput!
    $condition: ModelHistoryConditionInput
  ) {
    updateHistory(input: $input, condition: $condition) {
      id
      ownerProfId
      profileID
      profile {
        id
        firstName
        lastName
        email
        plan
        mainHelper
        avatar
        firstGame
        lastStepTime
        histories {
          nextToken
          startedAt
        }
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        owner
      }
      count
      plan
      status
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      owner
    }
  }
`;
export const deleteHistory = /* GraphQL */ `
  mutation DeleteHistory(
    $input: DeleteHistoryInput!
    $condition: ModelHistoryConditionInput
  ) {
    deleteHistory(input: $input, condition: $condition) {
      id
      ownerProfId
      profileID
      profile {
        id
        firstName
        lastName
        email
        plan
        mainHelper
        avatar
        firstGame
        lastStepTime
        histories {
          nextToken
          startedAt
        }
        createdAt
        updatedAt
        _version
        _deleted
        _lastChangedAt
        owner
      }
      count
      plan
      status
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
      owner
    }
  }
`;
export const createMainRoom = /* GraphQL */ `
  mutation CreateMainRoom(
    $input: CreateMainRoomInput!
    $condition: ModelMainRoomConditionInput
  ) {
    createMainRoom(input: $input, condition: $condition) {
      id
      code
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
    }
  }
`;
export const updateMainRoom = /* GraphQL */ `
  mutation UpdateMainRoom(
    $input: UpdateMainRoomInput!
    $condition: ModelMainRoomConditionInput
  ) {
    updateMainRoom(input: $input, condition: $condition) {
      id
      code
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
    }
  }
`;
export const deleteMainRoom = /* GraphQL */ `
  mutation DeleteMainRoom(
    $input: DeleteMainRoomInput!
    $condition: ModelMainRoomConditionInput
  ) {
    deleteMainRoom(input: $input, condition: $condition) {
      id
      code
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
    }
  }
`;
export const createMessage = /* GraphQL */ `
  mutation CreateMessage(
    $input: CreateMessageInput!
    $condition: ModelMessageConditionInput
  ) {
    createMessage(input: $input, condition: $condition) {
      id
      name
      avatar
      profId
      text
      mainHelper
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
    }
  }
`;
export const updateMessage = /* GraphQL */ `
  mutation UpdateMessage(
    $input: UpdateMessageInput!
    $condition: ModelMessageConditionInput
  ) {
    updateMessage(input: $input, condition: $condition) {
      id
      name
      avatar
      profId
      text
      mainHelper
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
    }
  }
`;
export const deleteMessage = /* GraphQL */ `
  mutation DeleteMessage(
    $input: DeleteMessageInput!
    $condition: ModelMessageConditionInput
  ) {
    deleteMessage(input: $input, condition: $condition) {
      id
      name
      avatar
      profId
      text
      mainHelper
      createdAt
      updatedAt
      _version
      _deleted
      _lastChangedAt
    }
  }
`;
