import { ModelInit, MutableModel, PersistentModelConstructor } from "@aws-amplify/datastore";





type ProfileMetaData = {
  readOnlyFields: 'createdAt' | 'updatedAt';
}

type HistoryMetaData = {
  readOnlyFields: 'createdAt' | 'updatedAt';
}

export declare class Profile {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly plan?: number;
  readonly avatar?: string;
  readonly owner?: string;
  readonly histories?: (History | null)[];
  readonly createdAt?: string;
  readonly updatedAt?: string;
  constructor(init: ModelInit<Profile, ProfileMetaData>);
  static copyOf(source: Profile, mutator: (draft: MutableModel<Profile, ProfileMetaData>) => MutableModel<Profile, ProfileMetaData> | void): Profile;
}

export declare class History {
  readonly id: string;
  readonly historyID: string;
  readonly count: number;
  readonly plan: number;
  readonly status: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  constructor(init: ModelInit<History, HistoryMetaData>);
  static copyOf(source: History, mutator: (draft: MutableModel<History, HistoryMetaData>) => MutableModel<History, HistoryMetaData> | void): History;
}