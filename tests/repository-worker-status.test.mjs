import test from 'node:test';
import assert from 'node:assert/strict';
import {createHostedWorkerStatus} from '../repository-worker-status.js';

const operations={'wan21':[], 'youtube-clipper-skill':['clip','captions'],
  openshorts:['vertical','transcript-windows'],'claude-seo':['parse-html'],
  'toonflow-app':['import-brief'],ruflo:['remember-project'],'youtube-automation-agent':['audit']};
function fixture() {
  const registry={schema_version:1,repositories:Object.keys(operations).map((id,i)=>({id,order:i+1,revision:'a'.repeat(40)}))};
  const run={id:123,status:'completed',conclusion:'success',head_sha:'b'.repeat(40),run_attempt:1,
    head_branch:'main',path:'.github/workflows/repository-integrations.yml'};
  const report={schema_version:1,status:'PASS',production_ready:false,publication_enabled:false,paid_generation_enabled:false,
    verified_at:new Date().toISOString(),workflow_run_id:'123',workflow_run_attempt:'1',
    money_factory_revision:run.head_sha,content_control_revision:'c'.repeat(40),negative_checks:3,
    receipts:Object.entries(operations).flatMap(([tool,ops])=>ops.map(operation=>({tool,operation,
      status:'PASS',revision:'a'.repeat(40),publication_enabled:false,output_sha256:'d'.repeat(64)})))};
  return {registry,run,report};
}
function reader(data, extras={}) {
  return createHostedWorkerStatus({cacheMs:0,fetchImpl:async url=>{
    if(data.offline)throw Error('private diagnostic that must not leak');
    const body=url.includes('/actions/')?{workflow_runs:[data.run]}:
      url.endsWith('/repositories.json')?data.registry:data.report;
    return {ok:body!==null,status:body===null?404:200,json:async()=>body};
  },...extras});
}
test('verified hosted operations stay scoped and Wan remains blocked',async()=>{
  const result=await reader(fixture())();
  assert.equal(result.status,'HOSTED_CPU_OPERATIONS_VERIFIED');
  assert.equal(result.production_ready,false);
  assert.equal(result.persistent_worker_configured,false);
  assert.equal(result.repositories[0].runtime_status,'BLOCKED_CUDA_AND_MODEL_REQUIRED');
  assert.equal(result.repositories.flatMap(e=>e.verified_operations).length,8);
});
test('latest failure or running job supersedes older passing receipts',async()=>{
  const data=fixture();data.run.conclusion='failure';
  assert.equal((await reader(data)()).status,'HOSTED_CPU_VERIFICATION_FAILED');
  data.run.status='in_progress';
  assert.equal((await reader(data)()).status,'HOSTED_CPU_VERIFICATION_RUNNING');
});
test('missing, stale, malformed or mismatched evidence never passes',async()=>{
  for(const mutate of [d=>{d.report=null},d=>{d.report.verified_at='2020-01-01'},
    d=>{d.report.money_factory_revision='e'.repeat(40)},d=>{d.report.receipts.pop()},
    d=>{d.report.receipts[0].revision='e'.repeat(40)},d=>{d.report.publication_enabled=true},
    d=>{d.report.workflow_run_attempt='2'},d=>{d.report.receipts[0].output_sha256='invalid'}]) {
    const data=fixture();mutate(data);
    const result=await reader(data)();
    assert.notEqual(result.status,'HOSTED_CPU_OPERATIONS_VERIFIED');
    assert.equal(result.production_ready,false);
  }
});
test('outage fails closed without leaking internal errors',async()=>{
  const data=fixture();data.offline=true;
  const result=await reader(data)();
  assert.equal(result.status,'HOSTED_EVIDENCE_UNAVAILABLE');
  assert.ok(!JSON.stringify(result).includes('private diagnostic'));
});
test('concurrent readers share a cached upstream request',async()=>{
  const data=fixture();let calls=0;
  const read=reader(data,{cacheMs:60000,now:()=>Date.parse(data.report.verified_at),fetchImpl:async url=>{
    calls++;return {ok:true,status:200,json:async()=>url.includes('/actions/')?{workflow_runs:[data.run]}:
      url.endsWith('/repositories.json')?data.registry:data.report};
  }});
  await Promise.all([read(),read(),read()]);await read();assert.equal(calls,3);
});
