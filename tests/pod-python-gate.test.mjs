import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('declared POD Python gate discovers every POD Python suite',async()=>{
 const packageJson=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(packageJson.scripts['test:pod-python'],
  "python3 -m unittest discover -s tests -p 'test_pod*.py'");
 const suites=(await fs.readdir(new URL('.',import.meta.url)))
  .filter(name=>/^test_pod.*\.py$/.test(name));
 assert.ok(suites.length>1,'expected the aggregate gate to cover multiple Python suites');
});

test('POD integration uses the aggregate Python gate without duplicate one-file runs',async()=>{
 const workflow=await fs.readFile(new URL('../.github/workflows/pod-integration.yml',import.meta.url),'utf8');
 assert.equal(workflow.match(/- run: npm run test:pod-python/g)?.length,1);
 assert.doesNotMatch(workflow,/python -m unittest discover -s tests -p test_pod[^*'"\s]*\.py/);
 assert.equal(workflow.match(/'package\.json'/g)?.length,2);
});
