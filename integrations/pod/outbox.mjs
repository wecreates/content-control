import crypto from 'node:crypto';
import {types as utilTypes} from 'node:util';
import {assertBridgeRequest,fetchBridgeResponse,readBridgeJSON} from './http-response.mjs';
const MAX_EVENT_PAYLOAD_BYTES=262144;
const MAX_EVENT_REQUEST_BYTES=524288;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const EVENT_KIND=/^pod\.[a-z0-9]+(?:[._][a-z0-9]+)*$/;
const EVENT_FIELDS=['created_at','id','job_id','kind','payload'];
function assertEventJSON(value){
 const pending=[[value,0]];let nodes=0;
 while(pending.length){
  const [item,depth]=pending.pop(),type=typeof item;
  if(depth>64||++nodes>10000)throw Error('OUTBOX_EVENT_JSON_INVALID');
  if(item===null||type==='string'||type==='boolean')continue;
  if(type==='number'){
   if(!Number.isFinite(item)||Object.is(item,-0)||(Number.isInteger(item)&&!Number.isSafeInteger(item)))
    throw Error('OUTBOX_EVENT_JSON_INVALID');
   continue;
  }
  if(type!=='object'||utilTypes.isProxy(item))throw Error('OUTBOX_EVENT_JSON_INVALID');
  const prototype=Object.getPrototypeOf(item),keys=Reflect.ownKeys(item);
  if(Array.isArray(item)){
   const length=Object.getOwnPropertyDescriptor(item,'length');
   if(prototype!==Array.prototype||!Object.hasOwn(length||{},'value')||
    !Number.isInteger(length.value)||length.value<0||length.value>10000||keys.length!==length.value+1)
    throw Error('OUTBOX_EVENT_JSON_INVALID');
   for(let index=0;index<length.value;index++){
    const descriptor=Object.getOwnPropertyDescriptor(item,String(index));
    if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))throw Error('OUTBOX_EVENT_JSON_INVALID');
    pending.push([descriptor.value,depth+1]);
   }
   continue;
  }
  if(prototype!==Object.prototype||keys.length>10000||keys.some(key=>typeof key!=='string'))
   throw Error('OUTBOX_EVENT_JSON_INVALID');
  for(const key of keys){
   const descriptor=Object.getOwnPropertyDescriptor(item,key);
   if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))throw Error('OUTBOX_EVENT_JSON_INVALID');
   pending.push([descriptor.value,depth+1]);
  }
 }
}
function assertEventShape(event,issuedAt){
 if(event===null||typeof event!=='object'||Array.isArray(event)||utilTypes.isProxy(event)||Object.getPrototypeOf(event)!==Object.prototype)
  throw Error('OUTBOX_EVENT_SCOPE_INVALID');
 const keys=Reflect.ownKeys(event),descriptors=Object.getOwnPropertyDescriptors(event);
 if(keys.length!==EVENT_FIELDS.length||keys.some(key=>typeof key!=='string'||!EVENT_FIELDS.includes(key)||
  !descriptors[key].enumerable||!Object.hasOwn(descriptors[key],'value')))
  throw Error('OUTBOX_EVENT_SCOPE_INVALID');
 let createdAt=event.created_at;
 if(createdAt instanceof Date){
  const millis=createdAt.getTime();
  if(Object.getPrototypeOf(createdAt)!==Date.prototype||!Number.isSafeInteger(millis)||millis<0)
   throw Error('OUTBOX_EVENT_SCOPE_INVALID');
  createdAt=createdAt.toISOString();
 }
 if(typeof createdAt!=='string')throw Error('OUTBOX_EVENT_SCOPE_INVALID');
 const createdMillis=Date.parse(createdAt);
 if(typeof event.id!=='string'||event.id.length!==36||!UUID.test(event.id)||
  !(event.job_id===null||typeof event.job_id==='string'&&event.job_id.length===36&&UUID.test(event.job_id))||
  typeof event.kind!=='string'||event.kind.length<5||event.kind.length>128||!EVENT_KIND.test(event.kind)||
  event.payload===null||typeof event.payload!=='object'||Array.isArray(event.payload)||utilTypes.isProxy(event.payload)||
  Object.getPrototypeOf(event.payload)!==Object.prototype||
  !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(createdAt)||
  !Number.isSafeInteger(createdMillis)||createdMillis<0||new Date(createdMillis).toISOString()!==createdAt||createdMillis-issuedAt>300000)
  throw Error('OUTBOX_EVENT_SCOPE_INVALID');
 assertEventJSON(event.payload);
}
// Receiver must atomically deduplicate event IDs. Delivery is at least once.
export async function deliverOutbox(db,{url,key,fetchImpl=fetch,signal,continueOnError=false,cursor=null}){
 const endpoint=new URL(url);
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||typeof key!=='string'||Buffer.byteLength(key)<32)throw Error('OUTBOX_CONFIG_INVALID');
 db.active();
 // pg decodes timestamptz to a millisecond Date. Preserve the database's full
 // microsecond value separately or rejected rows can repeat forever on page 2.
 const events=(await db.pool.query('SELECT id,job_id,kind,payload,created_at,created_at::text AS cursor_created_at FROM pod_events WHERE delivered_at IS NULL AND ($1::timestamptz IS NULL OR (created_at,id)>($1::timestamptz,$2::uuid)) ORDER BY created_at,id LIMIT 20',[cursor?.created_at||null,cursor?.id||null])).rows;
 let delivered=0,failed=0;
 for(const {cursor_created_at:_cursorTimestamp,...event} of events){
  if(signal?.aborted)break;
  // Selection and earlier deliveries may cross the storage safety cutoff.
  // This is a batch-wide stop, not a skippable per-event delivery failure.
  db.active();
  try{
  const issuedAt=Date.now();
  if(!Number.isSafeInteger(issuedAt)||issuedAt<0)throw Error('OUTBOX_CLOCK_INVALID');
  // PostgreSQL rows always include payload. Keep transport-only fixtures that
  // intentionally omit it focused on their response boundary.
  if(Object.hasOwn(event,'payload'))assertEventShape(event,issuedAt);
  const payload=JSON.stringify({schema_version:1,audience:'money-factory:pod:event',issued_at_ms:issuedAt,event});
  if(Buffer.byteLength(payload)>MAX_EVENT_PAYLOAD_BYTES)throw Error('OUTBOX_EVENT_TOO_LARGE');
  const signature=crypto.createHmac('sha256',key).update(payload).digest('hex');
  const body=JSON.stringify({payload,signature});
  if(Buffer.byteLength(body)>MAX_EVENT_REQUEST_BYTES)throw Error('OUTBOX_EVENT_TOO_LARGE');
  const deadline=performance.now()+15000;
  const timeout=AbortSignal.timeout(15000);
  const requestSignal=signal?AbortSignal.any([signal,timeout]):timeout;
  const response=await fetchBridgeResponse(fetchImpl,endpoint,{method:'POST',redirect:'error',signal:requestSignal,headers:{'content-type':'application/json','idempotency-key':event.id},body},{deadline});
  const ack=await readBridgeJSON(response,{signal:requestSignal,deadline,maxBytes:4096,statusError:'OUTBOX_DELIVERY_FAILED',
   sizeError:'OUTBOX_ACK_TOO_LARGE',mediaTypeError:'OUTBOX_ACK_MEDIA_TYPE_INVALID'});
  if(ack===null||typeof ack!=='object'||Array.isArray(ack)||Object.getPrototypeOf(ack)!==Object.prototype||
   Object.keys(ack).length!==1||!Object.hasOwn(ack,'accepted_event_id')||ack.accepted_event_id!==event.id)throw Error('OUTBOX_ACK_INVALID');
  assertBridgeRequest(requestSignal,deadline);
  await db.tx(c=>c.query('UPDATE pod_events SET delivered_at=now() WHERE id=$1 AND delivered_at IS NULL',[event.id]));delivered++;
  }catch(error){if(signal?.aborted)break;if(!continueOnError)throw error;failed++;}
 }
 // Check empty pages and expiry during the final response/commit as well.
 if(!signal?.aborted)db.active();
 const last=events.at(-1);
 const nextCursor=events.length===20?{created_at:last.cursor_created_at,id:last.id}:null;
 return continueOnError?{delivered,failed,nextCursor}:{delivered};
}


