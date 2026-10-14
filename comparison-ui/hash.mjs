// Local SHA-256 only. No file bytes leave the device.
export async function fileIdentity(file, cryptoApi=globalThis.crypto){
 if(!cryptoApi?.subtle)throw Error('File verification requires HTTPS in a supported browser.');
 const bytes=await file.arrayBuffer();
 const hash=await cryptoApi.subtle.digest('SHA-256',bytes);
 return {sha256:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join(''),byte_length:file.size,identity_verified:true};
}
