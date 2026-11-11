// Retain admission until the underlying fetch settles, even after its caller
// aborts. A broken/custom transport must not accumulate unlimited header waits.
import {parseSignedJSON} from './signed-json.mjs';
import {types as utilTypes} from 'node:util';

const nativeAborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get;
const nativeReason=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'reason').get;
const nativeThrowIfAborted=AbortSignal.prototype.throwIfAborted;
const addAbortListener=EventTarget.prototype.addEventListener;
const removeAbortListener=EventTarget.prototype.removeEventListener;
const signalAborted=signal=>Reflect.apply(nativeAborted,signal,[]);

const pendingRequests=new WeakMap();
const MAX_PENDING_REQUESTS=32;
function cancelBody(response){
 try{if(response?.body&&!response.body.locked)Promise.resolve(response.body.cancel()).catch(()=>{});}catch{}
}
function abortReason(signal){
 try{
  const reason=Reflect.apply(nativeReason,signal,[]);
  return reason===undefined?new DOMException('Bridge request aborted','AbortError'):reason;
 }catch{return new DOMException('Bridge request aborted','AbortError');}
}

// Timers interrupt stalled I/O; elapsed-time checks reject late completion even
// when the event loop has not dispatched a timeout callback yet.
export function assertBridgeRequest(signal,deadline){
 if(signal!==undefined&&signal!==null){
  if(utilTypes.isProxy(signal))throw new TypeError('BRIDGE_SIGNAL_INVALID');
  Reflect.apply(nativeThrowIfAborted,signal,[]);
 }
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
 let onAbort;
 try{
  let aborted,abortObserved=false;
  if(signal){
   let rejectAbort;
   aborted=new Promise((_,reject)=>{rejectAbort=reject;});
   // Synthetic events are not cancellation. Keep listening so they cannot
   // consume the real abort; dependency-owned public members are not trusted.
   onAbort=()=>{if(signalAborted(signal)){abortObserved=true;rejectAbort(abortReason(signal));}};
   Reflect.apply(addAbortListener,signal,['abort',onAbort]);
   if(signalAborted(signal))onAbort();
   if(abortObserved)return await aborted;
  }
  // Do not consume admission or start the transport unless cancellation
  // control was established successfully.
  pendingRequests.set(fetchImpl,count+1);
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
  try{if(onAbort)Reflect.apply(removeAbortListener,signal,['abort',onAbort]);}catch{}
 }
}

// All bridge responses have a byte limit, including chunked/decoded bodies.
// Body reads share the request deadline even if a transport does not propagate
// aborts. Best-effort cancellation must not delay a result or replace its error.
export async function readBridgeJSON(response,{maxBytes,statusError,sizeError,mediaTypeError,signal,deadline}){
 let reader,onAbort,abortObserved=false;
 try{
  assertBridgeRequest(signal,deadline);
  if(!response.ok)throw Error(statusError);
  if(mediaTypeError){
   const mediaType=response.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase();
   if(mediaType!=='application/json')throw Error(mediaTypeError);
  }
  if(Number(response.headers.get('content-length'))>maxBytes)throw Error(sizeError);
  if(!response.body)throw Error('BRIDGE_RESPONSE_BODY_REQUIRED');
  reader=response.body.getReader();
  let aborted;
  if(signal){
   let rejectAbort;
   aborted=new Promise((_,reject)=>{rejectAbort=reject;});
   onAbort=()=>{if(signalAborted(signal)){abortObserved=true;rejectAbort(abortReason(signal));}};
   try{Reflect.apply(addAbortListener,signal,['abort',onAbort]);if(signalAborted(signal))onAbort();}
   catch(error){if(!abortObserved)throw error;}
   if(abortObserved)return await aborted;
  }
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
  try{if(onAbort)Reflect.apply(removeAbortListener,signal,['abort',onAbort]);}catch{}
  // A remote/custom stream may never settle cancel(). Invoke it and consume
  // rejection, but release the reader without awaiting transport cleanup.
  if(reader){
   try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}
   try{reader.releaseLock();}catch{}
  }else{
   try{
    const body=response?.body;
    if(body&&!body.locked)Promise.resolve(body.cancel()).catch(()=>{});
   }catch{}
  }
 }
}
