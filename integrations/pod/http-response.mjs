// All bridge responses have a byte limit, including chunked/decoded bodies.
// Release rejected responses as well as acquired readers; neither errors nor
// remote body text may replace the caller's stable failure codes.
export async function readBridgeJSON(response,{maxBytes,statusError,sizeError}){
 let reader;
 try{
  if(!response.ok)throw Error(statusError);
  if(Number(response.headers.get('content-length'))>maxBytes)throw Error(sizeError);
  if(!response.body)throw Error('BRIDGE_RESPONSE_BODY_REQUIRED');
  reader=response.body.getReader();
  const chunks=[];let size=0;
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;if(size>maxBytes)throw Error(sizeError);
   chunks.push(value);
  }
  // Decode once so UTF-8 split across network chunks is preserved. Reject
  // malformed byte sequences instead of silently substituting characters.
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
 }finally{
  if(reader){
   try{await reader.cancel();}catch{}
   reader.releaseLock();
  }else if(response.body&&!response.body.locked){
   try{await response.body.cancel();}catch{}
  }
 }
}
