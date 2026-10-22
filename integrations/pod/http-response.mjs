// Retain admission until the underlying fetch settles, even after its caller
// aborts. A broken/custom transport must not accumulate unlimited header waits.
import {parseSignedJSON} from './signed-json.mjs';

const pendingRequests=new WeakMap();
const MAX_PENDING_REQUESTS=32;
function cancelBody(response){
 try{if(response?.body&&!response.body.locked)Promise.resolve(response.body.cancel()).catch(()=>{});}catch{}
}

// Timers interrupt stalled I/O; elapsed-time checks reject late completion even
// when the event loop has not dispatched a timeout callback yet.
export function assertBridgeRequest(signal,deadline){
 signal?.throwIfAborted();
 if(deadline!==undefined){
  const now=performance.now();
  if(!Number.isFinite(deadline)||!Number.isFinite(now)||now>=deadline)
   throw new DOMException('Bridge request timed out','TimeoutError');
 }
}

export async function fetchBridgeResponse(fetchImpl,url,options,{deadline}={}){
 const {signal}=options;
 assertBridgeRequest(signal,deadline);
 const count=pendingRequests.get(fetchImpl)||0;
 if(count>=MAX_PENDING_REQUESTS)throw Error('BRIDGE_REQUEST_BUSY');
 pendingRequests.set(fetchImpl,count+1);
 let onAbort;
 try{
  const aborted=signal&&new Promise((_,reject)=>{
   onAbort=()=>reject(signal.reason);
   signal.addEventListener('abort',onAbort,{once:true});
  });
  const pending=Promise.resolve().then(()=>{
   assertBridgeRequest(signal,deadline);
   return fetchImpl(url,options);
  }).then(response=>{
   try{assertBridgeRequest(signal,deadline);}catch(error){cancelBody(response);throw error;}
   return response;
  }).finally(()=>{
   const remaining=pendingRequests.get(fetchImpl)-1;
   if(remaining)pendingRequests.set(fetchImpl,remaining);else pendingRequests.delete(fetchImpl);
  });
  // Promise.race also consumes a late rejection after cancellation has won.
  return await (aborted?Promise.race([pending,aborted]):pending);
 }finally{
  if(onAbort)signal.removeEventListener('abort',onAbort);
 }
}

// All bridge responses have a byte limit, including chunked/decoded bodies.
// Body reads share the request deadline even if a transport does not propagate
// aborts. Best-effort cancellation must not delay a result or replace its error.
export async function readBridgeJSON(response,{maxBytes,statusError,sizeError,signal,deadline}){
 let reader,onAbort;
 try{
  assertBridgeRequest(signal,deadline);
  if(!response.ok)throw Error(statusError);
  if(Number(response.headers.get('content-length'))>maxBytes)throw Error(sizeError);
  if(!response.body)throw Error('BRIDGE_RESPONSE_BODY_REQUIRED');
  reader=response.body.getReader();
  const aborted=signal&&new Promise((_,reject)=>{
   onAbort=()=>reject(signal.reason);
   signal.addEventListener('abort',onAbort,{once:true});
  });
  const chunks=[];let size=0;
  while(true){
   assertBridgeRequest(signal,deadline);
   const pending=reader.read();
   const {done,value}=await (aborted?Promise.race([pending,aborted]):pending);
   assertBridgeRequest(signal,deadline);
   if(done)break;
   size+=value.byteLength;if(size>maxBytes)throw Error(sizeError);
   chunks.push(value);
  }
  assertBridgeRequest(signal,deadline);
  // Decode once so UTF-8 split across network chunks is preserved. Reject
  // malformed byte sequences instead of silently substituting characters.
  const result=parseSignedJSON(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.concat(chunks)));
  assertBridgeRequest(signal,deadline);
  return result;
 }finally{
  if(onAbort)signal.removeEventListener('abort',onAbort);
  // A remote/custom stream may never settle cancel(). Invoke it and consume
  // rejection, but release the reader without awaiting transport cleanup.
  if(reader){
   try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}
   reader.releaseLock();
  }else if(response.body&&!response.body.locked){
   try{Promise.resolve(response.body.cancel()).catch(()=>{});}catch{}
  }
 }
}
