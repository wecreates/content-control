import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {normalizeCatalog,buildCatalog} from './import-catalog.mjs';

test('deduplicates and keeps references non-executable',()=>{
 const result=normalizeCatalog([{id:'a',category:'Explainers',prompt_path:'prompts/a.md',url:'https://example.com/a'},{id:'a'},{id:'b',prompt_path:'../secret'}],'main');
 assert.equal(result.length,2);
 assert.equal(result[0].prompt_path,'prompts/a.md');
 assert.equal(result[1].prompt_path,null);
 assert.ok(result.every(x=>!x.execution_allowed&&!x.publication_allowed));
});
test('imports offline JSON and disables publication',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'opus-catalog-'));
 try{
  const input=join(dir,'in.json'),output=join(dir,'out.json');
  await writeFile(input,JSON.stringify({videos:[{id:'one',title:'Test'}]}));
  const x=await buildCatalog({inputPath:input,outputPath:output});
  assert.equal(x.count,1);
  const parsed=JSON.parse(await readFile(output,'utf8'));
  assert.equal(parsed.publication_enabled,false);
  assert.equal(parsed.entries[0].title,'Test');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('rejects missing input without explicit fetch',async()=>{
 await assert.rejects(buildCatalog({outputPath:'/tmp/not-written.json'}),/Network access disabled/);
});
