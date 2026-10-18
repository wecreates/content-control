import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

test('the smoke workflow requires the exact caption hash emitted by the actual watch handler',()=>{
 const source=fs.readFileSync(new URL('../server-lowmem.js',import.meta.url),'utf8');
 const workflow=fs.readFileSync(new URL('../.github/workflows/review-server-smoke.yml',import.meta.url),'utf8');
 const lines=workflow.split('\n');
 const assignment=lines.find(line=>line.trim().startsWith('expected_caption='));
 const assertion=lines.find(line=>line.includes('grep ')&&line.includes('src=')&&line.includes('/tmp/watch.html'));
 assert.ok(assignment);assert.ok(assertion);assert.ok(lines.indexOf(assignment)<lines.indexOf(assertion));
 const candidateHash='a'.repeat(64),captionHash='b'.repeat(64);
 let handler;
 vm.runInNewContext(source.slice(source.indexOf('app.get("/watch",'),source.indexOf('app.use((req,res)=>')),
  {app:{get:(route,fn)=>{assert.equal(route,'/watch');handler=fn;}},acceptance:()=>({ready:true,expected:candidateHash,captionHash})});
 let html;const response={setHeader(){},type(){return this;},send(body){html=body;}};handler({},response);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'review-smoke-contract-'));
 try{
  fs.mkdirSync(path.join(root,'state'));fs.writeFileSync(path.join(root,'state/caption-health.json'),JSON.stringify({caption_sha256:captionHash}));
  const file=path.join(root,'watch.html');
  const command=assignment.trim()+'\n'+assertion.trim().replace('/tmp/watch.html','"$WATCH_HTML"');
  const bound=`src="/captions?sha256=${captionHash}"`;assert.ok(html.includes(bound));
  for(const [label,body,expected] of [
   ['actual handler',html,0],
   ['missing hash',html.replace(bound,'src="/captions"'),1],
   ['candidate instead of caption',html.replace(bound,`src="/captions?sha256=${candidateHash}"`),1],
   ['wrong hash',html.replace(bound,`src="/captions?sha256=${'c'.repeat(64)}"`),1],
   ['wrong query key',html.replace(bound,`src="/captions?hash=${captionHash}"`),1],
   ['wrong path',html.replace(bound,`src="/unrelated?sha256=${captionHash}"`),1],
  ]){
   fs.writeFileSync(file,body);
   const result=spawnSync('bash',['-euc',command],{cwd:root,env:{...process.env,WATCH_HTML:file},encoding:'utf8',timeout:5000});
   assert.equal(result.status,expected,label+': '+result.stderr);
  }
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
