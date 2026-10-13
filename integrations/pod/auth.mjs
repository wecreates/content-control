import crypto from 'node:crypto';
export function operationalAuth(key){
 return req=>{
  if(typeof key!=='string'||Buffer.byteLength(key)<32)return false;
  const header=req.headers.authorization;
  if(typeof header!=='string'||header.length>4096)return false;
  const actual=Buffer.from(header),expected=Buffer.from(`Bearer ${key}`);
  return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected);
 };
}
