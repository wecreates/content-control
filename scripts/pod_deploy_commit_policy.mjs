// Report-only changes do not require rebuilding the shared Render service.
// This does not restore exhausted quota, change billing, or skip GitHub CI.
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export const REPORT_ONLY_PATHS=Object.freeze([
 'state/provenance/npm-sbom.cdx.json',
 'state/provenance/runtime-provenance.json',
 // Watchdog observation consumed by repository verification/repair routing.
 // Other watchdog-staged health and completion paths are not allowlisted.
 'state/free-production-watchdog.json',
 // Normalized dependency-audit evidence only. Dependency manifest and lockfile
 // changes remain runtime changes and are intentionally not allowlisted.
 'state/runtime-security-audit.json',
 // Hash manifest receipt only. Every source file that can change the manifest
 // remains outside this allowlist and therefore still requires deployment.
 'state/runtime-integrity-manifest.json',
 // Live-probe receipt only. A later application release carries this metadata;
 // rebuilding identical runtime bytes cannot make a failed probe pass.
 'state/live-deployment-health.json',
 'POD_COMPLETION_CHECKLIST.md',
 'POD_IMPLEMENTATION_STATUS.md',
 'POD_FREE_DEPLOYMENT.md',
]);
const reports=new Set(REPORT_ONLY_PATHS);

export function renderCommitMessage(message,changedPaths){
 if(typeof message!=='string'||!message.trim()||/[\r\n]/.test(message)||
  /\[(?:skip (?:render|deploy|cd)|(?:render|deploy|cd) skip)\]/i.test(message))throw Error('COMMIT_MESSAGE_INVALID');
 if(!Array.isArray(changedPaths)||changedPaths.some(p=>typeof p!=='string'||!p))throw Error('CHANGE_LIST_INVALID');
 return changedPaths.length>0&&changedPaths.every(p=>reports.has(p))?`${message} [skip render]`:message;
}

export function stagedRenderCommitMessage(message,{cwd=process.cwd()}={}){
 // Disable rename collapsing: moving runtime code into a report path must expose
 // the runtime deletion and therefore must never acquire a skip marker.
 const output=execFileSync('git',['diff','--cached','--name-only','--no-renames','-z'],
  {cwd,encoding:'utf8',timeout:10000,maxBuffer:1024*1024});
 const paths=output.split('\0');if(paths.at(-1)==='')paths.pop();
 return renderCommitMessage(message,paths);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==3)throw Error('ONE_COMMIT_MESSAGE_REQUIRED');
  process.stdout.write(stagedRenderCommitMessage(process.argv[2])+'\n');
 }catch{process.stderr.write('DEPLOY_COMMIT_POLICY_BLOCKED\n');process.exitCode=2;}
}
