// @ts-check
import { initSchema } from '@aws-amplify/datastore';
import { schema } from './schema';



const { Profile, MinimalVersion, History } = initSchema(schema);

export {
  Profile,
  MinimalVersion,
  History
};