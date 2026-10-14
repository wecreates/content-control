import test from 'node:test';
import assert from 'node:assert/strict';
import {additionalToolStatus} from '../repository-additional-status.js';
function fixture(id='voicestudio') {
  const configs={voicestudio:['media_tools','voicestudio-integration.yml',['synthesize']],
    rea:['engineering_tools','rea-offline-analysis.yml',['analyze-javascript-application','mcp-smoke','inspect-artifact','capture-owned-process','inspect-local-web-page']],
    'youtube-agent-skill':['agent_tools','youtube-skill-integration.yml',['hook-score','package-lint','edit-plan','chapters','retention','outliers']]};
  const [group,workflow,ops]=configs[id];
  const registry={[group]:[{id,revision:'a'.repeat(40),runtime_status:'CLAIMED_READY'}]};
  const run={id:123,run_attempt:1,status:'completed',conclusion:'success',head_sha:'b'.repeat(40),head_branch:'main',path:'.github/workflows/'+workflow};
  const receipts=ops.map(operation=>({tool:id,operation,revision:'a'.repeat(40),status:'PASS',publication_enabled:false,output_sha256:'c'.repeat(64)}));
  const report={schema_version:1,status:'PASS',verified_at:'2026-10-14T20:00:00Z',workflow_run_id:123,workflow_run_attempt:1,
    source_revision:run.head_sha,publication_enabled:false,paid_generation_enabled:false,
    ...(id==='voicestudio'?{receipt:receipts[0]}:{checks:receipts.map(receipt=>({receipt}))})};
  return {registry,run,report,receipts};
}
async function read(data) {
  return (await additionalToolStatus(data.registry,{now:()=>Date.parse('2026-10-14T21:00:00Z'),json:async url=>{
    if(data.offline)throw Error('secret');
    return url.includes('/actions/')?{workflow_runs:[data.run]}:data.report;
  }}))[0];
}
test('all three groups require actual workflow and receipt coverage',async()=>{
  for(const id of ['rea','voicestudio','youtube-agent-skill']) {
    const data=fixture(id),result=await read(data);
    assert.equal(result.runtime_status,'HOSTED_OPERATIONS_VERIFIED');
    assert.equal(result.verified_operations.length,data.receipts.length);
    assert.equal(result.production_ready,false);
  }
});
test('source, workflow attempt, permission, hash and operation mismatches fail closed',async()=>{
  for(const mutate of [d=>d.report.source_revision='d'.repeat(40),d=>delete d.report.workflow_run_attempt,
    d=>d.report.workflow_run_id=456,d=>d.report.publication_enabled=true,d=>d.report.paid_generation_enabled=true,
    d=>d.receipts[0].revision='e'.repeat(40),d=>d.receipts[0].output_sha256='invalid',
    d=>d.receipts[0].operation='clone',d=>d.receipts[0].status='FAIL',d=>d.run.path='other.yml']) {
    const data=fixture();mutate(data);assert.equal((await read(data)).runtime_status,'HOSTED_EVIDENCE_UNAVAILABLE');
  }
});
test('latest run and freshness supersede passing registry claims',async()=>{
  const data=fixture();data.run.status='in_progress';assert.equal((await read(data)).runtime_status,'HOSTED_VERIFICATION_RUNNING');
  data.run.status='completed';data.run.conclusion='failure';assert.equal((await read(data)).runtime_status,'HOSTED_VERIFICATION_FAILED');
  data.run.conclusion='success';data.report.verified_at='2020-01-01';assert.equal((await read(data)).runtime_status,'HOSTED_EVIDENCE_STALE');
  data.report=null;assert.equal((await read(data)).runtime_status,'HOSTED_EXECUTION_NOT_VERIFIED');
});
test('missing operation cannot claim full registered coverage and outages do not leak',async()=>{
  const data=fixture('rea');data.report.checks.pop();assert.equal((await read(data)).runtime_status,'HOSTED_EVIDENCE_UNAVAILABLE');
  data.offline=true;assert.ok(!JSON.stringify(await read(data)).includes('secret'));
});
