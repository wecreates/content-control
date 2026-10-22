import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../server-lowmem.js',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('function fileIdentity('),source.indexOf('function episode2Acceptance('));
const gate=source.match(/function acceptance\(\)\{[\s\S]*?\n\}/)[0];
function fixture(t,kind,receiptHash){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'caption-identity-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const output=path.join(root,'candidate.mp4'),captionsPath=path.join(root,'captions.vtt');
 fs.writeFileSync(output,'synthetic candidate bytes; not AV acceptance');
 if(kind==='directory')fs.mkdirSync(captionsPath);
 else if(kind!=='absent')fs.writeFileSync(captionsPath,kind==='empty'?'':'WEBVTT\n\n00:00.000 --> 00:01.000\nSynthetic fixture\n');
 const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 const candidate=hash(output),healthPath=path.join(root,'health.json'),captionHealthPath=path.join(root,'caption-health.json');
 fs.writeFileSync(healthPath,JSON.stringify({status:'GREEN',candidate_sha256:candidate,publication_enabled:false}));
 fs.writeFileSync(captionHealthPath,JSON.stringify({status:'PASS',candidate_sha256:candidate,publication_enabled:false,caption_sha256:receiptHash==='matching'?hash(captionsPath):receiptHash}));
 return vm.runInNewContext(helpers+'\n'+gate+'\nacceptance()',{
 fs,path,crypto,Buffer,output,captionsPath,healthPath,captionHealthPath
 });
}
for(const kind of ['empty','directory','absent'])test(`reject ${kind} caption artifact with null receipt hash`,t=>{
 const result=fixture(t,kind,null);
 assert.equal(result.videoReady,true);
 assert.equal(result.captionReady,false);
 assert.equal(result.ready,false);
});
test('retain valid exact caption identity',t=>assert.equal(fixture(t,'valid','matching').ready,true));
for(const hash of [null,undefined,'', 'f'.repeat(64)])test(`reject unbound caption receipt ${String(hash)}`,t=>{
 assert.equal(fixture(t,'valid',hash).ready,false);
});
