import { ModelInit, MutableModel, PersistentModelConstructor } from "@aws-amplify/datastore";





type ProfileMetaData = {
  readOnlyFields: 'createdAt' | 'updatedAt';
}

type HistoryMetaData = {
  readOnlyFields: 'createdAt' | 'updatedAt';
}

type MainRoomMetaData = {
  readOnlyFields: 'createdAt' | 'updatedAt';
}

type MessageMetaData = {
  readOnlyFields: 'createdAt' | 'updatedAt';
}

export declare class Profile {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly plan?: number | null;
  readonly mainHelper?: string | null;
  readonly avatar?: string | null;
  readonly firstGame?: boolean | null;
  readonly lastStepTime?: string | null;
  readonly histories?: (History | null)[] | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
  constructor(init: ModelInit<Profile, ProfileMetaData>);
  static copyOf(source: Profile, mutator: (draft: MutableModel<Profile, ProfileMetaData>) => MutableModel<Profile, ProfileMetaData> | void): Profile;
}

export declare class History {
  readonly id: string;
  readonly ownerProfId: string;
  readonly profile?: Profile | null;
  readonly count: number;
  readonly plan: number;
  readonly status: string;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
  constructor(init: ModelInit<History, HistoryMetaData>);
  static copyOf(source: History, mutator: (draft: MutableModel<History, HistoryMetaData>) => MutableModel<History, HistoryMetaData> | void): History;
}

export declare class MainRoom {
  readonly id: string;
  readonly code?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
  constructor(init: ModelInit<MainRoom, MainRoomMetaData>);
  static copyOf(source: MainRoom, mutator: (draft: MutableModel<MainRoom, MainRoomMetaData>) => MutableModel<MainRoom, MainRoomMetaData> | void): MainRoom;
}

export declare class Message {
  readonly id: string;
  readonly name: string;
  readonly avatar?: string | null;
  readonly profId: string;
  readonly text: string;
  readonly mainHelper?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
  constructor(init: ModelInit<Message, MessageMetaData>);
  static copyOf(source: Message, mutator: (draft: MutableModel<Message, MessageMetaData>) => MutableModel<Message, MessageMetaData> | void): Message;
}