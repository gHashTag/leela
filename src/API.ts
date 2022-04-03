/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export type CreateProfileInput = {
  id?: string | null,
  firstName: string,
  lastName: string,
  email: string,
  plan?: number | null,
  mainHelper?: string | null,
  avatar?: string | null,
  firstGame?: boolean | null,
  lastStepTime?: string | null,
  _version?: number | null,
};

export type ModelProfileConditionInput = {
  firstName?: ModelStringInput | null,
  lastName?: ModelStringInput | null,
  email?: ModelStringInput | null,
  plan?: ModelIntInput | null,
  mainHelper?: ModelStringInput | null,
  avatar?: ModelStringInput | null,
  firstGame?: ModelBooleanInput | null,
  lastStepTime?: ModelStringInput | null,
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

export type ModelBooleanInput = {
  ne?: boolean | null,
  eq?: boolean | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
};

export type Profile = {
  __typename: "Profile",
  id: string,
  firstName: string,
  lastName: string,
  email: string,
  plan?: number | null,
  mainHelper?: string | null,
  avatar?: string | null,
  firstGame?: boolean | null,
  lastStepTime?: string | null,
  histories?: ModelHistoryConnection | null,
  createdAt: string,
  updatedAt: string,
  _version: number,
  _deleted?: boolean | null,
  _lastChangedAt: number,
  owner?: string | null,
};

export type ModelHistoryConnection = {
  __typename: "ModelHistoryConnection",
  items:  Array<History | null >,
  nextToken?: string | null,
  startedAt?: number | null,
};

export type History = {
  __typename: "History",
  id: string,
  ownerProfId: string,
  profileID: string,
  profile?: Profile | null,
  count: number,
  plan: number,
  status: string,
  createdAt: string,
  updatedAt: string,
  _version: number,
  _deleted?: boolean | null,
  _lastChangedAt: number,
  owner?: string | null,
};

export type UpdateProfileInput = {
  id: string,
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null,
  plan?: number | null,
  mainHelper?: string | null,
  avatar?: string | null,
  firstGame?: boolean | null,
  lastStepTime?: string | null,
  _version?: number | null,
};

export type DeleteProfileInput = {
  id: string,
  _version?: number | null,
};

export type CreateHistoryInput = {
  id?: string | null,
  ownerProfId: string,
  profileID: string,
  count: number,
  plan: number,
  status: string,
  _version?: number | null,
};

export type ModelHistoryConditionInput = {
  ownerProfId?: ModelStringInput | null,
  profileID?: ModelIDInput | null,
  count?: ModelIntInput | null,
  plan?: ModelIntInput | null,
  status?: ModelStringInput | null,
  and?: Array< ModelHistoryConditionInput | null > | null,
  or?: Array< ModelHistoryConditionInput | null > | null,
  not?: ModelHistoryConditionInput | null,
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

export type UpdateHistoryInput = {
  id: string,
  ownerProfId?: string | null,
  profileID?: string | null,
  count?: number | null,
  plan?: number | null,
  status?: string | null,
  _version?: number | null,
};

export type DeleteHistoryInput = {
  id: string,
  _version?: number | null,
};

export type CreateMainRoomInput = {
  id?: string | null,
  code?: string | null,
  _version?: number | null,
};

export type ModelMainRoomConditionInput = {
  code?: ModelStringInput | null,
  and?: Array< ModelMainRoomConditionInput | null > | null,
  or?: Array< ModelMainRoomConditionInput | null > | null,
  not?: ModelMainRoomConditionInput | null,
};

export type MainRoom = {
  __typename: "MainRoom",
  id: string,
  code?: string | null,
  createdAt: string,
  updatedAt: string,
  _version: number,
  _deleted?: boolean | null,
  _lastChangedAt: number,
};

export type UpdateMainRoomInput = {
  id: string,
  code?: string | null,
  _version?: number | null,
};

export type DeleteMainRoomInput = {
  id: string,
  _version?: number | null,
};

export type ModelProfileFilterInput = {
  id?: ModelIDInput | null,
  firstName?: ModelStringInput | null,
  lastName?: ModelStringInput | null,
  email?: ModelStringInput | null,
  plan?: ModelIntInput | null,
  mainHelper?: ModelStringInput | null,
  avatar?: ModelStringInput | null,
  firstGame?: ModelBooleanInput | null,
  lastStepTime?: ModelStringInput | null,
  and?: Array< ModelProfileFilterInput | null > | null,
  or?: Array< ModelProfileFilterInput | null > | null,
  not?: ModelProfileFilterInput | null,
};

export type ModelProfileConnection = {
  __typename: "ModelProfileConnection",
  items:  Array<Profile | null >,
  nextToken?: string | null,
  startedAt?: number | null,
};

export type ModelHistoryFilterInput = {
  id?: ModelIDInput | null,
  ownerProfId?: ModelStringInput | null,
  profileID?: ModelIDInput | null,
  count?: ModelIntInput | null,
  plan?: ModelIntInput | null,
  status?: ModelStringInput | null,
  and?: Array< ModelHistoryFilterInput | null > | null,
  or?: Array< ModelHistoryFilterInput | null > | null,
  not?: ModelHistoryFilterInput | null,
};

export type ModelMainRoomFilterInput = {
  id?: ModelIDInput | null,
  code?: ModelStringInput | null,
  and?: Array< ModelMainRoomFilterInput | null > | null,
  or?: Array< ModelMainRoomFilterInput | null > | null,
  not?: ModelMainRoomFilterInput | null,
};

export type ModelMainRoomConnection = {
  __typename: "ModelMainRoomConnection",
  items:  Array<MainRoom | null >,
  nextToken?: string | null,
  startedAt?: number | null,
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
    plan?: number | null,
    mainHelper?: string | null,
    avatar?: string | null,
    firstGame?: boolean | null,
    lastStepTime?: string | null,
    histories?:  {
      __typename: "ModelHistoryConnection",
      items:  Array< {
        __typename: "History",
        id: string,
        ownerProfId: string,
        profileID: string,
        count: number,
        plan: number,
        status: string,
        createdAt: string,
        updatedAt: string,
        _version: number,
        _deleted?: boolean | null,
        _lastChangedAt: number,
        owner?: string | null,
      } | null >,
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
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
    plan?: number | null,
    mainHelper?: string | null,
    avatar?: string | null,
    firstGame?: boolean | null,
    lastStepTime?: string | null,
    histories?:  {
      __typename: "ModelHistoryConnection",
      items:  Array< {
        __typename: "History",
        id: string,
        ownerProfId: string,
        profileID: string,
        count: number,
        plan: number,
        status: string,
        createdAt: string,
        updatedAt: string,
        _version: number,
        _deleted?: boolean | null,
        _lastChangedAt: number,
        owner?: string | null,
      } | null >,
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
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
    plan?: number | null,
    mainHelper?: string | null,
    avatar?: string | null,
    firstGame?: boolean | null,
    lastStepTime?: string | null,
    histories?:  {
      __typename: "ModelHistoryConnection",
      items:  Array< {
        __typename: "History",
        id: string,
        ownerProfId: string,
        profileID: string,
        count: number,
        plan: number,
        status: string,
        createdAt: string,
        updatedAt: string,
        _version: number,
        _deleted?: boolean | null,
        _lastChangedAt: number,
        owner?: string | null,
      } | null >,
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type CreateHistoryMutationVariables = {
  input: CreateHistoryInput,
  condition?: ModelHistoryConditionInput | null,
};

export type CreateHistoryMutation = {
  createHistory?:  {
    __typename: "History",
    id: string,
    ownerProfId: string,
    profileID: string,
    profile?:  {
      __typename: "Profile",
      id: string,
      firstName: string,
      lastName: string,
      email: string,
      plan?: number | null,
      mainHelper?: string | null,
      avatar?: string | null,
      firstGame?: boolean | null,
      lastStepTime?: string | null,
      histories?:  {
        __typename: "ModelHistoryConnection",
        nextToken?: string | null,
        startedAt?: number | null,
      } | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null,
    count: number,
    plan: number,
    status: string,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type UpdateHistoryMutationVariables = {
  input: UpdateHistoryInput,
  condition?: ModelHistoryConditionInput | null,
};

export type UpdateHistoryMutation = {
  updateHistory?:  {
    __typename: "History",
    id: string,
    ownerProfId: string,
    profileID: string,
    profile?:  {
      __typename: "Profile",
      id: string,
      firstName: string,
      lastName: string,
      email: string,
      plan?: number | null,
      mainHelper?: string | null,
      avatar?: string | null,
      firstGame?: boolean | null,
      lastStepTime?: string | null,
      histories?:  {
        __typename: "ModelHistoryConnection",
        nextToken?: string | null,
        startedAt?: number | null,
      } | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null,
    count: number,
    plan: number,
    status: string,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type DeleteHistoryMutationVariables = {
  input: DeleteHistoryInput,
  condition?: ModelHistoryConditionInput | null,
};

export type DeleteHistoryMutation = {
  deleteHistory?:  {
    __typename: "History",
    id: string,
    ownerProfId: string,
    profileID: string,
    profile?:  {
      __typename: "Profile",
      id: string,
      firstName: string,
      lastName: string,
      email: string,
      plan?: number | null,
      mainHelper?: string | null,
      avatar?: string | null,
      firstGame?: boolean | null,
      lastStepTime?: string | null,
      histories?:  {
        __typename: "ModelHistoryConnection",
        nextToken?: string | null,
        startedAt?: number | null,
      } | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null,
    count: number,
    plan: number,
    status: string,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type CreateMainRoomMutationVariables = {
  input: CreateMainRoomInput,
  condition?: ModelMainRoomConditionInput | null,
};

export type CreateMainRoomMutation = {
  createMainRoom?:  {
    __typename: "MainRoom",
    id: string,
    code?: string | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
  } | null,
};

export type UpdateMainRoomMutationVariables = {
  input: UpdateMainRoomInput,
  condition?: ModelMainRoomConditionInput | null,
};

export type UpdateMainRoomMutation = {
  updateMainRoom?:  {
    __typename: "MainRoom",
    id: string,
    code?: string | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
  } | null,
};

export type DeleteMainRoomMutationVariables = {
  input: DeleteMainRoomInput,
  condition?: ModelMainRoomConditionInput | null,
};

export type DeleteMainRoomMutation = {
  deleteMainRoom?:  {
    __typename: "MainRoom",
    id: string,
    code?: string | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
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
    plan?: number | null,
    mainHelper?: string | null,
    avatar?: string | null,
    firstGame?: boolean | null,
    lastStepTime?: string | null,
    histories?:  {
      __typename: "ModelHistoryConnection",
      items:  Array< {
        __typename: "History",
        id: string,
        ownerProfId: string,
        profileID: string,
        count: number,
        plan: number,
        status: string,
        createdAt: string,
        updatedAt: string,
        _version: number,
        _deleted?: boolean | null,
        _lastChangedAt: number,
        owner?: string | null,
      } | null >,
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
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
    items:  Array< {
      __typename: "Profile",
      id: string,
      firstName: string,
      lastName: string,
      email: string,
      plan?: number | null,
      mainHelper?: string | null,
      avatar?: string | null,
      firstGame?: boolean | null,
      lastStepTime?: string | null,
      histories?:  {
        __typename: "ModelHistoryConnection",
        nextToken?: string | null,
        startedAt?: number | null,
      } | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type SyncProfilesQueryVariables = {
  filter?: ModelProfileFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  lastSync?: number | null,
};

export type SyncProfilesQuery = {
  syncProfiles?:  {
    __typename: "ModelProfileConnection",
    items:  Array< {
      __typename: "Profile",
      id: string,
      firstName: string,
      lastName: string,
      email: string,
      plan?: number | null,
      mainHelper?: string | null,
      avatar?: string | null,
      firstGame?: boolean | null,
      lastStepTime?: string | null,
      histories?:  {
        __typename: "ModelHistoryConnection",
        nextToken?: string | null,
        startedAt?: number | null,
      } | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type GetHistoryQueryVariables = {
  id: string,
};

export type GetHistoryQuery = {
  getHistory?:  {
    __typename: "History",
    id: string,
    ownerProfId: string,
    profileID: string,
    profile?:  {
      __typename: "Profile",
      id: string,
      firstName: string,
      lastName: string,
      email: string,
      plan?: number | null,
      mainHelper?: string | null,
      avatar?: string | null,
      firstGame?: boolean | null,
      lastStepTime?: string | null,
      histories?:  {
        __typename: "ModelHistoryConnection",
        nextToken?: string | null,
        startedAt?: number | null,
      } | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null,
    count: number,
    plan: number,
    status: string,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type ListHistoriesQueryVariables = {
  filter?: ModelHistoryFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListHistoriesQuery = {
  listHistories?:  {
    __typename: "ModelHistoryConnection",
    items:  Array< {
      __typename: "History",
      id: string,
      ownerProfId: string,
      profileID: string,
      profile?:  {
        __typename: "Profile",
        id: string,
        firstName: string,
        lastName: string,
        email: string,
        plan?: number | null,
        mainHelper?: string | null,
        avatar?: string | null,
        firstGame?: boolean | null,
        lastStepTime?: string | null,
        createdAt: string,
        updatedAt: string,
        _version: number,
        _deleted?: boolean | null,
        _lastChangedAt: number,
        owner?: string | null,
      } | null,
      count: number,
      plan: number,
      status: string,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type SyncHistoriesQueryVariables = {
  filter?: ModelHistoryFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  lastSync?: number | null,
};

export type SyncHistoriesQuery = {
  syncHistories?:  {
    __typename: "ModelHistoryConnection",
    items:  Array< {
      __typename: "History",
      id: string,
      ownerProfId: string,
      profileID: string,
      profile?:  {
        __typename: "Profile",
        id: string,
        firstName: string,
        lastName: string,
        email: string,
        plan?: number | null,
        mainHelper?: string | null,
        avatar?: string | null,
        firstGame?: boolean | null,
        lastStepTime?: string | null,
        createdAt: string,
        updatedAt: string,
        _version: number,
        _deleted?: boolean | null,
        _lastChangedAt: number,
        owner?: string | null,
      } | null,
      count: number,
      plan: number,
      status: string,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type GetMainRoomQueryVariables = {
  id: string,
};

export type GetMainRoomQuery = {
  getMainRoom?:  {
    __typename: "MainRoom",
    id: string,
    code?: string | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
  } | null,
};

export type ListMainRoomsQueryVariables = {
  filter?: ModelMainRoomFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListMainRoomsQuery = {
  listMainRooms?:  {
    __typename: "ModelMainRoomConnection",
    items:  Array< {
      __typename: "MainRoom",
      id: string,
      code?: string | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type SyncMainRoomsQueryVariables = {
  filter?: ModelMainRoomFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  lastSync?: number | null,
};

export type SyncMainRoomsQuery = {
  syncMainRooms?:  {
    __typename: "ModelMainRoomConnection",
    items:  Array< {
      __typename: "MainRoom",
      id: string,
      code?: string | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
    } | null >,
    nextToken?: string | null,
    startedAt?: number | null,
  } | null,
};

export type OnCreateProfileSubscriptionVariables = {
  owner?: string | null,
};

export type OnCreateProfileSubscription = {
  onCreateProfile?:  {
    __typename: "Profile",
    id: string,
    firstName: string,
    lastName: string,
    email: string,
    plan?: number | null,
    mainHelper?: string | null,
    avatar?: string | null,
    firstGame?: boolean | null,
    lastStepTime?: string | null,
    histories?:  {
      __typename: "ModelHistoryConnection",
      items:  Array< {
        __typename: "History",
        id: string,
        ownerProfId: string,
        profileID: string,
        count: number,
        plan: number,
        status: string,
        createdAt: string,
        updatedAt: string,
        _version: number,
        _deleted?: boolean | null,
        _lastChangedAt: number,
        owner?: string | null,
      } | null >,
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type OnUpdateProfileSubscriptionVariables = {
  owner?: string | null,
};

export type OnUpdateProfileSubscription = {
  onUpdateProfile?:  {
    __typename: "Profile",
    id: string,
    firstName: string,
    lastName: string,
    email: string,
    plan?: number | null,
    mainHelper?: string | null,
    avatar?: string | null,
    firstGame?: boolean | null,
    lastStepTime?: string | null,
    histories?:  {
      __typename: "ModelHistoryConnection",
      items:  Array< {
        __typename: "History",
        id: string,
        ownerProfId: string,
        profileID: string,
        count: number,
        plan: number,
        status: string,
        createdAt: string,
        updatedAt: string,
        _version: number,
        _deleted?: boolean | null,
        _lastChangedAt: number,
        owner?: string | null,
      } | null >,
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type OnDeleteProfileSubscriptionVariables = {
  owner?: string | null,
};

export type OnDeleteProfileSubscription = {
  onDeleteProfile?:  {
    __typename: "Profile",
    id: string,
    firstName: string,
    lastName: string,
    email: string,
    plan?: number | null,
    mainHelper?: string | null,
    avatar?: string | null,
    firstGame?: boolean | null,
    lastStepTime?: string | null,
    histories?:  {
      __typename: "ModelHistoryConnection",
      items:  Array< {
        __typename: "History",
        id: string,
        ownerProfId: string,
        profileID: string,
        count: number,
        plan: number,
        status: string,
        createdAt: string,
        updatedAt: string,
        _version: number,
        _deleted?: boolean | null,
        _lastChangedAt: number,
        owner?: string | null,
      } | null >,
      nextToken?: string | null,
      startedAt?: number | null,
    } | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type OnCreateHistorySubscriptionVariables = {
  owner?: string | null,
};

export type OnCreateHistorySubscription = {
  onCreateHistory?:  {
    __typename: "History",
    id: string,
    ownerProfId: string,
    profileID: string,
    profile?:  {
      __typename: "Profile",
      id: string,
      firstName: string,
      lastName: string,
      email: string,
      plan?: number | null,
      mainHelper?: string | null,
      avatar?: string | null,
      firstGame?: boolean | null,
      lastStepTime?: string | null,
      histories?:  {
        __typename: "ModelHistoryConnection",
        nextToken?: string | null,
        startedAt?: number | null,
      } | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null,
    count: number,
    plan: number,
    status: string,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type OnUpdateHistorySubscriptionVariables = {
  owner?: string | null,
};

export type OnUpdateHistorySubscription = {
  onUpdateHistory?:  {
    __typename: "History",
    id: string,
    ownerProfId: string,
    profileID: string,
    profile?:  {
      __typename: "Profile",
      id: string,
      firstName: string,
      lastName: string,
      email: string,
      plan?: number | null,
      mainHelper?: string | null,
      avatar?: string | null,
      firstGame?: boolean | null,
      lastStepTime?: string | null,
      histories?:  {
        __typename: "ModelHistoryConnection",
        nextToken?: string | null,
        startedAt?: number | null,
      } | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null,
    count: number,
    plan: number,
    status: string,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type OnDeleteHistorySubscriptionVariables = {
  owner?: string | null,
};

export type OnDeleteHistorySubscription = {
  onDeleteHistory?:  {
    __typename: "History",
    id: string,
    ownerProfId: string,
    profileID: string,
    profile?:  {
      __typename: "Profile",
      id: string,
      firstName: string,
      lastName: string,
      email: string,
      plan?: number | null,
      mainHelper?: string | null,
      avatar?: string | null,
      firstGame?: boolean | null,
      lastStepTime?: string | null,
      histories?:  {
        __typename: "ModelHistoryConnection",
        nextToken?: string | null,
        startedAt?: number | null,
      } | null,
      createdAt: string,
      updatedAt: string,
      _version: number,
      _deleted?: boolean | null,
      _lastChangedAt: number,
      owner?: string | null,
    } | null,
    count: number,
    plan: number,
    status: string,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
    owner?: string | null,
  } | null,
};

export type OnCreateMainRoomSubscription = {
  onCreateMainRoom?:  {
    __typename: "MainRoom",
    id: string,
    code?: string | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
  } | null,
};

export type OnUpdateMainRoomSubscription = {
  onUpdateMainRoom?:  {
    __typename: "MainRoom",
    id: string,
    code?: string | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
  } | null,
};

export type OnDeleteMainRoomSubscription = {
  onDeleteMainRoom?:  {
    __typename: "MainRoom",
    id: string,
    code?: string | null,
    createdAt: string,
    updatedAt: string,
    _version: number,
    _deleted?: boolean | null,
    _lastChangedAt: number,
  } | null,
};
