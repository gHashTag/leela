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
      owner
      plan
      avatar
      createdAt
      updatedAt
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
      owner
      plan
      avatar
      createdAt
      updatedAt
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
      owner
      plan
      avatar
      createdAt
      updatedAt
    }
  }
`;
export const createMinimalVersion = /* GraphQL */ `
  mutation CreateMinimalVersion(
    $input: CreateMinimalVersionInput!
    $condition: ModelMinimalVersionConditionInput
  ) {
    createMinimalVersion(input: $input, condition: $condition) {
      id
      build
      owner
      createdAt
      updatedAt
    }
  }
`;
export const updateMinimalVersion = /* GraphQL */ `
  mutation UpdateMinimalVersion(
    $input: UpdateMinimalVersionInput!
    $condition: ModelMinimalVersionConditionInput
  ) {
    updateMinimalVersion(input: $input, condition: $condition) {
      id
      build
      owner
      createdAt
      updatedAt
    }
  }
`;
export const deleteMinimalVersion = /* GraphQL */ `
  mutation DeleteMinimalVersion(
    $input: DeleteMinimalVersionInput!
    $condition: ModelMinimalVersionConditionInput
  ) {
    deleteMinimalVersion(input: $input, condition: $condition) {
      id
      build
      owner
      createdAt
      updatedAt
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
      step
      cube
      plan
      createdAt
      updatedAt
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
      step
      cube
      plan
      createdAt
      updatedAt
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
      step
      cube
      plan
      createdAt
      updatedAt
      owner
    }
  }
`;
