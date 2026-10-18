// All bridge responses have a byte limit, including chunked/decoded bodies.
// Body reads share the request deadline even if a transport does not propagate
// aborts. Best-effort cancellation must not delay a result or replace its error.
export async function readBridgeJSON(response,{maxBytes,statusError,sizeError,signal}){
 let reader,onAbort;
 try{
  signal?.throwIfAborted();
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
   signal?.throwIfAborted();
   const pending=reader.read();
   const {done,value}=await (aborted?Promise.race([pending,aborted]):pending);
   if(done)break;
   size+=value.byteLength;if(size>maxBytes)throw Error(sizeError);
   chunks.push(value);
  }
  signal?.throwIfAborted();
  // Decode once so UTF-8 split across network chunks is preserved. Reject
  // malformed byte sequences instead of silently substituting characters.
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
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
