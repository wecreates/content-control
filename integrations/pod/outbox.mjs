import crypto from 'node:crypto';
// Receiver must atomically deduplicate event IDs. Delivery is at least once.
export async function deliverOutbox(db,{url,key,fetchImpl=fetch}){
 const endpoint=new URL(url);
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||typeof key!=='string'||Buffer.byteLength(key)<32)throw Error('OUTBOX_CONFIG_INVALID');
 db.active();
 const events=(await db.pool.query('SELECT id,job_id,kind,payload,created_at FROM pod_events WHERE delivered_at IS NULL ORDER BY created_at,id LIMIT 20')).rows;
 let delivered=0;
 for(const event of events){
  const payload=JSON.stringify({schema_version:1,audience:'money-factory:pod:event',issued_at_ms:Date.now(),event});
  const signature=crypto.createHmac('sha256',key).update(payload).digest('hex');
  const response=await fetchImpl(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'content-type':'application/json','idempotency-key':event.id},body:JSON.stringify({payload,signature})});
  if(!response.ok)throw Error('OUTBOX_DELIVERY_FAILED');
  const length=Number(response.headers.get('content-length'));
  if(length>4096)throw Error('OUTBOX_ACK_TOO_LARGE');
  const reader=response.body.getReader();let bytes=0,text='';
  try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>4096)throw Error('OUTBOX_ACK_TOO_LARGE');text+=Buffer.from(value).toString('utf8');}}finally{await reader.cancel();}
  const ack=JSON.parse(text);
  if(ack.accepted_event_id!==event.id)throw Error('OUTBOX_ACK_INVALID');
  await db.tx(c=>c.query('UPDATE pod_events SET delivered_at=now() WHERE id=$1 AND delivered_at IS NULL',[event.id]));delivered++;
 }
 return {delivered};
}
