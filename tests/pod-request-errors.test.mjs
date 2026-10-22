import test from 'node:test';
import assert from 'node:assert/strict';
import {podRequestError} from '../integrations/pod/request-errors.mjs';

test('parser errors expose only fixed status and code, never body or stack',()=>{
 for(const [type,status,code] of [
  ['entity.too.large',413,'POD_REQUEST_TOO_LARGE'],
  ['encoding.unsupported',415,'POD_REQUEST_ENCODING_UNSUPPORTED'],
  ['charset.unsupported',415,'POD_REQUEST_ENCODING_UNSUPPORTED'],
  ['entity.parse.failed',400,'POD_REQUEST_INVALID'],
  ['entity.verify.failed',400,'POD_REQUEST_INVALID'],
  ['request.aborted',400,'POD_REQUEST_INVALID'],
  ['request.size.invalid',400,'POD_REQUEST_INVALID'],
  ['constructor',500,'POD_REQUEST_FAILED'],
  ['unexpected',500,'POD_REQUEST_FAILED']
 ]){
  let actualStatus,body;
  const res={status(n){actualStatus=n;return this;},json(value){body=value;}};
  podRequestError({type,status:200,message:'private-message',stack:'private-stack',body:'private-body'}, {},res,()=>assert.fail('escaped router'));
  assert.equal(actualStatus,status);assert.deepEqual(body,{error:code});
 }
});
test('already-started responses delegate without attempting a second response',()=>{
 const error=Error('fixture');let forwarded;
 podRequestError(error,{}, {headersSent:true,status(){assert.fail('second response');}},e=>{forwarded=e;});
 assert.equal(forwarded,error);
});
