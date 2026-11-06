import crypto from 'node:crypto';
import {types as utilTypes} from 'node:util';
import {assertBridge,enforceBrief,verifyEnvelope,enforceQA,PLATFORMS} from './integrations/pod/policy.mjs';
import {ARTIFACT_MEDIA_TYPES} from './integrations/pod/artifacts.mjs';
import {assertPackageFormat,PACKAGE_MEDIA_TYPES} from './integrations/pod/package-artifacts.mjs';
import {productionReason} from './integrations/pod/failure-reasons.mjs';
import {monitorPodPool} from './integrations/pod/pool-health.mjs';
import {validOpaqueText} from './integrations/pod/text-identity.mjs';
import {parseStorageExpiry,validDateMs} from './integrations/pod/storage-expiry.mjs';
import {databaseWait} from './integrations/pod/database-wait.mjs';
const REVIEW_FILE=/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,99}$/;
const REVIEW_JOB=/^[a-zA-Z0-9_-]{1,100}$/;
const SHA256=/^[a-f0-9]{64}$/;
const artifactMediaTypes=new Set(ARTIFACT_MEDIA_TYPES);
const BASE_REVIEW_FILES=Object.freeze(['art-mask.png','print.png','text-mask.png']);
const KDP_REVIEW_FILES=Object.freeze([...BASE_REVIEW_FILES,'cover.pdf','interior.pdf','interior.receipt.json'].sort());
const RELEASE_REASONS=Object.freeze({ambiguous:'SUBMISSION_UNCERTAIN',blocked:'RELEASE_BLOCKED'});
const RECOVERY_BATCH_LIMIT=100;
const TRANSACTION_COMMANDS=new Set(['ABORT','BEGIN','COMMIT','END','PREPARE','RELEASE','ROLLBACK','SAVEPOINT','START']);
function exactObject(value,keys){
 if(value===null||typeof value!=='object'||Array.isArray(value)||utilTypes.isProxy(value)||
  Object.getPrototypeOf(value)!==Object.prototype)return false;
 const descriptors=Object.getOwnPropertyDescriptors(value),ownKeys=Reflect.ownKeys(value);
 return ownKeys.length===keys.length&&ownKeys.every(key=>typeof key==='string')&&
  JSON.stringify(ownKeys.sort())===JSON.stringify(keys)&&
  keys.every(key=>descriptors[key]?.enumerable&&Object.hasOwn(descriptors[key],'value'));
}
function dataProperty(target,key){
 try{
  if(target===null||(typeof target!=='object'&&typeof target!=='function')||utilTypes.isProxy(target))return {valid:false};
  const descriptor=Object.getOwnPropertyDescriptor(target,key);
  return descriptor&&Object.hasOwn(descriptor,'value')?{valid:true,value:descriptor.value}:{valid:false};
 }catch{return {valid:false};}
}
function assertExactMutation(result,expected){
 const count=dataProperty(result,'rowCount'),rows=dataProperty(result,'rows');
 if(!count.valid||count.value!==1||!rows.valid||!Array.isArray(rows.value)||utilTypes.isProxy(rows.value))
  throw Error('POD_MUTATION_UNVERIFIED');
 let length,rowDescriptor,row,prototype,keys,descriptors;
 try{
  length=Object.getOwnPropertyDescriptor(rows.value,'length');
  rowDescriptor=Object.getOwnPropertyDescriptor(rows.value,'0');
  if(!Object.hasOwn(length||{},'value')||length.value!==1||!rowDescriptor?.enumerable||
   !Object.hasOwn(rowDescriptor,'value'))throw Error();
  row=rowDescriptor.value;
  if(row===null||(typeof row!=='object'&&typeof row!=='function')||utilTypes.isProxy(row))throw Error();
  prototype=Object.getPrototypeOf(row);keys=Reflect.ownKeys(row);descriptors=Object.getOwnPropertyDescriptors(row);
 }catch{throw Error('POD_MUTATION_UNVERIFIED');}
 const fields=Object.keys(expected).sort();
 if((prototype!==Object.prototype&&prototype!==null)||keys.length!==fields.length||
  keys.some(key=>typeof key!=='string')||keys.map(String).sort().some((key,index)=>key!==fields[index]))
  throw Error('POD_MUTATION_UNVERIFIED');
 for(const field of fields){
  const descriptor=descriptors[field];
  if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value')||descriptor.value!==expected[field])
   throw Error('POD_MUTATION_UNVERIFIED');
 }
}
function assertExactMutationBatch(result,expected,limit){
 const count=dataProperty(result,'rowCount'),rows=dataProperty(result,'rows');
 if(!count.valid||!Number.isSafeInteger(count.value)||count.value<0||count.value>limit||
  !rows.valid||!Array.isArray(rows.value)||utilTypes.isProxy(rows.value))throw Error('POD_MUTATION_UNVERIFIED');
 let keys,length,descriptors;
 try{
  keys=Reflect.ownKeys(rows.value);length=Object.getOwnPropertyDescriptor(rows.value,'length');
  descriptors=Object.getOwnPropertyDescriptors(rows.value);
 }catch{throw Error('POD_MUTATION_UNVERIFIED');}
 if(!Object.hasOwn(length||{},'value')||length.value!==count.value||keys.length!==count.value+1||
  keys.some((key,index)=>index<count.value?key!==String(index):key!=='length'))throw Error('POD_MUTATION_UNVERIFIED');
 const fields=['id',...Object.keys(expected)].sort(),ids=new Set();
 for(let index=0;index<count.value;index++){
  const item=descriptors[String(index)];
  if(!item?.enumerable||!Object.hasOwn(item,'value'))throw Error('POD_MUTATION_UNVERIFIED');
  const row=item.value;
  let prototype,rowKeys,rowDescriptors;
  try{
   if(row===null||(typeof row!=='object'&&typeof row!=='function')||utilTypes.isProxy(row))throw Error();
   prototype=Object.getPrototypeOf(row);rowKeys=Reflect.ownKeys(row);rowDescriptors=Object.getOwnPropertyDescriptors(row);
  }catch{throw Error('POD_MUTATION_UNVERIFIED');}
  if((prototype!==Object.prototype&&prototype!==null)||rowKeys.length!==fields.length||
   rowKeys.some(key=>typeof key!=='string')||rowKeys.map(String).sort().some((key,offset)=>key!==fields[offset]))
   throw Error('POD_MUTATION_UNVERIFIED');
  for(const [field,value] of Object.entries(expected)){
   const descriptor=rowDescriptors[field];
   if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value')||descriptor.value!==value)
    throw Error('POD_MUTATION_UNVERIFIED');
  }
  const id=rowDescriptors.id;
  if(!id?.enumerable||!Object.hasOwn(id,'value')||!validOpaqueText(id.value)||ids.has(id.value))
   throw Error('POD_MUTATION_UNVERIFIED');
  ids.add(id.value);
 }
 return ids;
}
function exactEmptyMutation(result){
 const count=dataProperty(result,'rowCount'),rows=dataProperty(result,'rows');
 if(!count.valid||count.value!==0||!rows.valid||!Array.isArray(rows.value)||utilTypes.isProxy(rows.value))return false;
 try{
  const keys=Reflect.ownKeys(rows.value),length=Object.getOwnPropertyDescriptor(rows.value,'length');
  return keys.length===1&&keys[0]==='length'&&Object.hasOwn(length||{},'value')&&length.value===0;
 }catch{return false;}
}
function snapshotClaimData(value){
 try{
  const state={nodes:0};
  const copy=(item,depth)=>{
   if(depth>64||++state.nodes>10000)throw Error();
   if(item===null||typeof item==='string'||typeof item==='boolean')return item;
   if(typeof item==='number'){
    if(!Number.isFinite(item)||(Number.isInteger(item)&&!Number.isSafeInteger(item)))throw Error();
    return item;
   }
   if(typeof item!=='object'||utilTypes.isProxy(item))throw Error();
   const prototype=Object.getPrototypeOf(item),keys=Reflect.ownKeys(item);
   if(Array.isArray(item)){
    const length=Object.getOwnPropertyDescriptor(item,'length');
    if(prototype!==Array.prototype||!Object.hasOwn(length||{},'value')||
     !Number.isInteger(length.value)||length.value<0||length.value>10000||keys.length!==length.value+1)throw Error();
    const result=[];
    for(let index=0;index<length.value;index++){
     const descriptor=Object.getOwnPropertyDescriptor(item,String(index));
     if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))throw Error();
     result.push(copy(descriptor.value,depth+1));
    }
    return result;
   }
   if(prototype!==Object.prototype||keys.length>10000||keys.some(key=>typeof key!=='string'))throw Error();
   const result={};
   for(const key of keys){
    const descriptor=Object.getOwnPropertyDescriptor(item,key);
    if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))throw Error();
    Object.defineProperty(result,key,{value:copy(descriptor.value,depth+1),enumerable:true,writable:true,configurable:true});
   }
   return result;
  };
  return copy(value,0);
 }catch{return null;}
}
function claimedProductionMutation(result){
 if(exactEmptyMutation(result))return null;
 const count=dataProperty(result,'rowCount'),rows=dataProperty(result,'rows');
 if(!count.valid||count.value!==1||!rows.valid||!Array.isArray(rows.value)||utilTypes.isProxy(rows.value))
  throw Error('POD_MUTATION_UNVERIFIED');
 let row,keys,descriptors;
 try{
  const rowKeys=Reflect.ownKeys(rows.value),length=Object.getOwnPropertyDescriptor(rows.value,'length'),
   item=Object.getOwnPropertyDescriptor(rows.value,'0');
  if(rowKeys.length!==2||rowKeys[0]!=='0'||rowKeys[1]!=='length'||
   !Object.hasOwn(length||{},'value')||length.value!==1||!item?.enumerable||!Object.hasOwn(item,'value'))throw Error();
  row=item.value;
  if(row===null||typeof row!=='object'||Array.isArray(row)||utilTypes.isProxy(row)||
   Object.getPrototypeOf(row)!==Object.prototype)throw Error();
  keys=Reflect.ownKeys(row);descriptors=Object.getOwnPropertyDescriptors(row);
 }catch{throw Error('POD_MUTATION_UNVERIFIED');}
 const fields=['account_id','attempt','brief','fencing_token','id','platform','state'];
 if(keys.length!==fields.length||keys.some(key=>typeof key!=='string')||
  keys.map(String).sort().some((key,index)=>key!==fields[index])||
  fields.some(field=>!descriptors[field]?.enumerable||!Object.hasOwn(descriptors[field],'value')))
  throw Error('POD_MUTATION_UNVERIFIED');
 const values=Object.fromEntries(fields.map(field=>[field,descriptors[field].value]));
 const brief=snapshotClaimData(values.brief);
 if(!validOpaqueText(values.id)||!validOpaqueText(values.account_id)||!PLATFORMS.includes(values.platform)||
  values.state!=='processing'||!Number.isSafeInteger(values.attempt)||values.attempt<1||
  typeof values.fencing_token!=='string'||!/^[1-9][0-9]{0,18}$/.test(values.fencing_token)||
  (values.fencing_token.length===19&&values.fencing_token>'9223372036854775807')||
  brief===null||typeof brief!=='object'||Array.isArray(brief))throw Error('POD_MUTATION_UNVERIFIED');
 return {id:values.id,account_id:values.account_id,platform:values.platform,
  fencing_token:values.fencing_token,attempt:values.attempt,brief,state:values.state};
}
function claimedPublishMutation(result){
 const count=dataProperty(result,'rowCount'),rows=dataProperty(result,'rows');
 if(!count.valid||count.value!==1||!rows.valid||!Array.isArray(rows.value)||utilTypes.isProxy(rows.value))
  throw Error('POD_MUTATION_UNVERIFIED');
 let row,keys,descriptors;
 try{
  const rowKeys=Reflect.ownKeys(rows.value),length=Object.getOwnPropertyDescriptor(rows.value,'length'),
   item=Object.getOwnPropertyDescriptor(rows.value,'0');
  if(rowKeys.length!==2||rowKeys[0]!=='0'||rowKeys[1]!=='length'||
   !Object.hasOwn(length||{},'value')||length.value!==1||!item?.enumerable||!Object.hasOwn(item,'value'))throw Error();
  row=item.value;
  if(row===null||typeof row!=='object'||Array.isArray(row)||utilTypes.isProxy(row)||
   Object.getPrototypeOf(row)!==Object.prototype)throw Error();
  keys=Reflect.ownKeys(row);descriptors=Object.getOwnPropertyDescriptors(row);
 }catch{throw Error('POD_MUTATION_UNVERIFIED');}
 const fields=['account_id','attempt','brief','fencing_token','id','idempotency_key','manifest','platform','qa_envelope','state'];
 if(keys.length!==fields.length||keys.some(key=>typeof key!=='string')||
  keys.map(String).sort().some((key,index)=>key!==fields[index])||
  fields.some(field=>!descriptors[field]?.enumerable||!Object.hasOwn(descriptors[field],'value')))
  throw Error('POD_MUTATION_UNVERIFIED');
 const values=Object.fromEntries(fields.map(field=>[field,descriptors[field].value])),
  brief=snapshotClaimData(values.brief),manifest=snapshotClaimData(values.manifest),
  qaEnvelope=snapshotClaimData(values.qa_envelope);
 if(!validOpaqueText(values.id)||!validOpaqueText(values.account_id)||!PLATFORMS.includes(values.platform)||
  !validOpaqueText(values.idempotency_key)||values.state!=='publishing'||
  !Number.isSafeInteger(values.attempt)||values.attempt<1||
  typeof values.fencing_token!=='string'||!/^[1-9][0-9]{0,18}$/.test(values.fencing_token)||
  (values.fencing_token.length===19&&values.fencing_token>'9223372036854775807')||
  [brief,manifest,qaEnvelope].some(value=>value===null||typeof value!=='object'||Array.isArray(value)))
  throw Error('POD_MUTATION_UNVERIFIED');
 return {id:values.id,platform:values.platform,account_id:values.account_id,
  fencing_token:values.fencing_token,brief,manifest,qa_envelope:qaEnvelope,
  idempotency_key:values.idempotency_key,attempt:values.attempt,state:values.state};
}
function exactQueryRow(result,fields){
 const rows=dataProperty(result,'rows');
 if(!rows.valid||!Array.isArray(rows.value)||utilTypes.isProxy(rows.value))throw Error('POD_QUERY_UNVERIFIED');
 let keys,length,descriptors;
 try{
  keys=Reflect.ownKeys(rows.value);length=Object.getOwnPropertyDescriptor(rows.value,'length');
  descriptors=Object.getOwnPropertyDescriptors(rows.value);
 }catch{throw Error('POD_QUERY_UNVERIFIED');}
 if(!Object.hasOwn(length||{},'value')||!Number.isInteger(length.value)||length.value<0||length.value>1||
  keys.length!==length.value+1||keys.some((key,index)=>index<length.value?key!==String(index):key!=='length'))
  throw Error('POD_QUERY_UNVERIFIED');
 if(length.value===0)return null;
 const item=descriptors['0'];
 if(!item?.enumerable||!Object.hasOwn(item,'value'))throw Error('POD_QUERY_UNVERIFIED');
 const row=item.value;let prototype,rowKeys,rowDescriptors;
 try{
  if(row===null||(typeof row!=='object'&&typeof row!=='function')||utilTypes.isProxy(row))throw Error();
  prototype=Object.getPrototypeOf(row);rowKeys=Reflect.ownKeys(row);rowDescriptors=Object.getOwnPropertyDescriptors(row);
 }catch{throw Error('POD_QUERY_UNVERIFIED');}
 const expected=[...fields].sort();
 if((prototype!==Object.prototype&&prototype!==null)||rowKeys.length!==expected.length||
  rowKeys.some(key=>typeof key!=='string')||rowKeys.map(String).sort().some((key,index)=>key!==expected[index])||
  expected.some(field=>!rowDescriptors[field]?.enumerable||!Object.hasOwn(rowDescriptors[field],'value')))
  throw Error('POD_QUERY_UNVERIFIED');
 return Object.fromEntries(expected.map(field=>[field,rowDescriptors[field].value]));
}
function exactQueryRows(result,fields,limit){
 const rows=dataProperty(result,'rows');
 if(!rows.valid||!Array.isArray(rows.value)||utilTypes.isProxy(rows.value))throw Error('POD_QUERY_UNVERIFIED');
 let keys,length,descriptors;
 try{
  keys=Reflect.ownKeys(rows.value);length=Object.getOwnPropertyDescriptor(rows.value,'length');
  descriptors=Object.getOwnPropertyDescriptors(rows.value);
 }catch{throw Error('POD_QUERY_UNVERIFIED');}
 if(!Object.hasOwn(length||{},'value')||!Number.isInteger(length.value)||length.value<0||length.value>limit||
  keys.length!==length.value+1||keys.some((key,index)=>index<length.value?key!==String(index):key!=='length'))
  throw Error('POD_QUERY_UNVERIFIED');
 const expected=[...fields].sort(),resultRows=[];
 for(let index=0;index<length.value;index++){
  const item=descriptors[String(index)];
  if(!item?.enumerable||!Object.hasOwn(item,'value'))throw Error('POD_QUERY_UNVERIFIED');
  const row=item.value;let prototype,rowKeys,rowDescriptors;
  try{
   if(row===null||(typeof row!=='object'&&typeof row!=='function')||utilTypes.isProxy(row))throw Error();
   prototype=Object.getPrototypeOf(row);rowKeys=Reflect.ownKeys(row);rowDescriptors=Object.getOwnPropertyDescriptors(row);
  }catch{throw Error('POD_QUERY_UNVERIFIED');}
  if((prototype!==Object.prototype&&prototype!==null)||rowKeys.length!==expected.length||
   rowKeys.some(key=>typeof key!=='string')||rowKeys.map(String).sort().some((key,offset)=>key!==expected[offset])||
   expected.some(field=>!rowDescriptors[field]?.enumerable||!Object.hasOwn(rowDescriptors[field],'value')))
   throw Error('POD_QUERY_UNVERIFIED');
  resultRows.push(Object.fromEntries(expected.map(field=>[field,rowDescriptors[field].value])));
 }
 return resultRows;
}
function readyListQuerySnapshot(result){
 return exactQueryRows(result,['id','platform','state'],20).map(row=>{
  if(!validOpaqueText(row.id)||!PLATFORMS.includes(row.platform)||row.state!=='qa_passed')
   throw Error('POD_QUERY_UNVERIFIED');
  return {id:row.id,platform:row.platform,state:row.state};
 });
}
function operationsListQuerySnapshot(result,state){
 return exactQueryRows(result,['id','platform','state','reason_code','attempt','created_at','manifest',
  'manifest_sha256','can_preview'],50).map(row=>{
  let createdAtMs;
  try{
   if(utilTypes.isProxy(row.created_at))throw Error();
   createdAtMs=Date.prototype.getTime.call(row.created_at);
  }catch{throw Error('POD_QUERY_UNVERIFIED');}
  const manifest=row.manifest===null?null:snapshotClaimData(row.manifest);
  if(!validOpaqueText(row.id)||!PLATFORMS.includes(row.platform)||row.state!==state||
   (row.reason_code!==null&&!validOpaqueText(row.reason_code))||
   !Number.isSafeInteger(row.attempt)||row.attempt<0||!Number.isFinite(createdAtMs)||
   (row.manifest!==null&&manifest===null)||
   (row.manifest_sha256!==null&&!validOpaqueText(row.manifest_sha256))||typeof row.can_preview!=='boolean')
   throw Error('POD_QUERY_UNVERIFIED');
  return {id:row.id,platform:row.platform,state:row.state,reason_code:row.reason_code,
   attempt:row.attempt,created_at:new Date(createdAtMs),manifest,
   manifest_sha256:row.manifest_sha256,can_preview:row.can_preview};
 });
}
function producibleQuerySnapshot(result,job){
 const row=exactQueryRow(result,['id']);
 if(row!==null&&row.id!==job.id)throw Error('POD_QUERY_UNVERIFIED');
 return row;
}
function intakeConceptQuerySnapshot(result){
 const row=exactQueryRow(result,['id','business_id','rights_state','permanently_unpublished']);
 if(row!==null&&(!validOpaqueText(row.id)||!validOpaqueText(row.business_id)||
  !['PASS','FAIL','UNKNOWN'].includes(row.rights_state)||typeof row.permanently_unpublished!=='boolean'))
  throw Error('POD_QUERY_UNVERIFIED');
 return row;
}
function enqueueConceptQuerySnapshot(result){
 const row=exactQueryRow(result,['business_id','rights_state','permanently_unpublished']);
 if(row!==null&&(!validOpaqueText(row.business_id)||!['PASS','FAIL','UNKNOWN'].includes(row.rights_state)||
  typeof row.permanently_unpublished!=='boolean'))throw Error('POD_QUERY_UNVERIFIED');
 return row;
}
function productionRightsQuerySnapshot(result){
 const row=exactQueryRow(result,['rights_state','permanently_unpublished']);
 if(row!==null&&(!['PASS','FAIL','UNKNOWN'].includes(row.rights_state)||
  typeof row.permanently_unpublished!=='boolean'))throw Error('POD_QUERY_UNVERIFIED');
 return row;
}
function repairableQuerySnapshot(result,jobId){
 const row=exactQueryRow(result,['id','brief','attempt','manifest','qa_envelope','reason_code']);
 if(row===null)return null;
 const brief=snapshotClaimData(row.brief),
  manifest=row.manifest===null?null:snapshotClaimData(row.manifest),
  qaEnvelope=row.qa_envelope===null?null:snapshotClaimData(row.qa_envelope);
 if(row.id!==jobId||!validOpaqueText(row.id)||!Number.isSafeInteger(row.attempt)||row.attempt<0||row.attempt>=3||
  brief===null||typeof brief!=='object'||Array.isArray(brief)||
  (row.manifest!==null&&(manifest===null||typeof manifest!=='object'||Array.isArray(manifest)))||
  (row.qa_envelope!==null&&(qaEnvelope===null||typeof qaEnvelope!=='object'||Array.isArray(qaEnvelope)))||
  (row.reason_code!==null&&!validOpaqueText(row.reason_code)))throw Error('POD_QUERY_UNVERIFIED');
 return {id:row.id,brief,attempt:row.attempt,manifest,qa_envelope:qaEnvelope,reason_code:row.reason_code};
}
function reviewableQuerySnapshot(result,jobId){
 const row=exactQueryRow(result,['id','platform','manifest','manifest_sha256']);
 if(row===null)return null;
 const manifest=snapshotClaimData(row.manifest);
 if(row.id!==jobId||!validOpaqueText(row.id)||
  manifest===null||typeof manifest!=='object'||Array.isArray(manifest))throw Error('POD_QUERY_UNVERIFIED');
 return {id:row.id,platform:row.platform,manifest,manifest_sha256:row.manifest_sha256};
}
function reviewPackageQuerySnapshot(result,jobId){
 const row=exactQueryRow(result,['id','platform','state','reason_code','manifest','manifest_sha256']);
 if(row===null)return null;
 if(row.id!==jobId)throw Error('PACKAGE_UNAVAILABLE');
 const manifest=snapshotClaimData(row.manifest);
 if(!validOpaqueText(row.id)||
  (row.manifest!==null&&typeof row.manifest==='object'&&manifest===null))throw Error('POD_QUERY_UNVERIFIED');
 return {id:row.id,platform:row.platform,state:row.state,reason_code:row.reason_code,
  manifest,manifest_sha256:row.manifest_sha256};
}
function reviewArtifactQuerySnapshot(result,jobId){
 const row=exactQueryRow(result,['id','platform','state','reason_code','manifest','manifest_sha256','body','media_type']);
 if(row===null)return null;
 if(row.id!==jobId)throw Error('ARTIFACT_UNAVAILABLE');
 const manifest=snapshotClaimData(row.manifest);
 if(!validOpaqueText(row.id)||
  (row.manifest!==null&&typeof row.manifest==='object'&&manifest===null)||
  (row.body!==null&&typeof row.body==='object'&&utilTypes.isProxy(row.body)))throw Error('POD_QUERY_UNVERIFIED');
 const body=Buffer.isBuffer(row.body)?Buffer.from(row.body):row.body;
 return {id:row.id,platform:row.platform,state:row.state,reason_code:row.reason_code,
  manifest,manifest_sha256:row.manifest_sha256,body,media_type:row.media_type};
}
function publishableQuerySnapshot(result,job){
 const row=exactQueryRow(result,['id','platform','manifest','qa_envelope','manifest_sha256']);
 if(row===null)return null;
 const manifest=snapshotClaimData(row.manifest),qaEnvelope=snapshotClaimData(row.qa_envelope);
 if(row.id!==job.id||row.platform!==job.platform||!SHA256.test(row.manifest_sha256||'')||
  manifest===null||typeof manifest!=='object'||Array.isArray(manifest)||
  qaEnvelope===null||typeof qaEnvelope!=='object'||Array.isArray(qaEnvelope))throw Error('POD_QUERY_UNVERIFIED');
 return {id:row.id,platform:row.platform,manifest,qa_envelope:qaEnvelope,manifest_sha256:row.manifest_sha256};
}
function publishAccountLockQuerySnapshot(result,accountId){
 const row=exactQueryRow(result,['id']);
 if(row!==null&&(!validOpaqueText(row.id)||row.id!==accountId))throw Error('POD_QUERY_UNVERIFIED');
 return row;
}
function publishAccountQuerySnapshot(result,accountId){
 const row=exactQueryRow(result,['id','platform','daily_cap']);
 if(row!==null&&(!validOpaqueText(row.id)||row.id!==accountId||!PLATFORMS.includes(row.platform)||
  !Number.isSafeInteger(row.daily_cap)||row.daily_cap<0))throw Error('POD_QUERY_UNVERIFIED');
 return row;
}
function queryPresenceSnapshot(result){
 const row=exactQueryRow(result,['present']);
 if(row!==null&&row.present!==true)throw Error('POD_QUERY_UNVERIFIED');
 return row!==null;
}
function nonnegativeCountQuerySnapshot(result){
 const row=exactQueryRow(result,['n']);
 if(row===null||!Number.isSafeInteger(row.n)||row.n<0)throw Error('POD_QUERY_UNVERIFIED');
 return row.n;
}
function publishCandidateQuerySnapshot(result,accountId,platform){
 const row=exactQueryRow(result,['id','account_id','platform','manifest','qa_envelope','manifest_sha256']);
 if(row===null)return null;
 const manifest=row.manifest===null?null:snapshotClaimData(row.manifest),
  qaEnvelope=row.qa_envelope===null?null:snapshotClaimData(row.qa_envelope);
 if(!validOpaqueText(row.id)||!validOpaqueText(row.account_id)||row.account_id!==accountId||
  row.platform!==platform||!PLATFORMS.includes(row.platform)||
  (row.manifest_sha256!==null&&!SHA256.test(row.manifest_sha256||''))||
  (row.manifest!==null&&(manifest===null||typeof manifest!=='object'||Array.isArray(manifest)))||
  (row.qa_envelope!==null&&(qaEnvelope===null||typeof qaEnvelope!=='object'||Array.isArray(qaEnvelope))))
  throw Error('POD_QUERY_UNVERIFIED');
 return {id:row.id,account_id:row.account_id,platform:row.platform,manifest,
  qa_envelope:qaEnvelope,manifest_sha256:row.manifest_sha256};
}
function assertSettlement(state,receipt,reason){
 if(state==='submitted'){
  if(!exactObject(receipt,['id'])||!validOpaqueText(receipt.id))throw Error('RECEIPT_INVALID');
  if(reason!==null)throw Error('SETTLEMENT_INVALID');
  return;
 }
 if(!exactObject(receipt,[])||reason!==RELEASE_REASONS[state])throw Error('SETTLEMENT_INVALID');
}
function canonical(value){
 return Array.isArray(value)?`[${value.map(canonical).join(',')}]`:
  value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:
  JSON.stringify(value);
}
function firstSqlCommand(text){
 let offset=0;
 while(offset<text.length){
  while(offset<text.length&&/[\s;]/.test(text[offset]))offset++;
  if(text.startsWith('--',offset)){
   const newline=text.slice(offset+2).search(/[\r\n]/);offset=newline<0?text.length:offset+newline+3;continue;
  }
  if(text.startsWith('/*',offset)){
   let depth=1;offset+=2;
   while(offset<text.length&&depth){
    if(text.startsWith('/*',offset)){depth++;offset+=2;}
    else if(text.startsWith('*/',offset)){depth--;offset+=2;}
    else offset++;
   }
   if(depth) return '';
   continue;
  }
  break;
 }
 return /^[a-z]+/i.exec(text.slice(offset))?.[0].toUpperCase()||'';
}
function assertManagedTransactionStatement(text){
 if(typeof text==='string'&&TRANSACTION_COMMANDS.has(firstSqlCommand(text)))throw Error('POD_TRANSACTION_CONTROL_FORBIDDEN');
}
async function sanitizePooledClient(client){
 // Callback SQL can change session-scoped settings through otherwise ordinary
 // SELECT expressions (for example set_config(..., false)), acquire session
 // advisory locks or register listeners. A successful COMMIT/ROLLBACK does not
 // clear those capabilities. Scrub the server session before this connection
 // can serve unrelated pooled work. DISCARD ALL restores the connection's own
 // startup defaults (including createPodPool's explicit search_path); forcing
 // a different fixed path here would contaminate caller-supplied pools. Any
 // cleanup failure makes the client unsafe to reuse.
 try{
  await client.query('DISCARD ALL');
  return false;
 }catch{return true;}
}
function durableManifestIdentity(manifest,platform,state={nodes:0},depth=0){
 if(!PLATFORMS.includes(platform)||!manifest||typeof manifest!=='object'||Array.isArray(manifest)||manifest.schema_version!==1||
  manifest.platform!==platform||manifest.publication_enabled!==false||
  !SHA256.test(manifest.package_sha256||''))throw Error('PACKAGE_UNAVAILABLE');
 const files=manifest.files;
 if(!files||typeof files!=='object'||Array.isArray(files)||Object.keys(files).length<1||Object.keys(files).length>64)throw Error('PACKAGE_UNAVAILABLE');
 const expected=platform==='kdp'?KDP_REVIEW_FILES:BASE_REVIEW_FILES;
 if(JSON.stringify(Object.keys(files).sort())!==JSON.stringify(expected))throw Error('PACKAGE_UNAVAILABLE');
 for(const [name,hash] of Object.entries(files))if(!REVIEW_FILE.test(name)||name==='manifest.json'||typeof hash!=='string'||!SHA256.test(hash))throw Error('PACKAGE_UNAVAILABLE');
 const inspect=(value,level)=>{
  if(level>64||++state.nodes>10000)throw Error('PACKAGE_UNAVAILABLE');
  if(typeof value==='number'&&(!Number.isFinite(value)||(Number.isInteger(value)&&!Number.isSafeInteger(value))))throw Error('PACKAGE_UNAVAILABLE');
  if(Array.isArray(value)){if(value.length>10000)throw Error('PACKAGE_UNAVAILABLE');for(const item of value)inspect(item,level+1);}
  else if(value&&typeof value==='object'){const keys=Object.keys(value);if(keys.length>10000)throw Error('PACKAGE_UNAVAILABLE');for(const key of keys)inspect(value[key],level+1);}
 };
 inspect(manifest,depth);
 return crypto.createHash('sha256').update(canonical(manifest)).digest('hex');
}
function admitDurableManifest(manifest,platform){
 if(!SHA256.test(manifest?.template_sha256||''))throw Error('PACKAGE_UNAVAILABLE');
 return durableManifestIdentity(manifest,platform);
}
function assertStoredManifest(manifest,platform,manifestSha256){
 if(!SHA256.test(manifestSha256||'')||
  durableManifestIdentity(manifest,platform)!==manifestSha256)throw Error('PACKAGE_UNAVAILABLE');
}
function assertStoredQA(envelope,key,manifest,platform){
 try{
  enforceQA(verifyEnvelope(envelope,key,'content-control:pod:qa'),manifest.package_sha256,manifest.template_sha256,platform);
 }catch{throw Error('QA_EVIDENCE_UNAVAILABLE');}
}
function assertCurrentReleaseSnapshot(current,claimed,key){
 try{
  assertStoredManifest(current.manifest,current.platform,current.manifest_sha256);
  assertStoredQA(current.qa_envelope,key,current.manifest,current.platform);
  if(durableManifestIdentity(claimed.manifest,claimed.platform)!==current.manifest_sha256||
   current.qa_envelope.payload!==claimed.qa_envelope?.payload||
   current.qa_envelope.signature!==claimed.qa_envelope?.signature)throw Error('RELEASE_SNAPSHOT_CHANGED');
 }catch{throw Error('LOCAL_RELEASE_BLOCKED');}
}
async function conceptBudgetDay(client){
 const row=exactQueryRow(await client.query("SELECT (clock_timestamp() AT TIME ZONE 'UTC')::date::text AS budget_day"),['budget_day']),
  day=row?.budget_day;
 if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error('CONCEPT_BUDGET_CLOCK_INVALID');
 return day;
}
async function lockProductionLease(client,job){
 const current=producibleQuerySnapshot(await client.query("SELECT id FROM pod_production_queue WHERE id=$1 AND fencing_token=$2 AND state='processing' FOR UPDATE",[job.id,job.fencing_token]),job);
 if(!current)throw Error('LEASE_LOST');
 // Evaluate wall time in a separate statement after acquiring the row lock.
 // now() is fixed at BEGIN, and a SELECT expression can run before a lock wait.
 const lease=exactQueryRow(await client.query('SELECT lease_until>clock_timestamp() AS valid FROM pod_production_queue WHERE id=$1',[job.id]),['valid']);
 if(lease?.valid!==true)throw Error('LEASE_LOST');
}
async function lockPublishingLease(client,job){
 const current=producibleQuerySnapshot(await client.query("SELECT id FROM pod_production_queue WHERE id=$1 AND fencing_token=$2 AND state='publishing' FOR UPDATE",[job.id,job.fencing_token]),job);
 if(!current)throw Error('LEASE_LOST');
 // The provider call can outlive its release lease. Check wall time only after
 // acquiring the row lock so a stale publisher cannot commit a late outcome.
 const lease=exactQueryRow(await client.query('SELECT lease_until>clock_timestamp() AS valid FROM pod_production_queue WHERE id=$1',[job.id]),['valid']);
 if(lease?.valid!==true)throw Error('LEASE_LOST');
}
export async function createPodPool(env=process.env) {
 const {default:pg}=await import('pg');
 let u;try{u=new URL(env.POD_DATABASE_URL);}catch{throw Error('POD_DATABASE_REQUIRED');}
 if(!['postgres:','postgresql:'].includes(u.protocol)||!u.username||!u.password||u.pathname.length<2||
  u.hash||[...u.searchParams.keys()].some(k=>k!=='sslmode')||
  (u.searchParams.has('sslmode')&&!['require','verify-full'].includes(u.searchParams.get('sslmode')))) throw Error('POD_DATABASE_INVALID');
 const pool=new pg.Pool({host:u.hostname,port:Number(u.port||5432),user:decodeURIComponent(u.username),
  password:decodeURIComponent(u.password),database:decodeURIComponent(u.pathname.slice(1)),
  ssl:{rejectUnauthorized:true},options:'-c search_path=pg_catalog,public',
  max:2,connectionTimeoutMillis:10000,query_timeout:15000,idleTimeoutMillis:10000});
 Object.defineProperty(pool,'podConnectionHealth',{value:monitorPodPool(pool)});
 return pool;
}
export class PodDB {
 constructor({pool,bridge,upstreamKey,qaKey,expiresAt}) {
  assertBridge(bridge);Object.assign(this,{pool,upstreamKey,qaKey,expiresAt:parseStorageExpiry(expiresAt)});
 }
 active(){
  const now=Date.now();
  if(!validDateMs(now)||!validDateMs(this.expiresAt)||
   this.expiresAt-now<=86400000)throw Error('POD_STORAGE_EXPIRING');
 }
 async read(sql,values,{signal}={}){
  const checkpoint=()=>signal?.throwIfAborted();
  this.active();checkpoint();const waiting=databaseWait(signal);
  let c,bad=false,began=false,beginAttempted=false,commitPending=false,ended=false;
  try{
   c=await waiting.step(()=>this.pool.connect(),{onLate:late=>late.release(true)});
   // Pool acquisition and transaction setup can cross the retention cutoff.
   // Keep every shared read in a database-enforced read-only transaction so a
   // mistaken future caller cannot mutate durable state through this helper.
   this.active();checkpoint();beginAttempted=true;await waiting.step(()=>c.query('BEGIN READ ONLY'));began=true;this.active();checkpoint();
   await waiting.step(()=>c.query("SET LOCAL statement_timeout='10s'"));this.active();checkpoint();
   // Force the extended protocol even for parameterless reads. PostgreSQL's
   // simple-query protocol accepts multiple statements, which could otherwise
   // end this read-only transaction before a later statement in the same call.
   // The caller owns only the read statement, not this helper's transaction.
   // Extended protocol rejects multiple statements but still accepts a lone
   // COMMIT or ROLLBACK, so reject transaction control before PostgreSQL can
   // end the managed read transaction early.
   assertManagedTransactionStatement(sql);
   const result=await waiting.step(()=>c.query({text:sql,values:values??[],queryMode:'extended'}));this.active();checkpoint();
   // COMMIT must settle so a completed read has a known outcome. Cancellation
   // is applied immediately after it, matching the managed write boundary.
   commitPending=true;await c.query('COMMIT');commitPending=false;began=false;beginAttempted=false;ended=true;checkpoint();return result;
  }catch(error){if(c&&(waiting.interrupted||commitPending))bad=true;else if(c&&began)try{await c.query('ROLLBACK');ended=true;}catch{bad=true;}else if(c&&beginAttempted)bad=true;throw error;
  }finally{if(c){if(ended&&!bad)bad=await sanitizePooledClient(c);c.release(bad);}}
 }
 async registerIntake({id,businessId,envelope,intakeKey,dailyLimit=100}){
  if(!Number.isInteger(dailyLimit)||dailyLimit<1||dailyLimit>1000)throw Error('CONCEPT_LIMIT_INVALID');
  const intake=verifyEnvelope(envelope,intakeKey,'content-control:pod:intake');
  if(!validOpaqueText(id)||!validOpaqueText(businessId)||intake.concept_id!==id||intake.business_id!==businessId||
    typeof intake.fingerprint!=='string'||intake.fingerprint.trim().length===0||
    intake.fingerprint.includes('\0')||Buffer.from(intake.fingerprint,'utf8').toString('utf8')!==intake.fingerprint||
    !['PASS','FAIL','UNKNOWN'].includes(intake.rights_state))throw Error('INTAKE_SCOPE_INVALID');
  return this.tx(async c=>{
   // Serialize fingerprint deduplication so duplicate retries never consume unique-concept budget.
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[intake.fingerprint]);
   const existing=intakeConceptQuerySnapshot(await c.query('SELECT id,business_id,rights_state,permanently_unpublished FROM pod_concepts WHERE fingerprint=$1 FOR UPDATE',[intake.fingerprint]));
   if(existing){
    if(existing.business_id!==businessId)throw Error('INTAKE_FINGERPRINT_CONFLICT');
    // Deduplication saves concept budget, never discards newly adverse evidence.
    // Preserve an existing tombstone exactly; even later PASS cannot revive it.
    if(intake.rights_state!=='PASS'&&!existing.permanently_unpublished){
     assertExactMutation(await c.query('UPDATE pod_concepts SET rights_state=$2,permanently_unpublished=true WHERE id=$1 RETURNING id,rights_state,permanently_unpublished',[existing.id,intake.rights_state]),
      {id:existing.id,rights_state:intake.rights_state,permanently_unpublished:true});
     const eventId=crypto.randomUUID(),eventKind='pod.concept.rights_blocked';
     assertExactMutation(await c.query('INSERT INTO pod_events(id,kind,payload) VALUES($1,$2,$3) RETURNING id,kind',[eventId,eventKind,
      {concept_id:existing.id,business_id:businessId,rights_state:intake.rights_state,
       intake_sha256:crypto.createHash('sha256').update(envelope.payload).digest('hex'),publication_enabled:false}]),
      {id:eventId,kind:eventKind});
    }
    verifyEnvelope(envelope,intakeKey,'content-control:pod:intake');
    return {id:existing.id};
   }
   // Serialize a business's admission budget before selecting wall-clock UTC day.
   // Transaction-start now() can be yesterday after a fingerprint/budget wait.
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['pod:concept-budget:'+businessId]);
   const day=await conceptBudgetDay(c);
   await c.query('INSERT INTO pod_daily_concept_budget(business_id,day) VALUES($1,$2::date) ON CONFLICT DO NOTHING',[businessId,day]);
   const budget=await c.query('UPDATE pod_daily_concept_budget SET used=used+1 WHERE business_id=$1 AND day=$2::date AND used<$3 RETURNING business_id,day::text AS day,(used<=$3) AS within_limit',[businessId,day,dailyLimit]);
   if(exactEmptyMutation(budget))throw Error('DAILY_CONCEPT_LIMIT');
   assertExactMutation(budget,{business_id:businessId,day,within_limit:true});
   assertExactMutation(await c.query('INSERT INTO pod_concepts(id,business_id,fingerprint,rights_state,permanently_unpublished,created_at) VALUES($1,$2,$3,$4,$5,clock_timestamp()) RETURNING id,business_id,fingerprint,rights_state,permanently_unpublished',[id,businessId,intake.fingerprint,intake.rights_state,intake.rights_state!=='PASS']),
    {id,business_id:businessId,fingerprint:intake.fingerprint,rights_state:intake.rights_state,permanently_unpublished:intake.rights_state!=='PASS'});
   if(await conceptBudgetDay(c)!==day)throw Error('CONCEPT_BUDGET_DAY_CHANGED');
   // Revalidate after all database waits so expiry rolls back budget and writes.
   verifyEnvelope(envelope,intakeKey,'content-control:pod:intake');
   return {id};
  });
 }
 async requeueRepair(jobId,upstream,{signal}={}){
  const grant=verifyEnvelope(upstream,this.upstreamKey,'content-control:pod');
  // A current grant may authorize only its exact repair target. Reject wrong
  // or lossy route identities before acquiring or locking database rows.
  if(!validOpaqueText(jobId)||!validOpaqueText(grant.job_id)||grant.job_id!==jobId)throw Error('GRANT_SCOPE_MISMATCH');
  return this.tx(async c=>{
   // Only an expired internal production lease is recoverable from blocked.
   // Publication ambiguity and other blocked reasons must never become raw.
   const j=repairableQuerySnapshot(await c.query(`SELECT q.id,q.brief,q.attempt,q.manifest,q.qa_envelope,q.reason_code
    FROM pod_production_queue q JOIN pod_concepts p ON p.id=q.concept_id
    WHERE q.id=$1 AND (q.state='qa_failed' OR (q.state='blocked' AND q.reason_code='PRODUCTION_LEASE_EXPIRED'
      AND q.lease_until<=clock_timestamp() AND q.provider_id IS NULL))
    AND q.attempt<3 AND p.rights_state='PASS' AND NOT p.permanently_unpublished
    FOR UPDATE OF q FOR SHARE OF p`,[jobId]),jobId);
   if(!j)throw Error('REPAIR_BLOCKED');enforceBrief(grant,j.brief);
   const eventId=crypto.randomUUID(),eventKind='pod.repair.archived';
   const archived=await c.query('INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,$3,$4) RETURNING id,job_id,kind',
    [eventId,j.id,eventKind,{attempt:j.attempt,manifest:j.manifest,qa_envelope:j.qa_envelope,reason_code:productionReason(j.reason_code)}]);
   assertExactMutation(archived,{id:eventId,job_id:j.id,kind:eventKind});
   const queued=await c.query("UPDATE pod_production_queue SET state='raw',reason_code=NULL,manifest=NULL,qa_envelope=NULL,lease_until=NULL,upstream_envelope=$2,next_attempt_at=now(),updated_at=now() WHERE id=$1 RETURNING id,state,reason_code",[jobId,upstream]);
   assertExactMutation(queued,{id:jobId,state:'raw',reason_code:null});
   verifyEnvelope(upstream,this.upstreamKey,'content-control:pod');
  },{signal});
 }
 async tx(fn,{signal}={}){
  const checkpoint=()=>signal?.throwIfAborted();
  this.active();checkpoint();const waiting=databaseWait(signal);
  let c,bad=false,began=false,beginAttempted=false,commitPending=false,ended=false;
  try{
   c=await waiting.step(()=>this.pool.connect(),{onLate:late=>late.release(true)});
   // Connection acquisition and transaction setup are asynchronous too. Do
   // not let a retention cutoff crossed in those waits reach business SQL.
   this.active();checkpoint();beginAttempted=true;await waiting.step(()=>c.query('BEGIN'));began=true;this.active();checkpoint();
   await waiting.step(()=>c.query("SET LOCAL lock_timeout='2s'"));this.active();checkpoint();
   await waiting.step(()=>c.query("SET LOCAL statement_timeout='10s'"));this.active();checkpoint();
   // A callback may await non-database work between statements (for example,
   // archive file verification). Check on both sides so crossing the retention
   // cutoff in that wait cannot issue one last business statement.
   // Force every callback business statement through the extended protocol,
   // including parameterless statements. The simple-query protocol accepts a
   // multi-command string that could COMMIT early and run a later command
   // outside this helper's transaction and retention checks.
   const pendingQueries=new Set();let queryFailure=null,acceptingQueries=true;
   const guardedQuery=(query,values)=>{
    if(!acceptingQueries)throw Error('POD_TRANSACTION_CLIENT_CLOSED');
    this.active();checkpoint();
    const config=typeof query==='string'?{text:query,values:values??[],queryMode:'extended'}:{...query,queryMode:'extended'};
    // DISCARD ALL deliberately clears server-side prepared statements. Do not
    // let a callback create a named statement that node-postgres would still
    // cache locally after the server session is scrubbed.
    if(config.name!==undefined)throw Error('POD_NAMED_QUERY_FORBIDDEN');
    // The callback owns business SQL, not the transaction. Extended protocol
    // rejects multi-command strings, but a standalone COMMIT/ROLLBACK would
    // still end this managed transaction and could make an eventual rollback
    // unable to undo earlier writes. Reject transaction-control commands before
    // PostgreSQL can execute them, including comment-obscured forms.
    assertManagedTransactionStatement(config.text);
    const operation=(async()=>{const result=await waiting.step(()=>c.query(config));this.active();checkpoint();return result;})();
    // A callback must not be able to report success by starting a database
    // operation and returning without awaiting it. Track every issued query,
    // consume its rejection immediately and preserve the first failure so the
    // managed transaction always rolls back.
    pendingQueries.add(operation);
    operation.then(
     ()=>pendingQueries.delete(operation),
     error=>{pendingQueries.delete(operation);queryFailure??=error;}
    );
    return operation;
   };
   // Expose a query-only capability, never the pooled client. In particular,
   // release() could return this still-open transaction to the pool before the
   // helper commits or rolls it back, while connection internals could bypass
   // the guarded query path entirely.
   const facade=Object.freeze(Object.assign(Object.create(null),{query:guardedQuery}));
   const forbidden=()=>{throw Error('POD_TRANSACTION_CLIENT_CONTROL_FORBIDDEN');};
   const guarded=new Proxy(facade,{
    get:(_,property)=>property==='query'?guardedQuery:forbidden(),
    set:forbidden,defineProperty:forbidden,deleteProperty:forbidden,
   });
   let r;
   try{r=await fn(guarded);}
   finally{
    // The query capability belongs only to the callback lifetime. A retained
    // reference must never reach this pooled client during commit or after
    // release into another transaction.
    acceptingQueries=false;
   }
   while(pendingQueries.size)await Promise.allSettled([...pendingQueries]);
   if(queryFailure)throw queryFailure;
   // COMMIT must settle so its outcome is known. The managed transaction's
   // ten-second statement timeout bounds this control statement; cancellation
   // is applied at the checkpoint immediately after it completes.
   this.active();checkpoint();commitPending=true;await c.query('COMMIT');commitPending=false;began=false;beginAttempted=false;ended=true;checkpoint();return r;
  }catch(e){if(c&&(waiting.interrupted||commitPending))bad=true;else if(c&&began)try{await c.query('ROLLBACK');ended=true;}catch{bad=true;}else if(c&&beginAttempted)bad=true;throw e;
  }finally{if(c){if(ended&&!bad)bad=await sanitizePooledClient(c);c.release(bad);}}
 }
 async enqueue({job,upstream,conceptId,revision}) {
  const grant=verifyEnvelope(upstream,this.upstreamKey,'content-control:pod');
  const brief=enforceBrief(grant,job);
  // Validate queue-only scope before connection acquisition. PostgreSQL uuid
  // and int4 coercion must not decide whether malformed input is admissible.
  if(!validOpaqueText(conceptId)||!Number.isInteger(revision)||revision<1||revision>2147483647)throw Error('QUEUE_SCOPE_INVALID');
  return this.tx(async c=>{
   const concept=enqueueConceptQuerySnapshot(await c.query('SELECT business_id,rights_state,permanently_unpublished FROM pod_concepts WHERE id=$1 FOR SHARE',[conceptId]));
   if(concept?.rights_state!=='PASS'||concept.permanently_unpublished||concept.business_id!==job.business_id)throw Error('RIGHTS_BLOCKED');
   const key=crypto.createHash('sha256').update(JSON.stringify([conceptId,job.account_id,revision])).digest('hex');
   const r=await c.query(`INSERT INTO pod_production_queue(id,concept_id,account_id,platform,revision,brief,upstream_envelope,idempotency_key)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id`,
    [job.id,conceptId,job.account_id,job.platform,revision,brief,upstream,key]);
   if(exactEmptyMutation(r))throw Error('DUPLICATE_JOB');
   assertExactMutation(r,{id:job.id});
   verifyEnvelope(upstream,this.upstreamKey,'content-control:pod');return {id:job.id};
  });
 }
 async listReady({signal}={}){this.active();
  const rows=readyListQuerySnapshot(await this.read("SELECT q.id,q.platform,q.state FROM pod_production_queue q JOIN pod_concepts p ON p.id=q.concept_id WHERE q.state='qa_passed' AND p.rights_state='PASS' AND NOT p.permanently_unpublished ORDER BY q.created_at LIMIT 20",[],{signal}));
  this.active();return rows;
 }
 async listOperationsJobs(state='review_required',{signal}={}){
  if(!['review_required','raw','processing','qa_failed','qa_passed','blocked','publishing','ambiguous','submitted','published'].includes(state))throw Error('JOB_FILTER_INVALID');
  this.active();
  const rows=operationsListQuerySnapshot(await this.read(`SELECT q.id,q.platform,
   CASE WHEN q.state='qa_failed' AND q.reason_code='REVIEW_REQUIRED' THEN 'review_required' ELSE q.state END AS state,
   q.reason_code,q.attempt,q.created_at,q.manifest,
   (SELECT e.payload->>'manifest_sha256' FROM pod_events e WHERE e.job_id=q.id
    AND e.kind='pod.production.review_required' AND e.payload ? 'manifest_sha256'
    ORDER BY e.created_at DESC,e.id DESC LIMIT 1) AS manifest_sha256,
   q.manifest IS NOT NULL AND q.state='qa_failed' AND q.reason_code='REVIEW_REQUIRED'
    AND p.rights_state='PASS' AND NOT p.permanently_unpublished AS can_preview
   FROM pod_production_queue q JOIN pod_concepts p ON p.id=q.concept_id
   WHERE CASE WHEN q.state='qa_failed' AND q.reason_code='REVIEW_REQUIRED' THEN 'review_required' ELSE q.state END=$1
   ORDER BY q.created_at DESC,q.id DESC LIMIT 50`,[state],{signal}),state);
  const listed=rows.map(row=>{
   const {manifest,manifest_sha256,...listed}=row;
   let canPreview=listed.can_preview;
   if(canPreview)try{assertStoredManifest(manifest,row.platform,manifest_sha256);}catch{canPreview=false;}
   return {...listed,can_preview:canPreview,
    reason_code:row.reason_code===null?null:productionReason(row.reason_code)};
  });
  this.active();return listed;
 }
 async failProduction(job,reason){return this.tx(async c=>{
  await lockProductionLease(c,job);
  const reasonCode=productionReason(reason);
  assertExactMutation(await c.query("UPDATE pod_production_queue SET state='qa_failed',reason_code=$1,lease_until=NULL,updated_at=now() WHERE id=$2 AND fencing_token=$3 AND state='processing' AND lease_until>clock_timestamp() RETURNING id,state,reason_code",[reasonCode,job.id,job.fencing_token]),
   {id:job.id,state:'qa_failed',reason_code:reasonCode});
 });}
 async claimProduction({signal}={}){return this.tx(async c=>{
  // Lock acquisition can outlive a retry deadline. Eligibility and the new
  // lease must use wall time, not the timestamp frozen at transaction BEGIN.
  const r=await c.query(`UPDATE pod_production_queue SET state='processing',lease_until=clock_timestamp()+interval '30 minutes',
   fencing_token=fencing_token+1,attempt=attempt+1,updated_at=clock_timestamp()
   WHERE id=(SELECT q.id FROM pod_production_queue q JOIN pod_concepts p ON p.id=q.concept_id
    WHERE q.state='raw' AND q.next_attempt_at<=clock_timestamp() AND p.rights_state='PASS' AND NOT p.permanently_unpublished
    ORDER BY q.created_at FOR UPDATE OF q SKIP LOCKED LIMIT 1)
    RETURNING id,account_id,platform,fencing_token::text AS fencing_token,attempt,brief,state`);
  return claimedProductionMutation(r);
 },{signal});}
 async assertProducible(job){return this.tx(async c=>{
  const current=producibleQuerySnapshot(await c.query(`SELECT q.id FROM pod_production_queue q JOIN pod_concepts p ON p.id=q.concept_id
   WHERE q.id=$1 AND q.fencing_token=$2 AND q.account_id=$3 AND q.platform=$4
   AND q.state='processing' AND p.rights_state='PASS' AND NOT p.permanently_unpublished
   FOR SHARE OF q,p`,[job.id,job.fencing_token,job.account_id,job.platform]),job);
  if(!current)throw Error('LOCAL_PRODUCTION_BLOCKED');
  // A queued lock acquisition must not preserve an expired production lease.
  const lease=exactQueryRow(await c.query('SELECT lease_until>clock_timestamp() AS valid FROM pod_production_queue WHERE id=$1',[job.id]),['valid']);
  if(lease?.valid!==true)throw Error('LOCAL_PRODUCTION_BLOCKED');
  return true;
 });}
 async holdProduction(job,manifest,{beforeStateChange}={}){
  if(beforeStateChange!==undefined&&typeof beforeStateChange!=='function')throw Error('HOLD_GUARD_INVALID');
  // Invalid package metadata must never become durable review state. Review
  // reads rejecting it later is not enough because the queue/event write would
  // already have advertised a package that cannot be independently retrieved.
  const manifestSha256=admitDurableManifest(manifest,job.platform);
  return this.tx(async c=>{
  await lockProductionLease(c,job);
  // The earlier stage check releases its locks before this transaction. Bind
  // the durable review hold to current concept rights after acquiring the live
  // production lease, then run the caller's synchronous authority/stop guard.
  const current=productionRightsQuerySnapshot(await c.query(`SELECT p.rights_state,p.permanently_unpublished
   FROM pod_production_queue q JOIN pod_concepts p ON p.id=q.concept_id
   WHERE q.id=$1 AND q.fencing_token=$2 AND q.state='processing'
   FOR UPDATE OF q FOR SHARE OF p`,[job.id,job.fencing_token]));
  if(!current)throw Error('LEASE_LOST');
  if(current.rights_state!=='PASS'||current.permanently_unpublished)throw Error('RIGHTS_BLOCKED');
  beforeStateChange?.();
  assertExactMutation(await c.query("UPDATE pod_production_queue SET state='qa_failed',reason_code='REVIEW_REQUIRED',manifest=$1,lease_until=NULL,updated_at=now() WHERE id=$2 AND fencing_token=$3 AND state='processing' AND lease_until>clock_timestamp() RETURNING id,state,reason_code",[manifest,job.id,job.fencing_token]),
   {id:job.id,state:'qa_failed',reason_code:'REVIEW_REQUIRED'});
  const eventId=crypto.randomUUID(),eventKind='pod.production.review_required';
  assertExactMutation(await c.query('INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,$3,$4) RETURNING id,job_id,kind',[eventId,job.id,eventKind,
   {package_sha256:manifest.package_sha256,manifest_sha256:manifestSha256,publication_enabled:false}]),
   {id:eventId,job_id:job.id,kind:eventKind});
 });}
 async acceptReview(jobId,qaEnvelope,{signal}={}){
  verifyEnvelope(qaEnvelope,this.qaKey,'content-control:pod:qa');
  // Authenticate first, then reject malformed route identities before a
  // connection or query parameter. Review artifacts already use this bound.
  if(typeof jobId!=='string'||!REVIEW_JOB.test(jobId))throw Error('REVIEW_NOT_PENDING');
  return this.tx(async c=>{
   const job=reviewableQuerySnapshot(await c.query(`SELECT q.id,q.platform,q.manifest,
    (SELECT e.payload->>'manifest_sha256' FROM pod_events e WHERE e.job_id=q.id
     AND e.kind='pod.production.review_required' AND e.payload ? 'manifest_sha256'
     ORDER BY e.created_at DESC,e.id DESC LIMIT 1) AS manifest_sha256
    FROM pod_production_queue q JOIN pod_concepts p ON p.id=q.concept_id
    WHERE q.id=$1 AND q.state='qa_failed' AND q.reason_code='REVIEW_REQUIRED'
    AND p.rights_state='PASS' AND NOT p.permanently_unpublished
    FOR UPDATE OF q FOR SHARE OF p`,[jobId]),jobId);
   if(!job)throw Error('REVIEW_NOT_PENDING');
   // A signed QA decision can only promote the same package that the owner
   // could retrieve from this durable review hold. Missing, malformed or
   // mismatched event provenance fails before any queue or event write.
   assertStoredManifest(job.manifest,job.platform,job.manifest_sha256);
   // Authentication before connection acquisition cannot authorize an expired
   // review after pool or row-lock waits. Revalidate at the state transition.
   enforceQA(verifyEnvelope(qaEnvelope,this.qaKey,'content-control:pod:qa'),job.manifest.package_sha256,job.manifest.template_sha256,job.platform);
   assertExactMutation(await c.query("UPDATE pod_production_queue SET state='qa_passed',qa_envelope=$2,reason_code=NULL,updated_at=now() WHERE id=$1 RETURNING id,state,reason_code",[jobId,qaEnvelope]),
    {id:jobId,state:'qa_passed',reason_code:null});
   const eventId=crypto.randomUUID(),eventKind='pod.production.qa_passed';
   assertExactMutation(await c.query('INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,$3,$4) RETURNING id,job_id,kind',[eventId,jobId,eventKind,
    {package_sha256:job.manifest.package_sha256,manifest_sha256:job.manifest_sha256,publication_enabled:false}]),
    {id:eventId,job_id:jobId,kind:eventKind});
   verifyEnvelope(qaEnvelope,this.qaKey,'content-control:pod:qa');
   return {status:'QA_PASSED',publication_enabled:false};
  },{signal});
 }
 async reviewPackage(jobId,{signal}={}){this.active();
  if(typeof jobId!=='string'||!REVIEW_JOB.test(jobId))throw Error('PACKAGE_UNAVAILABLE');
  const row=reviewPackageQuerySnapshot(await this.read(`SELECT q.id,q.platform,q.state,q.reason_code,q.manifest,
   (SELECT e.payload->>'manifest_sha256' FROM pod_events e WHERE e.job_id=q.id
    AND e.kind='pod.production.review_required' AND e.payload ? 'manifest_sha256'
    ORDER BY e.created_at DESC,e.id DESC LIMIT 1) AS manifest_sha256
   FROM pod_production_queue q JOIN pod_concepts p ON p.id=q.concept_id
   WHERE q.id=$1 AND q.state='qa_failed' AND q.reason_code='REVIEW_REQUIRED'
   AND p.rights_state='PASS' AND NOT p.permanently_unpublished`,[jobId],{signal}),jobId);
  if(!row?.manifest||row.id!==jobId||row.state!=='qa_failed'||row.reason_code!=='REVIEW_REQUIRED'||!PLATFORMS.includes(row.platform))throw Error('PACKAGE_UNAVAILABLE');
  assertStoredManifest(row.manifest,row.platform,row.manifest_sha256);
  this.active();
  return row;
 }
 async reviewArtifact(jobId,sha,{signal}={}){this.active();
  if(typeof jobId!=='string'||!REVIEW_JOB.test(jobId)||typeof sha!=='string'||!SHA256.test(sha))throw Error('ARTIFACT_UNAVAILABLE');
  // Resolve the hold, manifest and bytes in one database snapshot. A bearer
  // key and a known content hash alone must not expose unrelated stored data.
  const row=reviewArtifactQuerySnapshot(await this.read(`SELECT q.id,q.platform,q.state,q.reason_code,q.manifest,
   (SELECT e.payload->>'manifest_sha256' FROM pod_events e WHERE e.job_id=q.id
    AND e.kind='pod.production.review_required' AND e.payload ? 'manifest_sha256'
    ORDER BY e.created_at DESC,e.id DESC LIMIT 1) AS manifest_sha256,
   a.body,a.media_type
   FROM pod_production_queue q JOIN pod_concepts p ON p.id=q.concept_id
   JOIN pod_artifacts a ON a.sha256=$2
   WHERE q.id=$1 AND q.state='qa_failed' AND q.reason_code='REVIEW_REQUIRED'
   AND p.rights_state='PASS' AND NOT p.permanently_unpublished
   AND octet_length(a.body) BETWEEN 1 AND $3 AND a.media_type=ANY($4::text[])`,
   [jobId,sha,16777216,ARTIFACT_MEDIA_TYPES],{signal}),jobId);
  if(!row||row.id!==jobId||row.state!=='qa_failed'||row.reason_code!=='REVIEW_REQUIRED'||
   !Buffer.isBuffer(row.body)||!row.body.length||row.body.length>16777216||!artifactMediaTypes.has(row.media_type))throw Error('ARTIFACT_UNAVAILABLE');
  assertStoredManifest(row.manifest,row.platform,row.manifest_sha256);
  const members=Object.entries(row.manifest.files).filter(([,digest])=>digest===sha);
  if(!members.length||members.some(([name])=>PACKAGE_MEDIA_TYPES[name]!==row.media_type)||
   crypto.createHash('sha256').update(row.body).digest('hex')!==sha)throw Error('ARTIFACT_UNAVAILABLE');
  try{for(const [name] of members)assertPackageFormat(name,row.body);}
  catch{throw Error('ARTIFACT_UNAVAILABLE');}
  this.active();
  return {body:row.body,media_type:row.media_type};
 }
 async completeProduction(job,manifest,qaEnvelope,{beforeStateChange}={}){
  if(beforeStateChange!==undefined&&typeof beforeStateChange!=='function')throw Error('COMPLETION_GUARD_INVALID');
  const qa=verifyEnvelope(qaEnvelope,this.qaKey,'content-control:pod:qa');
  // QA hash binding does not prove that the durable manifest is complete,
  // platform-matched or publication-disabled. Enforce the stored-package
  // contract before any database access on both pass and fail outcomes.
  const manifestSha256=admitDurableManifest(manifest,job.platform);
  const pass=(()=>{try{enforceQA(qa,manifest.package_sha256,manifest.template_sha256,job.platform);return true;}catch{return false;}})();
  return this.tx(async c=>{
   await lockProductionLease(c,job);
   if(pass){
    // Lock current rights through the readiness transition; a prior claim or
    // signed technical QA does not authorize a subsequently revoked concept.
    const current=productionRightsQuerySnapshot(await c.query(`SELECT p.rights_state,p.permanently_unpublished
     FROM pod_production_queue q JOIN pod_concepts p ON p.id=q.concept_id
     WHERE q.id=$1 AND q.fencing_token=$2 AND q.state='processing'
     FOR UPDATE OF q FOR SHARE OF p`,[job.id,job.fencing_token]));
    if(!current)throw Error('LEASE_LOST');
    if(current.rights_state!=='PASS'||current.permanently_unpublished)throw Error('RIGHTS_BLOCKED');
   }
   const currentQA=verifyEnvelope(qaEnvelope,this.qaKey,'content-control:pod:qa');
   if(pass)enforceQA(currentQA,manifest.package_sha256,manifest.template_sha256,job.platform);
   // This synchronous hook runs after every awaited lock/validation query and
   // before the first state-changing statement. A stop throws, rolls back the
   // transaction and leaves the fenced failure path free to settle the lease.
   beforeStateChange?.();
   const nextState=pass?'qa_passed':'qa_failed',nextReason=pass?null:'QA_FAILED';
   const r=await c.query(`UPDATE pod_production_queue SET state=$1,reason_code=CASE WHEN $1='qa_passed' THEN NULL ELSE 'QA_FAILED' END,manifest=$2,qa_envelope=$3,lease_until=NULL,updated_at=now()
    WHERE id=$4 AND fencing_token=$5 AND state='processing' AND lease_until>clock_timestamp() RETURNING id,state,reason_code`,
    [nextState,manifest,qaEnvelope,job.id,job.fencing_token]);
   assertExactMutation(r,{id:job.id,state:nextState,reason_code:nextReason});
   const eventId=crypto.randomUUID(),eventKind=`pod.production.${nextState}`;
   const event=await c.query('INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,$3,$4) RETURNING id,job_id,kind',
    [eventId,job.id,eventKind,
     {package_sha256:manifest.package_sha256,manifest_sha256:manifestSha256,
      fencing_token:job.fencing_token,publication_enabled:false}]);
   assertExactMutation(event,{id:eventId,job_id:job.id,kind:eventKind});
   verifyEnvelope(qaEnvelope,this.qaKey,'content-control:pod:qa');
   return {pass};
  });
 }
 async claimPublish(accountId,delaySeconds,{signal}={}){
  if(!Number.isInteger(delaySeconds)||delaySeconds<45||delaySeconds>180)throw Error('PUBLISH_DELAY_INVALID');
  return this.tx(async c=>{
  // A transaction rollback prevents an expired store from committing, but it
  // does not stop later queue/quota mutations from being issued. Recheck the
  // retention boundary after every awaited SQL statement.
  const query=async(sql,args)=>{const result=await c.query(sql,args);this.active();return result;};
  // Acquire the account lock first, then evaluate cooldown on the live clock.
  // A predicate in the locking SELECT can be evaluated before its lock wait.
  const locked=publishAccountLockQuerySnapshot(await query('SELECT id FROM pod_accounts WHERE id=$1 FOR UPDATE',[accountId]),accountId);
  if(!locked)return null;
  const a=publishAccountQuerySnapshot(await query("SELECT id,platform,daily_cap FROM pod_accounts WHERE id=$1 AND state='ACTIVE' AND next_allowed_at<=clock_timestamp()",[accountId]),accountId);
  if(!a)return null;
  const busy=queryPresenceSnapshot(await query("SELECT true AS present FROM pod_production_queue WHERE account_id=$1 AND state IN ('publishing','ambiguous') LIMIT 1",[accountId]));
  if(busy)return null;
  const count=nonnegativeCountQuerySnapshot(await query("SELECT count(*)::int AS n FROM pod_quota_reservations WHERE account_id=$1 AND reserved_at>clock_timestamp()-interval '24 hours'",[accountId]));
  if(count>=a.daily_cap)return null;
  // Bind the account lock to its configured marketplace before consuming quota
  // or moving a job into publishing. A later release check is not early enough:
  // a mismatched queued row must remain untouched and must not reserve capacity.
  const j=publishCandidateQuerySnapshot(await query(`SELECT q.id,q.account_id,q.platform,q.manifest,q.qa_envelope,
   (SELECT e.payload->>'manifest_sha256' FROM pod_events e WHERE e.job_id=q.id
    AND e.kind='pod.production.qa_passed' AND e.payload ? 'manifest_sha256'
    ORDER BY e.created_at DESC,e.id DESC LIMIT 1) AS manifest_sha256
   FROM pod_production_queue q JOIN pod_concepts p ON p.id=q.concept_id
   WHERE q.account_id=$1 AND q.platform=$2 AND q.state='qa_passed' AND q.next_attempt_at<=clock_timestamp()
   AND p.rights_state='PASS' AND NOT p.permanently_unpublished
   ORDER BY q.created_at FOR UPDATE OF q SKIP LOCKED LIMIT 1`,[accountId,a.platform]),accountId,a.platform);
  if(!j)return null;
  // A legacy, restored or corrupted readiness row must not consume account
  // quota/cooldown before the publisher discovers that its package is not the
  // exact durable QA-passed manifest. Validate provenance while the queue row
  // is locked and before the first release-side mutation.
  assertStoredManifest(j.manifest,j.platform,j.manifest_sha256);
  // Readiness state alone is not QA evidence. Missing, expired, malformed or
  // package-mismatched decisions must not consume marketplace quota/cooldown
  // before the publisher's final pre-submit evidence check rejects them.
  assertStoredQA(j.qa_envelope,this.qaKey,j.manifest,j.platform);
  if(a.platform==='kdp'){
   // KDP currently counts a title only on its first submission and resets its
   // per-format weekly allowance every Sunday at 00:00 UTC. This lane supports
   // paperback only. A retry/update of the same durable job therefore does not
   // consume another weekly title, while a third distinct job fails closed.
   const prior=queryPresenceSnapshot(await query(`SELECT true AS present FROM pod_quota_reservations r JOIN pod_production_queue q ON q.id=r.job_id
    WHERE r.account_id=$1 AND r.job_id=$2 AND (q.provider_id IS NOT NULL OR
     r.reserved_at>=((date_trunc('week',(clock_timestamp() AT TIME ZONE 'UTC')+interval '1 day')-interval '1 day') AT TIME ZONE 'UTC'))
    LIMIT 1`,[accountId,j.id]));
   if(!prior){
    const weekly=nonnegativeCountQuerySnapshot(await query(`SELECT count(DISTINCT r.job_id)::int AS n
     FROM pod_quota_reservations r JOIN pod_production_queue q ON q.id=r.job_id
     WHERE r.account_id=$1 AND q.platform='kdp'
     AND r.reserved_at>=((date_trunc('week',(clock_timestamp() AT TIME ZONE 'UTC')+interval '1 day')-interval '1 day') AT TIME ZONE 'UTC')`,[accountId]));
    if(weekly>=2)return null;
   }
  }
  const r=await query(`UPDATE pod_production_queue SET state='publishing',attempt=attempt+1,fencing_token=fencing_token+1,
   lease_until=clock_timestamp()+interval '5 minutes',updated_at=clock_timestamp() WHERE id=$1
   RETURNING id,platform,account_id,fencing_token::text AS fencing_token,brief,manifest,qa_envelope,idempotency_key,attempt,state`,[j.id]);
  const claimed=claimedPublishMutation(r);
  // Override the schema's transaction-time default: reservations must not age
  // while the claimant is waiting for the account lock.
  const reservation=await query(`INSERT INTO pod_quota_reservations(job_id,attempt,account_id,reserved_at)
   VALUES($1,$2,$3,clock_timestamp()) RETURNING job_id,attempt,account_id`,[j.id,claimed.attempt,accountId]);
  assertExactMutation(reservation,{job_id:j.id,attempt:claimed.attempt,account_id:accountId});
  const cooldown=await query(`UPDATE pod_accounts
   SET next_allowed_at=clock_timestamp()+($2::double precision*interval '1 second') WHERE id=$1 RETURNING id`,
   [accountId,delaySeconds]);
  assertExactMutation(cooldown,{id:accountId});
  return claimed;
 },{signal});}
 async assertPublishable(job){return this.tx(async c=>{
  const current=publishableQuerySnapshot(await c.query(`SELECT q.id,q.platform,q.manifest,q.qa_envelope,
   (SELECT e.payload->>'manifest_sha256' FROM pod_events e WHERE e.job_id=q.id
    AND e.kind='pod.production.qa_passed' AND e.payload ? 'manifest_sha256'
    ORDER BY e.created_at DESC,e.id DESC LIMIT 1) AS manifest_sha256
   FROM pod_production_queue q
   JOIN pod_concepts p ON p.id=q.concept_id JOIN pod_accounts a ON a.id=q.account_id AND a.platform=q.platform
   WHERE q.id=$1 AND q.fencing_token=$2 AND q.account_id=$3 AND q.platform=$4
   AND q.state='publishing' AND p.rights_state='PASS' AND NOT p.permanently_unpublished AND a.state='ACTIVE'
   FOR SHARE OF q,p,a`,[job.id,job.fencing_token,job.account_id,job.platform]),job);
  if(!current)throw Error('LOCAL_RELEASE_BLOCKED');
  // The claim transaction releases its locks before artifact/grant resolution.
  // Rebind the final local guard to the exact durable manifest and signed QA
  // snapshot that was claimed so a restored or altered publishing row cannot
  // submit stale in-memory evidence after those waits.
  assertCurrentReleaseSnapshot(current,job,this.qaKey);
  // Evaluate the live clock after row-lock waits, not transaction-start now().
  const lease=exactQueryRow(await c.query('SELECT lease_until>clock_timestamp() AS valid FROM pod_production_queue WHERE id=$1',[job.id]),['valid']);
  if(lease?.valid!==true)throw Error('LOCAL_RELEASE_BLOCKED');
  return true;
 });}
 async finish(job,state,receipt={},reason=null){
  if(!['blocked','ambiguous','submitted'].includes(state))throw Error('INVALID_FINISH');
  // Settlement is a narrow durable boundary, not a generic adapter log sink.
  // Persist only the opaque provider ID or the exact fixed failure outcome;
  // reject extra fields and arbitrary reason text before database access.
  assertSettlement(state,receipt,reason);
  const providerId=state==='submitted'?receipt.id:null;
  const eventPayload=state==='submitted'?{id:receipt.id}:{};
  return this.tx(async c=>{
   await lockPublishingLease(c,job);
   const r=await c.query(`UPDATE pod_production_queue SET state=$1,provider_id=$2,reason_code=$3,lease_until=NULL,updated_at=now()
    WHERE id=$4 AND fencing_token=$5 AND state='publishing' AND lease_until>clock_timestamp()
    RETURNING id,state,provider_id,reason_code`,[state,providerId,reason,job.id,job.fencing_token]);
   assertExactMutation(r,{id:job.id,state,provider_id:providerId,reason_code:reason});
   const eventId=crypto.randomUUID(),eventKind='pod.'+state;
   const event=await c.query('INSERT INTO pod_events(id,job_id,kind,payload) VALUES($1,$2,$3,$4) RETURNING id,job_id,kind',
    [eventId,job.id,eventKind,eventPayload]);
   assertExactMutation(event,{id:eventId,job_id:job.id,kind:eventKind});
  });
 }
 async recover({signal}={}){return this.tx(async c=>{
  // Relation/row-lock waits can outlive a lease. BEGIN's frozen now() must
  // not defer already-expired work to another sweep or misdate its transition.
  // Bound each sweep so RETURNING can prove every transition without allowing
  // an unbounded result to consume worker memory. Later cycles drain backlog.
  const publishing=await c.query(`WITH candidates AS (
   SELECT id FROM pod_production_queue WHERE state='publishing' AND lease_until<clock_timestamp()
   ORDER BY id FOR UPDATE SKIP LOCKED LIMIT ${RECOVERY_BATCH_LIMIT}
  ) UPDATE pod_production_queue q SET state='ambiguous',reason_code='LEASE_EXPIRED',updated_at=clock_timestamp()
   FROM candidates c WHERE q.id=c.id RETURNING q.id,q.state,q.reason_code`);
  const publishingIds=assertExactMutationBatch(publishing,
   {state:'ambiguous',reason_code:'LEASE_EXPIRED'},RECOVERY_BATCH_LIMIT);
  const processing=await c.query(`WITH candidates AS (
   SELECT id FROM pod_production_queue WHERE state='processing' AND lease_until<clock_timestamp()
   ORDER BY id FOR UPDATE SKIP LOCKED LIMIT ${RECOVERY_BATCH_LIMIT}
  ) UPDATE pod_production_queue q SET state='blocked',reason_code='PRODUCTION_LEASE_EXPIRED',updated_at=clock_timestamp()
   FROM candidates c WHERE q.id=c.id RETURNING q.id,q.state,q.reason_code`);
  const processingIds=assertExactMutationBatch(processing,
   {state:'blocked',reason_code:'PRODUCTION_LEASE_EXPIRED'},RECOVERY_BATCH_LIMIT);
  for(const id of processingIds)if(publishingIds.has(id))throw Error('POD_MUTATION_UNVERIFIED');
 },{signal});}
 async close(){await this.pool.end();}
}



