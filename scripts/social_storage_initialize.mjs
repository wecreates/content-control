import {createPostgresStore, initializePostgresVault} from '../integrations/social-automation/postgres-store.mjs';
let store;
try {
  if (process.env.SOCIAL_STORAGE_INITIALIZE !== 'true' || process.env.SOCIAL_STORAGE_MODE !== 'postgres_encrypted') throw Error();
  store = createPostgresStore(process.env);
  await initializePostgresVault(store);
  console.log(JSON.stringify({status:'ENCRYPTED_VAULT_INITIALIZED',publication_enabled:false,durable_storage_verified:false}));
} catch {console.error('PRIVATE_STORE_INITIALIZATION_FAILED'); process.exitCode=1;}
finally {if(store)await store.close();}
