import {additionalToolStatus} from './repository-additional-status.js';
// Read only public execution evidence from the existing Money Factory repository.
const repository = 'wecreates/Money-factory';
const workflow = '.github/workflows/repository-integrations.yml';
const expected = new Map([
  ['youtube-clipper-skill', ['clip', 'captions']],
  ['openshorts', ['vertical', 'transcript-windows']],
  ['claude-seo', ['parse-html']],
  ['toonflow-app', ['import-brief']],
  ['ruflo', ['remember-project']],
  ['youtube-automation-agent', ['audit']],
]);

// Only fixed codes cross the public boundary; upstream errors can contain private data.
const validationErrors = new Set(['INVALID_SOURCE_SNAPSHOT', 'INVALID_REGISTRY',
  'INVALID_WORKFLOW', 'INVALID_EVIDENCE', 'INVALID_RECEIPT']);
class EvidenceReadError extends Error {
  constructor(code) { super(code); this.code = code; }
}
function evidenceErrorCode(error) {
  if (error instanceof EvidenceReadError) return error.code;
  if (error instanceof Error && validationErrors.has(error.message)) return error.message;
  return 'UNCLASSIFIED_EVIDENCE_FAILURE';
}

export function createHostedWorkerStatus({fetchImpl=fetch, now=Date.now, cacheMs=60000}={}) {
  let cached, expires=0, inflight;
  async function json(url, optional=false) {
    try {
      const response=await fetchImpl(url, {signal:AbortSignal.timeout(10000),
        headers:{Accept:'application/json','User-Agent':'CYZOR-Content-Control'}});
      if(optional && response.status===404)return null;
      const rateLimited=response.status===429 || (response.status===403 &&
        (response.headers?.get('x-ratelimit-remaining')==='0' || !!response.headers?.get('retry-after')));
      if(!response.ok)throw new EvidenceReadError(rateLimited?'UPSTREAM_RATE_LIMITED':
        response.status>=500?'UPSTREAM_UNAVAILABLE':'UPSTREAM_REQUEST_REJECTED');
      try { return await response.json(); }
      catch (error) {
        if(error instanceof SyntaxError)throw new EvidenceReadError('INVALID_UPSTREAM_JSON');
        throw error;
      }
    } catch (error) {
      if(error instanceof EvidenceReadError)throw error;
      throw new EvidenceReadError(error?.name==='AbortError'||error?.name==='TimeoutError'
        ?'UPSTREAM_TIMEOUT':'UPSTREAM_NETWORK_FAILURE');
    }
  }
  async function read(independentEvidence) {
    const ref=await json(`https://api.github.com/repos/${repository}/git/ref/heads/main`);
    const snapshot=ref.object?.sha;
    if(!/^[a-f0-9]{40}$/.test(snapshot)||ref.object?.type!=='commit')throw Error('INVALID_SOURCE_SNAPSHOT');
    const raw=`https://raw.githubusercontent.com/${repository}/${snapshot}/integrations/`;
    const [registry, report, runs] = await Promise.all([
      json(raw+'repositories.json'), json(raw+'hosted-verification.json',true),
      json(`https://api.github.com/repos/${repository}/actions/workflows/repository-integrations.yml/runs?branch=main&per_page=1`),
    ]);
    if(registry.schema_version!==1 || registry.repositories?.length!==7 ||
       new Set(registry.repositories.map(e=>e.id)).size!==7 ||
       !['wan21',...expected.keys()].every(id=>registry.repositories.some(e=>e.id===id)))throw Error('INVALID_REGISTRY');
    const latest=runs.workflow_runs?.[0];
    const result={backend:'github-actions',evidence_snapshot_revision:snapshot,
      workflow_url:`https://github.com/${repository}/actions/workflows/repository-integrations.yml`,
      status:'HOSTED_CPU_NOT_VERIFIED', production_ready:false, publication_enabled:false, paid_generation_enabled:false,
      persistent_worker_configured:false,
      status_scope:'Hosted CPU verification only; GPU generation, provider workflows and persistent project state remain unverified',
      additional_tools:await additionalToolStatus(registry,{json,now,rawBase:raw}),
      repositories:registry.repositories.map(e=>({id:e.id,order:e.order,revision:e.revision,capability:e.capability,
        required_for_production:e.required_for_production!==false,
        runtime_status:e.id==='wan21'?(e.required_for_production===false?'OPTIONAL_DISABLED':'BLOCKED_CUDA_AND_MODEL_REQUIRED'):'HOSTED_EXECUTION_NOT_VERIFIED',
        verified_operations:[]}))};
    // Preserve only independently validated scope if original-suite validation throws.
    independentEvidence.additional_tools=result.additional_tools;
    independentEvidence.evidence_snapshot_revision=snapshot;
    if(!latest)return result;
    if(latest.path!==workflow || latest.head_branch!=='main' || !Number.isSafeInteger(latest.id))throw Error('INVALID_WORKFLOW');
    result.run={id:latest.id,status:latest.status,conclusion:latest.conclusion,
      url:`https://github.com/${repository}/actions/runs/${latest.id}`};
    if(latest.status!=='completed')return {...result,status:'HOSTED_CPU_VERIFICATION_RUNNING'};
    if(latest.conclusion!=='success')return {...result,status:'HOSTED_CPU_VERIFICATION_FAILED'};
    if(!report)return result;
    const age=now()-Date.parse(report.verified_at);
    if(!Number.isFinite(age)||age< -60000||age>7*24*3600000)return {...result,status:'HOSTED_CPU_EVIDENCE_STALE'};
    if(report.schema_version!==1 || report.status!=='PASS' || report.production_ready!==false ||
       report.publication_enabled!==false || report.paid_generation_enabled!==false ||
       String(report.workflow_run_id)!==String(latest.id) ||
       String(report.workflow_run_attempt)!==String(latest.run_attempt) ||
       report.money_factory_revision!==latest.head_sha || !/^[a-f0-9]{40}$/.test(report.content_control_revision) ||
       report.negative_checks!==3 || !Array.isArray(report.receipts) || report.receipts.length!==8)throw Error('INVALID_EVIDENCE');
    for(const [id, operations] of expected) {
      const entry=result.repositories.find(e=>e.id===id);
      for(const operation of operations) {
        const receipts=report.receipts.filter(r=>r.tool===id&&r.operation===operation);
        if(receipts.length!==1 || receipts[0].status!=='PASS' || receipts[0].revision!==entry.revision ||
           receipts[0].publication_enabled!==false || !/^[a-f0-9]{64}$/.test(receipts[0].output_sha256))throw Error('INVALID_RECEIPT');
      }
      entry.runtime_status='HOSTED_OPERATIONS_VERIFIED';
      entry.verified_operations=operations;
    }
    return {...result,status:'HOSTED_CPU_OPERATIONS_VERIFIED',verified_at:report.verified_at,
      tested_money_factory_revision:report.money_factory_revision,
      tested_content_control_revision:report.content_control_revision};
  }
  return async()=>{
    if(cached&&now()<expires)return cached;
    if(inflight)return inflight;
    const independentEvidence={};
    inflight=read(independentEvidence).catch(error=>({...independentEvidence,backend:'github-actions',status:'HOSTED_EVIDENCE_UNAVAILABLE',
      evidence_error_code:evidenceErrorCode(error),
      production_ready:false,publication_enabled:false,paid_generation_enabled:false}))
      .then(result=>{
        const required=result.additional_tools?.filter(entry=>entry.required_for_aggregate);
        const known=required!==undefined && required.every(entry=>Array.isArray(entry.expected_operations)) &&
          new Set(result.additional_tools.map(entry=>entry.id)).size===result.additional_tools.length;
        const originalVerified=result.status==='HOSTED_CPU_OPERATIONS_VERIFIED';
        const verifiedAdditional=[...new Map((required ?? [])
          .filter(entry=>entry.runtime_status==='HOSTED_OPERATIONS_VERIFIED').map(entry=>[entry.id,entry])).values()];
        const aggregateVerified=known && originalVerified && verifiedAdditional.length===required.length;
        cached={...result,
          aggregate_status:aggregateVerified?'HOSTED_REQUIRED_OPERATIONS_VERIFIED':'HOSTED_REQUIRED_OPERATIONS_NOT_VERIFIED',
          aggregate_scope:'Original CPU suite and required configured additional hosted operations only; not provider, creative, production or publishing readiness',
          expected_operation_count:known?8+required.reduce((sum,entry)=>sum+entry.expected_operations.length,0):null,
          verified_operation_count:(originalVerified?8:0)+verifiedAdditional.reduce((sum,entry)=>sum+entry.verified_operations.length,0)};
        expires=now()+cacheMs;return cached;
      })
      .finally(()=>{inflight=null;});
    return inflight;
  };
}
