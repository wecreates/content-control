import test from 'node:test';
import assert from 'node:assert/strict';
import {InMemoryUploadReceiptStore} from '../integrations/social-automation/youtube-upload-receipts.mjs';
test('receipt fixture isolates reads and writes from caller mutations',async()=>{
 const s=new InMemoryUploadReceiptStore();const receipt={state:'initialization_uncertain'};
 await s.put('k',receipt);receipt.state='changed';const read=await s.get('k');read.state='changed';
 assert.equal((await s.get('k')).state,'initialization_uncertain');
});
test('exclusive fixture releases after failure and preserves checkpoint',async()=>{
 const s=new InMemoryUploadReceiptStore();
 await assert.rejects(s.withExclusive('k',async()=>{await s.put('k',{state:'initialization_uncertain'});throw Error('crash');}));
 assert.equal(await s.withExclusive('k',async()=>(await s.get('k')).state),'initialization_uncertain');
});
