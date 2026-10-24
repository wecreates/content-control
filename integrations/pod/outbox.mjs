import crypto from 'node:crypto';
import {assertBridgeRequest,fetchBridgeResponse,readBridgeJSON} from './http-response.mjs';
const MAX_EVENT_PAYLOAD_BYTES=262144;
const MAX_EVENT_REQUEST_BYTES=524288;
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
  const payload=JSON.stringify({schema_version:1,audience:'money-factory:pod:event',issued_at_ms:Date.now(),event});
  if(Buffer.byteLength(payload)>MAX_EVENT_PAYLOAD_BYTES)throw Error('OUTBOX_EVENT_TOO_LARGE');
  const signature=crypto.createHmac('sha256',key).update(payload).digest('hex');
  const body=JSON.stringify({payload,signature});
  if(Buffer.byteLength(body)>MAX_EVENT_REQUEST_BYTES)throw Error('OUTBOX_EVENT_TOO_LARGE');
  const deadline=performance.now()+15000;
  const timeout=AbortSignal.timeout(15000);
  const requestSignal=signal?AbortSignal.any([signal,timeout]):timeout;
  const response=await fetchBridgeResponse(fetchImpl,endpoint,{method:'POST',redirect:'error',signal:requestSignal,headers:{'content-type':'application/json','idempotency-key':event.id},body},{deadline});
  const ack=await readBridgeJSON(response,{signal:requestSignal,deadline,maxBytes:4096,statusError:'OUTBOX_DELIVERY_FAILED',sizeError:'OUTBOX_ACK_TOO_LARGE'});
  if(ack.accepted_event_id!==event.id)throw Error('OUTBOX_ACK_INVALID');
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


