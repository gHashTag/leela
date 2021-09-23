/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export type CreateProfileInput = {
  id?: string | null,
  firstName: string,
  lastName: string,
  email: string,
  owner?: string | null,
  plan?: number | null,
  avatar?: string | null,
};

export type ModelProfileConditionInput = {
  firstName?: ModelStringInput | null,
  lastName?: ModelStringInput | null,
  email?: ModelStringInput | null,
  plan?: ModelIntInput | null,
  avatar?: ModelStringInput | null,
  and?: Array< ModelProfileConditionInput | null > | null,
  or?: Array< ModelProfileConditionInput | null > | null,
  not?: ModelProfileConditionInput | null,
};

export type ModelStringInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  size?: ModelSizeInput | null,
};

export enum ModelAttributeTypes {
  binary = "binary",
  binarySet = "binarySet",
  bool = "bool",
  list = "list",
  map = "map",
  number = "number",
  numberSet = "numberSet",
  string = "string",
  stringSet = "stringSet",
  _null = "_null",
}


export type ModelSizeInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
};

export type ModelIntInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
};

export type Profile = {
  __typename: "Profile",
  id: string,
  firstName: string,
  lastName: string,
  email: string,
  owner?: string | null,
  plan?: number | null,
  avatar?: string | null,
  createdAt: string,
  updatedAt: string,
};

export type UpdateProfileInput = {
  id: string,
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null,
  owner?: string | null,
  plan?: number | null,
  avatar?: string | null,
};

export type DeleteProfileInput = {
  id: string,
};

export type CreateMinimalVersionInput = {
  id?: string | null,
  build: string,
  owner?: string | null,
};

export type ModelMinimalVersionConditionInput = {
  build?: ModelStringInput | null,
  and?: Array< ModelMinimalVersionConditionInput | null > | null,
  or?: Array< ModelMinimalVersionConditionInput | null > | null,
  not?: ModelMinimalVersionConditionInput | null,
};

export type MinimalVersion = {
  __typename: "MinimalVersion",
  id: string,
  build: string,
  owner?: string | null,
  createdAt: string,
  updatedAt: string,
};

export type UpdateMinimalVersionInput = {
  id: string,
  build?: string | null,
  owner?: string | null,
};

export type DeleteMinimalVersionInput = {
  id: string,
};

export type ModelProfileFilterInput = {
  id?: ModelIDInput | null,
  firstName?: ModelStringInput | null,
  lastName?: ModelStringInput | null,
  email?: ModelStringInput | null,
  owner?: ModelStringInput | null,
  plan?: ModelIntInput | null,
  avatar?: ModelStringInput | null,
  and?: Array< ModelProfileFilterInput | null > | null,
  or?: Array< ModelProfileFilterInput | null > | null,
  not?: ModelProfileFilterInput | null,
};

export type ModelIDInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  size?: ModelSizeInput | null,
};

export type ModelProfileConnection = {
  __typename: "ModelProfileConnection",
  items?:  Array<Profile | null > | null,
  nextToken?: string | null,
};

export type ModelMinimalVersionFilterInput = {
  id?: ModelIDInput | null,
  build?: ModelStringInput | null,
  owner?: ModelStringInput | null,
  and?: Array< ModelMinimalVersionFilterInput | null > | null,
  or?: Array< ModelMinimalVersionFilterInput | null > | null,
  not?: ModelMinimalVersionFilterInput | null,
};

export type ModelMinimalVersionConnection = {
  __typename: "ModelMinimalVersionConnection",
  items?:  Array<MinimalVersion | null > | null,
  nextToken?: string | null,
};

export type CreateProfileMutationVariables = {
  input: CreateProfileInput,
  condition?: ModelProfileConditionInput | null,
};

export type CreateProfileMutation = {
  createProfile?:  {
    __typename: "Profile",
    id: string,
    firstName: string,
    lastName: string,
    email: string,
    owner?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type UpdateProfileMutationVariables = {
  input: UpdateProfileInput,
  condition?: ModelProfileConditionInput | null,
};

export type UpdateProfileMutation = {
  updateProfile?:  {
    __typename: "Profile",
    id: string,
    firstName: string,
    lastName: string,
    email: string,
    owner?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type DeleteProfileMutationVariables = {
  input: DeleteProfileInput,
  condition?: ModelProfileConditionInput | null,
};

export type DeleteProfileMutation = {
  deleteProfile?:  {
    __typename: "Profile",
    id: string,
    firstName: string,
    lastName: string,
    email: string,
    owner?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type CreateMinimalVersionMutationVariables = {
  input: CreateMinimalVersionInput,
  condition?: ModelMinimalVersionConditionInput | null,
};

export type CreateMinimalVersionMutation = {
  createMinimalVersion?:  {
    __typename: "MinimalVersion",
    id: string,
    build: string,
    owner?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type UpdateMinimalVersionMutationVariables = {
  input: UpdateMinimalVersionInput,
  condition?: ModelMinimalVersionConditionInput | null,
};

export type UpdateMinimalVersionMutation = {
  updateMinimalVersion?:  {
    __typename: "MinimalVersion",
    id: string,
    build: string,
    owner?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type DeleteMinimalVersionMutationVariables = {
  input: DeleteMinimalVersionInput,
  condition?: ModelMinimalVersionConditionInput | null,
};

export type DeleteMinimalVersionMutation = {
  deleteMinimalVersion?:  {
    __typename: "MinimalVersion",
    id: string,
    build: string,
    owner?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type GetProfileQueryVariables = {
  id: string,
};

export type GetProfileQuery = {
  getProfile?:  {
    __typename: "Profile",
    id: string,
    firstName: string,
    lastName: string,
    email: string,
    owner?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type ListProfilesQueryVariables = {
  filter?: ModelProfileFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListProfilesQuery = {
  listProfiles?:  {
    __typename: "ModelProfileConnection",
    items?:  Array< {
      __typename: "Profile",
      id: string,
      firstName: string,
      lastName: string,
      email: string,
      owner?: string | null,
      plan?: number | null,
      createdAt: string,
      updatedAt: string,
    } | null > | null,
    nextToken?: string | null,
  } | null,
};

export type GetMinimalVersionQueryVariables = {
  id: string,
};

export type GetMinimalVersionQuery = {
  getMinimalVersion?:  {
    __typename: "MinimalVersion",
    id: string,
    build: string,
    owner?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type ListMinimalVersionsQueryVariables = {
  filter?: ModelMinimalVersionFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListMinimalVersionsQuery = {
  listMinimalVersions?:  {
    __typename: "ModelMinimalVersionConnection",
    items?:  Array< {
      __typename: "MinimalVersion",
      id: string,
      build: string,
      owner?: string | null,
      createdAt: string,
      updatedAt: string,
    } | null > | null,
    nextToken?: string | null,
  } | null,
};

export type OnCreateProfileSubscription = {
  onCreateProfile?:  {
    __typename: "Profile",
    id: string,
    firstName: string,
    lastName: string,
    email: string,
    owner?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateProfileSubscription = {
  onUpdateProfile?:  {
    __typename: "Profile",
    id: string,
    firstName: string,
    lastName: string,
    email: string,
    owner?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteProfileSubscription = {
  onDeleteProfile?:  {
    __typename: "Profile",
    id: string,
    firstName: string,
    lastName: string,
    email: string,
    owner?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnCreateMinimalVersionSubscription = {
  onCreateMinimalVersion?:  {
    __typename: "MinimalVersion",
    id: string,
    build: string,
    owner?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateMinimalVersionSubscription = {
  onUpdateMinimalVersion?:  {
    __typename: "MinimalVersion",
    id: string,
    build: string,
    owner?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteMinimalVersionSubscription = {
  onDeleteMinimalVersion?:  {
    __typename: "MinimalVersion",
    id: string,
    build: string,
    owner?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};
