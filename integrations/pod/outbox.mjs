import crypto from 'node:crypto';
// Receiver must atomically deduplicate event IDs. Delivery is at least once.
export async function deliverOutbox(db,{url,key,fetchImpl=fetch,signal,continueOnError=false,cursor=null}){
 const endpoint=new URL(url);
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||typeof key!=='string'||Buffer.byteLength(key)<32)throw Error('OUTBOX_CONFIG_INVALID');
 db.active();
 const events=(await db.pool.query('SELECT id,job_id,kind,payload,created_at FROM pod_events WHERE delivered_at IS NULL AND ($1::timestamptz IS NULL OR (created_at,id)>($1::timestamptz,$2::uuid)) ORDER BY created_at,id LIMIT 20',[cursor?.created_at||null,cursor?.id||null])).rows;
 let delivered=0,failed=0;
 for(const event of events){
  if(signal?.aborted)break;
  try{
  const payload=JSON.stringify({schema_version:1,audience:'money-factory:pod:event',issued_at_ms:Date.now(),event});
  const signature=crypto.createHmac('sha256',key).update(payload).digest('hex');
  const timeout=AbortSignal.timeout(15000);
  const response=await fetchImpl(endpoint,{method:'POST',redirect:'error',signal:signal?AbortSignal.any([signal,timeout]):timeout,headers:{'content-type':'application/json','idempotency-key':event.id},body:JSON.stringify({payload,signature})});
  if(!response.ok)throw Error('OUTBOX_DELIVERY_FAILED');
  const length=Number(response.headers.get('content-length'));
  if(length>4096)throw Error('OUTBOX_ACK_TOO_LARGE');
  const reader=response.body.getReader();let bytes=0,text='';
  try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>4096)throw Error('OUTBOX_ACK_TOO_LARGE');text+=Buffer.from(value).toString('utf8');}}finally{await reader.cancel();}
  const ack=JSON.parse(text);
  if(ack.accepted_event_id!==event.id)throw Error('OUTBOX_ACK_INVALID');
  await db.tx(c=>c.query('UPDATE pod_events SET delivered_at=now() WHERE id=$1 AND delivered_at IS NULL',[event.id]));delivered++;
  }catch(error){if(signal?.aborted)break;if(!continueOnError)throw error;failed++;}
 }
 const last=events.at(-1);
 const nextCursor=events.length===20?{created_at:last.created_at,id:last.id}:null;
 return continueOnError?{delivered,failed,nextCursor}:{delivered};
}

