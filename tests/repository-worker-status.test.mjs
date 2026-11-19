import test from 'node:test';
import assert from 'node:assert/strict';
const additionalOperations={
  rea:['analyze-javascript-application','mcp-smoke','inspect-artifact','capture-owned-process','inspect-local-web-page'],
  voicestudio:['synthesize'],
  'youtube-agent-skill':['hook-score','package-lint','edit-plan','chapters','retention','outliers'],
};
const additionalWorkflows={rea:'rea-offline-analysis.yml',voicestudio:'voicestudio-integration.yml','youtube-agent-skill':'youtube-skill-integration.yml'};
const additionalReports={rea:'rea/hosted-verification.json',voicestudio:'voicestudio/hosted-verification.json','youtube-agent-skill':'youtube_skill/hosted-verification.json'};
function aggregateFixture() {
  const data=fixture();
  data.registry.engineering_tools=[{id:'rea',revision:'a'.repeat(40)}];
  data.registry.media_tools=[{id:'voicestudio',revision:'a'.repeat(40)}];
  data.registry.agent_tools=[{id:'youtube-agent-skill',revision:'a'.repeat(40)}];
  data.additional=Object.fromEntries(Object.entries(additionalOperations).map(([id,ops],i)=>{
    const run={...data.run,id:124+i,path:'.github/workflows/'+additionalWorkflows[id]};
    const report={schema_version:1,status:'PASS',production_ready:false,publication_enabled:false,paid_generation_enabled:false,
      verified_at:data.report.verified_at,workflow_run_id:String(run.id),workflow_run_attempt:'1',source_revision:run.head_sha,
      checks:ops.map(operation=>({receipt:{tool:id,operation,status:'PASS',revision:'a'.repeat(40),
        publication_enabled:false,output_sha256:'d'.repeat(64)}}))};
    return [id,{run,report}];
  }));
  return data;
}
function aggregateReader(data) {
  return reader(data,{fetchImpl:async url=>{
    let body;
    const id=Object.keys(additionalOperations).find(id=>url.includes(additionalWorkflows[id])||url.endsWith(additionalReports[id]));
    if(id)body=url.includes('/actions/')?{workflow_runs:data.additional[id].run?[data.additional[id].run]:[]}:data.additional[id].report;
    else body=url.includes('/git/ref/')?{object:{sha:'f'.repeat(40),type:'commit'}}:url.includes('/actions/')?{workflow_runs:[data.run]}:
      url.endsWith('/repositories.json')?data.registry:data.report;
    return {ok:body!==null,status:body===null?404:200,json:async()=>body};
  }});
}
test('aggregate counts all 20 required operations independently of original eight',async()=>{
  const result=await aggregateReader(aggregateFixture())();
  assert.equal(result.status,'HOSTED_CPU_OPERATIONS_VERIFIED');
  assert.equal(result.aggregate_status,'HOSTED_REQUIRED_OPERATIONS_VERIFIED');
  assert.equal(result.expected_operation_count,20);
  assert.equal(result.verified_operation_count,20);
  assert.equal(result.production_ready,false);
  assert.equal(result.publication_enabled,false);
  assert.equal(result.paid_generation_enabled,false);
});
test('each additional tool fails aggregate closed for missing, failed, running, stale or invalid evidence',async()=>{
  for(const id of Object.keys(additionalOperations))for(const mutate of [
    e=>{e.report=null},e=>{e.run=null},e=>{e.run.conclusion='failure'},e=>{e.run.status='in_progress'},
    e=>{e.report.verified_at='2020-01-01'},e=>{e.report.checks.pop()},
    e=>{e.report.workflow_run_attempt='2'},e=>{e.report.publication_enabled=true},
  ]) {
    const data=aggregateFixture();mutate(data.additional[id]);
    const result=await aggregateReader(data)();
    assert.equal(result.status,'HOSTED_CPU_OPERATIONS_VERIFIED');
    assert.equal(result.aggregate_status,'HOSTED_REQUIRED_OPERATIONS_NOT_VERIFIED',id);
    assert.equal(result.expected_operation_count,20);
    assert.equal(result.verified_operation_count,20-additionalOperations[id].length);
  }
});
test('original failure cannot be masked by additional passes',async()=>{
  const data=aggregateFixture();data.run.conclusion='failure';
  const result=await aggregateReader(data)();
  assert.equal(result.aggregate_status,'HOSTED_REQUIRED_OPERATIONS_NOT_VERIFIED');
  assert.equal(result.verified_operation_count,12);
  assert.equal(result.expected_operation_count,20);
});
test('duplicate configured tools cannot inflate aggregate coverage',async()=>{
  const data=aggregateFixture();data.registry.agent_tools.push({...data.registry.media_tools[0]});
  const result=await aggregateReader(data)();
  assert.equal(result.status,'HOSTED_CPU_OPERATIONS_VERIFIED');
  assert.equal(result.aggregate_status,'HOSTED_REQUIRED_OPERATIONS_NOT_VERIFIED');
  assert.equal(result.expected_operation_count,null);
  assert.equal(result.verified_operation_count,20);
});
for(const [reason,mutate] of [
  ['missing original receipt',data=>data.report.receipts.pop()],
  ['mismatched original attempt',data=>{data.report.workflow_run_attempt='2'}],
  ['invalid late original receipt',data=>{data.report.receipts.at(-1).output_sha256='invalid'}],
])test(`independent additional evidence survives ${reason}`,async()=>{
  const data=aggregateFixture();mutate(data);
  const result=await aggregateReader(data)();
  assert.equal(result.status,'HOSTED_EVIDENCE_UNAVAILABLE');
  assert.equal(result.aggregate_status,'HOSTED_REQUIRED_OPERATIONS_NOT_VERIFIED');
  assert.equal(result.expected_operation_count,20);
  assert.equal(result.verified_operation_count,12);
  assert.equal(result.additional_tools.length,3);
  assert.ok(result.additional_tools.every(entry=>entry.runtime_status==='HOSTED_OPERATIONS_VERIFIED'));
  assert.equal(result.repositories,undefined);
  assert.equal(result.evidence_snapshot_revision,'f'.repeat(40));
  assert.equal(result.production_ready,false);
  assert.equal(result.publication_enabled,false);
  assert.equal(result.paid_generation_enabled,false);
});
test('unknown required tools and unavailable registry never claim complete coverage',async()=>{
  const data=aggregateFixture();data.registry.agent_tools.push({id:'unknown',revision:'a'.repeat(40)});
  const result=await aggregateReader(data)();
  assert.equal(result.aggregate_status,'HOSTED_REQUIRED_OPERATIONS_NOT_VERIFIED');
  assert.equal(result.expected_operation_count,null);
  const unavailable=fixture();unavailable.offline=true;
  const failed=await reader(unavailable)();
  assert.equal(failed.aggregate_status,'HOSTED_REQUIRED_OPERATIONS_NOT_VERIFIED');
  assert.equal(failed.expected_operation_count,null);
  assert.equal(failed.verified_operation_count,0);
});
test('explicitly optional additional tools do not block required coverage',async()=>{
  const data=aggregateFixture();data.registry.media_tools[0].required_for_production=false;data.additional.voicestudio.report=null;
  const result=await aggregateReader(data)();
  assert.equal(result.aggregate_status,'HOSTED_REQUIRED_OPERATIONS_VERIFIED');
  assert.equal(result.expected_operation_count,19);
  assert.equal(result.verified_operation_count,19);
  assert.equal(result.additional_tools.find(e=>e.id==='voicestudio').runtime_status,'HOSTED_EXECUTION_NOT_VERIFIED');
});
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
    const body=url.includes('/git/ref/')?{object:{sha:'f'.repeat(40),type:'commit'}}:url.includes('/actions/')?{workflow_runs:[data.run]}:
      url.endsWith('/repositories.json')?data.registry:data.report;
    return {ok:body!==null,status:body===null?404:200,json:async()=>body};
  },...extras});
}
test('verified hosted operations stay scoped and Wan remains blocked',async()=>{
  const result=await reader(fixture())();
  assert.equal(result.aggregate_status,'HOSTED_REQUIRED_OPERATIONS_VERIFIED');
  assert.equal(result.expected_operation_count,8);
  assert.equal(result.verified_operation_count,8);
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
  assert.equal(result.evidence_error_code,'UPSTREAM_NETWORK_FAILURE');
  assert.ok(!JSON.stringify(result).includes('private diagnostic'));
});

test('upstream failures expose only fixed diagnostic codes while preserving readiness gates',async()=>{
  for(const [expected,fetchImpl] of [
    ['UPSTREAM_RATE_LIMITED',async()=>({ok:false,status:429})],
    ['UPSTREAM_RATE_LIMITED',async()=>({ok:false,status:403,headers:new Headers({'x-ratelimit-remaining':'0'})})],
    ['UPSTREAM_RATE_LIMITED',async()=>({ok:false,status:403,headers:new Headers({'retry-after':'60'})})],
    ['UPSTREAM_UNAVAILABLE',async()=>({ok:false,status:503})],
    ['UPSTREAM_REQUEST_REJECTED',async()=>({ok:false,status:403})],
    ['UPSTREAM_TIMEOUT',async()=>{throw Object.assign(new Error('private timeout URL'),{name:'TimeoutError'})}],
    ['UPSTREAM_TIMEOUT',async()=>({ok:true,json:async()=>{throw Object.assign(new Error('private body URL'),{name:'AbortError'})}})],
    ['INVALID_UPSTREAM_JSON',async()=>({ok:true,json:async()=>{throw new SyntaxError('private body token')}})],
    ['UPSTREAM_NETWORK_FAILURE',async()=>({ok:true,json:async()=>{throw new TypeError('private interrupted body URL')}})],
  ]) {
    const result=await createHostedWorkerStatus({fetchImpl})();
    assert.equal(result.status,'HOSTED_EVIDENCE_UNAVAILABLE');
    assert.equal(result.evidence_error_code,expected);
    assert.equal(result.aggregate_status,'HOSTED_REQUIRED_OPERATIONS_NOT_VERIFIED');
    assert.equal(result.production_ready,false);
    assert.equal(result.publication_enabled,false);
    assert.equal(result.paid_generation_enabled,false);
    assert.ok(!JSON.stringify(result).includes('private'));
  }
});

test('receipt validation diagnostics preserve independently verified additional operations',async()=>{
  const data=aggregateFixture();data.report.receipts.at(-1).output_sha256='private invalid hash';
  const result=await aggregateReader(data)();
  assert.equal(result.evidence_error_code,'INVALID_RECEIPT');
  assert.equal(result.verified_operation_count,12);
  assert.equal(result.aggregate_status,'HOSTED_REQUIRED_OPERATIONS_NOT_VERIFIED');
  assert.ok(!JSON.stringify(result).includes('private'));
});
test('concurrent readers share a cached upstream request',async()=>{
  const data=fixture();let calls=0;
  const read=reader(data,{cacheMs:60000,now:()=>Date.parse(data.report.verified_at),fetchImpl:async url=>{
    calls++;return {ok:true,status:200,json:async()=>url.includes('/git/ref/')?{object:{sha:'f'.repeat(40),type:'commit'}}:url.includes('/actions/')?{workflow_runs:[data.run]}:
      url.endsWith('/repositories.json')?data.registry:data.report};
  }});
  await Promise.all([read(),read(),read()]);await read();assert.equal(calls,4);
});

test('optional Wan is skipped without granting production approval',async()=>{
  const data=fixture();data.registry.repositories[0].required_for_production=false;
  const result=await reader(data)();
  assert.equal(result.expected_operation_count,8);
  assert.equal(result.verified_operation_count,8);
  assert.equal(result.repositories[0].runtime_status,'OPTIONAL_DISABLED');
  assert.equal(result.repositories[0].required_for_production,false);
  assert.equal(result.production_ready,false);
  assert.equal(result.publication_enabled,false);
  assert.equal(result.repositories.flatMap(e=>e.verified_operations).length,8);
});

test('all evidence files use one immutable main snapshot, never mutable raw main',async()=>{
  const data=fixture();data.registry.media_tools=[{id:'voicestudio',revision:'a'.repeat(40)}];
  const urls=[];
  const read=reader(data,{fetchImpl:async url=>{
    urls.push(url);
    const body=url.includes('/git/ref/')?{object:{sha:'f'.repeat(40),type:'commit'}}:
      url.includes('/actions/')?{workflow_runs:[data.run]}:
      url.endsWith('/repositories.json')?data.registry:data.report;
    return {ok:true,status:200,json:async()=>body};
  }});
  const result=await read();
  assert.equal(result.status,'HOSTED_CPU_OPERATIONS_VERIFIED');
  assert.equal(result.evidence_snapshot_revision,'f'.repeat(40));
  assert.equal(result.additional_tools[0].runtime_status,'HOSTED_EVIDENCE_UNAVAILABLE');
  assert.equal(result.aggregate_status,'HOSTED_REQUIRED_OPERATIONS_NOT_VERIFIED');
  assert.equal(result.expected_operation_count,9);
  assert.equal(result.verified_operation_count,8);
  const rawUrls=urls.filter(url=>url.includes('raw.githubusercontent.com'));
  assert.equal(rawUrls.length,3);
  assert.ok(rawUrls.every(url=>url.includes('/'+'f'.repeat(40)+'/integrations/')));
  assert.ok(rawUrls.every(url=>!url.includes('/main/')));
});
test('invalid main source snapshot fails closed',async()=>{
  const result=await createHostedWorkerStatus({fetchImpl:async()=>({ok:true,json:async()=>({object:{sha:'main',type:'commit'}})})})();
  assert.equal(result.status,'HOSTED_EVIDENCE_UNAVAILABLE');
  assert.equal(result.evidence_error_code,'INVALID_SOURCE_SNAPSHOT');
});
