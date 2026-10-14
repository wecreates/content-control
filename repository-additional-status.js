// Additional tools have independent hosted acceptance; never infer it from registry labels.
const repository='wecreates/Money-factory';
const configurations={
  rea:{workflow:'rea-offline-analysis.yml',report:'rea/hosted-verification.json',operations:[
    'analyze-javascript-application','mcp-smoke','inspect-artifact','capture-owned-process','inspect-local-web-page']},
  voicestudio:{workflow:'voicestudio-integration.yml',report:'voicestudio/hosted-verification.json',operations:['synthesize']},
  'youtube-agent-skill':{workflow:'youtube-skill-integration.yml',report:'youtube_skill/hosted-verification.json',operations:[
    'hook-score','package-lint','edit-plan','chapters','retention','outliers']},
};
const hash=/^[a-f0-9]{64}$/;
export async function additionalToolStatus(registry,{json,now}) {
  const entries=[...(registry.engineering_tools||[]),...(registry.media_tools||[]),...(registry.agent_tools||[])];
  return Promise.all(entries.map(async entry=>{
    const result={id:entry.id,revision:entry.revision,capability:entry.capability,
      runtime_status:'HOSTED_EXECUTION_NOT_VERIFIED',verified_operations:[],production_ready:false,
      publication_enabled:false,paid_generation_enabled:false,
      scope:'Named hosted operations only; not complete upstream application readiness'};
    const config=configurations[entry.id];
    if(!config)return result;
    try {
      const [report,runs]=await Promise.all([
        json(`https://raw.githubusercontent.com/${repository}/main/integrations/${config.report}`,true),
        json(`https://api.github.com/repos/${repository}/actions/workflows/${config.workflow}/runs?branch=main&per_page=1`),
      ]);
      const latest=runs.workflow_runs?.[0];
      if(!latest)return result;
      if(latest.path!==`.github/workflows/${config.workflow}`||latest.head_branch!=='main'||
          !Number.isSafeInteger(latest.id)||!Number.isSafeInteger(latest.run_attempt))throw Error('workflow');
      result.run={id:latest.id,status:latest.status,conclusion:latest.conclusion,
        url:`https://github.com/${repository}/actions/runs/${latest.id}`};
      if(latest.status!=='completed')return {...result,runtime_status:'HOSTED_VERIFICATION_RUNNING'};
      if(latest.conclusion!=='success')return {...result,runtime_status:'HOSTED_VERIFICATION_FAILED'};
      if(!report)return result;
      const age=now()-Date.parse(report.verified_at);
      if(!Number.isFinite(age)||age< -60000||age>7*24*3600000)return {...result,runtime_status:'HOSTED_EVIDENCE_STALE'};
      if(report.schema_version!==1||report.status!=='PASS'||report.publication_enabled!==false||
          report.paid_generation_enabled!==false||report.production_ready===true||
          String(report.workflow_run_id)!==String(latest.id)||String(report.workflow_run_attempt)!==String(latest.run_attempt)||
          report.source_revision!==latest.head_sha||!/^[a-f0-9]{40}$/.test(report.source_revision))throw Error('report');
      const receipts=report.receipt?[report.receipt]:report.checks?.map(check=>check.receipt);
      if(!Array.isArray(receipts)||!receipts.length||receipts.some(receipt=>!receipt||receipt.tool!==entry.id||
          receipt.status!=='PASS'||receipt.revision!==entry.revision||receipt.publication_enabled!==false||
          !config.operations.includes(receipt.operation)||!hash.test(receipt.output_sha256)))throw Error('receipt');
      if(config.operations.some(operation=>!receipts.some(receipt=>receipt.operation===operation)))throw Error('coverage');
      return {...result,runtime_status:'HOSTED_OPERATIONS_VERIFIED',verified_operations:[...config.operations],
        verified_at:report.verified_at,tested_money_factory_revision:report.source_revision};
    } catch {
      return {...result,runtime_status:'HOSTED_EVIDENCE_UNAVAILABLE'};
    }
  }));
}
