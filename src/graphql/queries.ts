/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getProfile = /* GraphQL */ `
  query GetProfile($id: ID!) {
    getProfile(id: $id) {
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
export const listProfiles = /* GraphQL */ `
  query ListProfiles(
    $filter: ModelProfileFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listProfiles(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
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
      nextToken
    }
  }
`;
export const getMinimalVersion = /* GraphQL */ `
  query GetMinimalVersion($id: ID!) {
    getMinimalVersion(id: $id) {
      id
      build
      owner
      createdAt
      updatedAt
    }
  }
`;
export const listMinimalVersions = /* GraphQL */ `
  query ListMinimalVersions(
    $filter: ModelMinimalVersionFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listMinimalVersions(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        build
        owner
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;
export const getHistory = /* GraphQL */ `
  query GetHistory($id: ID!) {
    getHistory(id: $id) {
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
export const listHistories = /* GraphQL */ `
  query ListHistories(
    $filter: ModelHistoryFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listHistories(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        step
        cube
        plan
        createdAt
        updatedAt
        owner
      }
      nextToken
    }
  }
`;
