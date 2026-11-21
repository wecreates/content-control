// Synthetic records through the actual production acceptance and health handlers.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../server-lowmem.js',import.meta.url),'utf8');
const acceptance=source.match(/function v2Acceptance\(\)\s*\{[\s\S]*?\n\}/)[0];
const handler=source.slice(source.indexOf('app.get("/v2/health"'),source.indexOf('app.get("/v2/media"'));
const sha='a'.repeat(64),other='b'.repeat(64);
function exercise({binding=true,actual=sha,structural=true,runtime='READY',runtimeSha=sha,recorded={}}={}){
 let route,body,status;
 const health={status:'READY',publication_enabled:false,candidate_sha256:sha,creative_qa:true,technical_qa:true,visual_parity_qa:true,...recorded};
 vm.runInNewContext(acceptance+'\n'+handler,{
  app:{get:(_path,fn)=>route=fn},v2Output:'synthetic.mp4',v2HealthPath:'health',
  path:{resolve:p=>p},fs:{existsSync:()=>false},
  readJson:p=>p==='health'?health:p==='state/v2-runtime-validation.json'?{status:runtime,candidate_sha256:runtimeSha}:null,
  hostedComparisonGate:()=>({ready:binding,candidate_sha256:actual,reasons:binding?[]:['synthetic_binding_failure']}),
  creativeHandoff:()=>({ready:structural,reasons:structural?[]:['synthetic_review_missing']})
 });
 const res={setHeader(){},status(n){status=n;return this;},json(value){body=JSON.parse(JSON.stringify(value));}};
 route({},res);return {body,status};
}
for(const [name,options] of [
 ['absent media despite recorded passes',{binding:false,actual:null}],
 ['unverified bound receipt',{binding:false}],
 ['current media differs from recorded candidate',{actual:other}],
 ['full creative review incomplete',{structural:false}],
 ['runtime validation blocked',{runtime:'BLOCKED'}],
 ['runtime receipt belongs to another candidate',{runtimeSha:other}],
 ['publication lock not retained',{recorded:{publication_enabled:true}}],
])test(name+' never exposes a verified QA pass',()=>{
 const {body,status}=exercise(options);assert.equal(status,503);assert.equal(body.ok,false);
 for(const key of ['creativeQa','technicalQa','visualParityQa']){assert.equal(body[key],false);assert.equal(body.recordedQa[key],true);}
 assert.equal(body.recordedQa.candidateSha256,sha);assert.equal(body.watchUrl,null);assert.equal(body.publication,false);
 assert.match(body.qaScope,/recorded flags alone are not verification/);
});
test('complete current candidate retains effective QA and playable gate',()=>{
 const {body,status}=exercise();assert.equal(status,200);assert.equal(body.ok,true);
 for(const key of ['creativeQa','technicalQa','visualParityQa'])assert.equal(body[key],true);
 assert.equal(body.watchUrl,'/v2/watch');assert.equal(body.publication,false);
});
test('recorded failed and missing fields remain visible as false without inflation',()=>{
 const {body,status}=exercise({recorded:{creative_qa:false,technical_qa:undefined,visual_parity_qa:false}});
 assert.equal(status,503);for(const key of ['creativeQa','technicalQa','visualParityQa']){assert.equal(body[key],false);assert.equal(body.recordedQa[key],false);}
});
