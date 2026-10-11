import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {addIntake,normalizeSocialUrl,updateQueueFile} from '../social-intake.js';

export async function saveSocialLink({root=process.cwd(),env=process.env}={}) {
  const owner=env.GITHUB_REPOSITORY_OWNER;
  if(!owner||env.GITHUB_ACTOR!==owner||env.GITHUB_TRIGGERING_ACTOR!==owner||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_EVENT_NAME!=='workflow_dispatch')throw new Error('OWNER_MAIN_DISPATCH_REQUIRED');
  const normalized=normalizeSocialUrl(env.SOURCE_URL);
  const file=path.join(root,'capability-queue.json');
  // Preserve the exact existing bytes on duplicate submissions.
  const existing=JSON.parse(await fs.readFile(file,'utf8'));
  let result=addIntake(existing,normalized.source_url);
  if(result.created)result=await updateQueueFile(file,q=>addIntake(q,normalized.source_url));
  return {created:result.created,record_id:result.record.id,source_url:normalized.source_url,publication_enabled:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const receipt=await saveSocialLink();
    // This is local preparation only. Workflow reports durable success after push.
    console.log(JSON.stringify(receipt));
  } catch(error) {
    console.error(error.message==='OWNER_MAIN_DISPATCH_REQUIRED'?error.message:'INTAKE_VALIDATION_OR_STORAGE_FAILED');
    process.exitCode=1;
  }
}
