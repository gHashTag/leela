/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const syncProfiles = /* GraphQL */ `
  query SyncProfiles(
    $filter: ModelProfileFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncProfiles(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        firstName
        lastName
        email
        owner
        plan
        avatar
        _version
        _deleted
        _lastChangedAt
        createdAt
        updatedAt
      }
      nextToken
      startedAt
    }
  }
`;
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
      _version
      _deleted
      _lastChangedAt
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
        _version
        _deleted
        _lastChangedAt
        createdAt
        updatedAt
      }
      nextToken
      startedAt
    }
  }
`;
export const syncMinimalVersions = /* GraphQL */ `
  query SyncMinimalVersions(
    $filter: ModelMinimalVersionFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncMinimalVersions(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        build
        owner
        _version
        _deleted
        _lastChangedAt
        createdAt
        updatedAt
      }
      nextToken
      startedAt
    }
  }
`;
export const getMinimalVersion = /* GraphQL */ `
  query GetMinimalVersion($id: ID!) {
    getMinimalVersion(id: $id) {
      id
      build
      owner
      _version
      _deleted
      _lastChangedAt
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
        _version
        _deleted
        _lastChangedAt
        createdAt
        updatedAt
      }
      nextToken
      startedAt
    }
  }
`;
export const syncHistories = /* GraphQL */ `
  query SyncHistories(
    $filter: ModelHistoryFilterInput
    $limit: Int
    $nextToken: String
    $lastSync: AWSTimestamp
  ) {
    syncHistories(
      filter: $filter
      limit: $limit
      nextToken: $nextToken
      lastSync: $lastSync
    ) {
      items {
        id
        count
        plan
        status
        createdAt
        owner
        _version
        _deleted
        _lastChangedAt
        updatedAt
      }
      nextToken
      startedAt
    }
  }
`;
export const getHistory = /* GraphQL */ `
  query GetHistory($id: ID!) {
    getHistory(id: $id) {
      id
      count
      plan
      status
      createdAt
      owner
      _version
      _deleted
      _lastChangedAt
      updatedAt
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
        count
        plan
        status
        createdAt
        owner
        _version
        _deleted
        _lastChangedAt
        updatedAt
      }
      nextToken
      startedAt
    }
  }
`;
