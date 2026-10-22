import {PodDB,createPodPool} from '../pod-db-bridge.js';
import {publishOnce} from './pod_stealth_publisher.mjs';
import {readBridgeFile} from '../integrations/pod/bridge-file.mjs';
const env=process.env;
const bridge=await readBridgeFile(env.POD_BRIDGE_PATH);
const db=new PodDB({pool:await createPodPool(env),bridge,upstreamKey:env.POD_UPSTREAM_KEY,qaKey:env.POD_QA_KEY,expiresAt:env.POD_STORAGE_EXPIRES_AT});
try{
 // No platform is silently enabled. Production uses certified adapters through the service API.
 console.log(JSON.stringify(await publishOnce({db,env,accountId:env.POD_ACCOUNT_ID})));
}finally{await db.close();}
