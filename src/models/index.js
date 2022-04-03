// @ts-check
import { initSchema } from '@aws-amplify/datastore';
import { schema } from './schema';



const { Profile, History, MainRoom } = initSchema(schema);

export {
  Profile,
  History,
  MainRoom
};