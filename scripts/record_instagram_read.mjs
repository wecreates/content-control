#!/usr/bin/env node
// Persist a bounded official read receipt, never authorization material or API writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const PROVIDER='Meta Graph API';
const REASONS=new Set(['authorization_missing','invalid_account_id','publication_must_remain_disabled','authorization_rejected','permission_or_eligibility_required','provider_rate_limited','provider_read_failed']);
const fail=message=>{throw new Error(message)};
export function applyInstagramRead(matrix,report,{now=Date.now()}={}) {
 if(!matrix||!Array.isArray(matrix.platforms))fail('Invalid capability matrix');
 const targets=matrix.platforms.filter(p=>p?.id==='instagram');if(targets.length!==1)fail('Exactly one existing Instagram platform required');
 if(!report||report.provider!=='meta_business_sdk'||report.route!=='instagram_api_with_facebook_login'||report.publication_enabled!==false||report.full_analysis!==false)fail('Invalid official read receipt provenance or publication lock');
 const checked=Date.parse(report.checked_at);
 if(typeof report.checked_at!=='string'||!Number.isFinite(checked)||!Number.isFinite(now)||checked>now)fail('Invalid or future read timestamp');
 const date=new Date(checked).toISOString();let connection;
 if(report.status==='PASS') {
  const r=report.read_check;
  if(report.connected!==true||r?.provider!==PROVIDER||r.result!=='read_verified'||r.observed!=='authorized_account_and_media_page')fail('Successful bounded read proof required');
  if(r.checked_at!==undefined&&Date.parse(r.checked_at)!==checked)fail('Read receipt timestamps conflict');
  if(!Number.isInteger(report.media_items_checked)||report.media_items_checked<0||report.media_items_checked>5||!Number.isInteger(report.video_items_checked)||report.video_items_checked<0||report.video_items_checked>report.media_items_checked||report.pagination_followed!==false)fail('Invalid bounded media read counts');
  connection={status:'previously_verified',connected:true,provider:PROVIDER,checked_at:date,last_read_verified_at:date,renewal_supported:false,read_check:{provider:PROVIDER,observed:'authorized_account_and_media_page',result:'read_verified',checked_at:date}};
 } else if(report.status==='BLOCKED') {
  if(report.connected!==false||!REASONS.has(report.reason))fail('Valid blocked read reason required');
  if(report.read_check?.result==='read_verified')fail('Blocked receipt contradicts successful read');
  connection={status:'disconnected',connected:false,provider:PROVIDER,checked_at:date,renewal_supported:false,error_code:report.reason.toUpperCase(),read_check:{provider:PROVIDER,observed:'read_not_verified',result:report.reason,checked_at:date}};
 } else fail('Read receipt must be PASS or BLOCKED');
 const previous=targets[0].connection||{};
 const prior=[];
 for(const value of [previous.checked_at,previous.last_read_verified_at,previous.read_check?.checked_at]) {
  if(value===undefined)continue;
  const date=Date.parse(value);if(!Number.isFinite(date))fail('Existing receipt timestamp malformed');prior.push(date);
 }
 const newest=prior.length?Math.max(...prior):-Infinity;
 if(checked<newest)fail('Stale receipt cannot overwrite newer connection evidence');
 if(checked===newest) {
  if(JSON.stringify(previous)!==JSON.stringify(connection))fail('Conflicting receipts share a timestamp');
  return {matrix:structuredClone(matrix),changed:false,status:report.status,checked_at:date};
 }
 const updated=structuredClone(matrix);updated.platforms.find(p=>p.id==='instagram').connection=connection;
 return {matrix:updated,changed:true,status:report.status,checked_at:date};
}
export async function recordInstagramRead(reportPath,matrixPath,options={}) {
 const [rawReport,rawMatrix]=await Promise.all([fs.readFile(reportPath,'utf8'),fs.readFile(matrixPath,'utf8')]);
 const result=applyInstagramRead(JSON.parse(rawMatrix),JSON.parse(rawReport),options);
 if(result.changed) {
  // Detect concurrent changes before replacement. Workflow concurrency serializes writers.
  if(await fs.readFile(matrixPath,'utf8')!==rawMatrix)fail('Capability matrix changed during receipt validation');
  const temp=path.resolve(matrixPath)+'.'+crypto.randomUUID()+'.tmp';
  try{await fs.writeFile(temp,JSON.stringify(result.matrix,null,2)+'\n',{mode:0o600});await fs.rename(temp,matrixPath);}finally{await fs.rm(temp,{force:true});}
 }
 return {status:result.status,changed:result.changed,checked_at:result.checked_at,publication_enabled:false,scope:'Recorded official account identity and bounded metadata read only'};
}
async function main(){const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];try{if(!args.includes('--receipt')||!args.includes('--capabilities'))fail('--receipt and --capabilities required');console.log(JSON.stringify(await recordInstagramRead(value('--receipt'),value('--capabilities'))));}catch(error){console.log(JSON.stringify({status:'BLOCKED',changed:false,publication_enabled:false,reason:error instanceof SyntaxError?'INVALID_JSON':error.code?'FILE_ACCESS_FAILED':error.message}));process.exitCode=2;}}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
