// Validate existing V2 stage receipts; a pre-render acknowledgement is not a render receipt.
export function verifyRenderBinding({execution,qa,sidecar,composition,id,plan,ccsdPath,candidatePath,candidateHash,compositionPath,compositionHash,qaPath,qaHash}){
 const fail=()=>{throw Error('RENDER_PLAN_BINDING_INVALID');};
 if(sidecar?.id!==id||JSON.stringify(sidecar.plan)!==JSON.stringify(plan)||composition?.composition!==plan.composition)fail();
 const stages=execution?.stages;
 for(const name of ['render','mux','qa','package'])if(stages?.[name]?.status!=='PASS')fail();
 if(stages.qa.inputs?.[ccsdPath]!==plan.ccsd_sha256||stages.qa.inputs?.[candidatePath]!==candidateHash||stages.qa.outputs?.[qaPath]!==qaHash||stages.mux.outputs?.[candidatePath]!==candidateHash||stages.render.inputs?.[compositionPath]!==compositionHash)fail();
 if(qa?.candidate_sha256!==candidateHash||execution.candidate_sha256!==candidateHash)fail();
 return true;
}
