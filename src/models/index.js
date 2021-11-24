// @ts-check
import { initSchema } from '@aws-amplify/datastore';
import { schema } from './schema';



const { Profile, History } = initSchema(schema);

export {
  Profile,
  History
};