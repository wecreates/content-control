import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import qs from 'qs';
import {z} from 'zod';
const require = createRequire(import.meta.url);

test('resolved dependency versions match the proposed security pins', () => {
  for (const [name, version] of Object.entries({express:'4.22.3', qs:'6.16.1', zod:'4.6.7', remotion:'4.0.540', '@remotion/cli':'4.0.540'})) {
    assert.equal(require(`${name}/package.json`).version, version, name);
  }
});

test('qs comma serialization handles bounded hostile own toString values', () => {
  const values = [
    JSON.parse('{"a":[{"toString":"x"}]}'),
    qs.parse('a[0][toString]=x', {allowPrototypes:true}),
    qs.parse('a[][b]=c', {plainObjects:true}),
    JSON.parse('{"a":[[1,[{"toString":"x"}]],"y"]}')
  ];
  for (const value of values) for (const encodeValuesOnly of [false, true]) {
    let result;
    assert.doesNotThrow(() => {result = qs.stringify(value, {arrayFormat:'comma', encodeValuesOnly});});
    assert.match(result, /object(?:%20| )Object/);
  }
  assert.equal(qs.stringify({a:['x','y']}, {arrayFormat:'comma'}), 'a=x%2Cy');
});

for (const type of ['array', 'map', 'set']) test(`Zod ${type} size limit rejects before element traversal`, () => {
  let visited = 0;
  const element = z.string().refine(() => {visited++; return true;});
  const values = Array.from({length:16}, (_, i) => String(i));
  const schema = type === 'array' ? z.array(element).max(2)
    : type === 'map' ? z.map(element, element).max(2) : z.set(element).max(2);
  const input = type === 'array' ? values : type === 'map' ? new Map(values.map(x => [x,x])) : new Set(values);
  const result = schema.safeParse(input);
  assert.equal(result.success, false);
  assert.equal(result.error.issues.length, 1);
  assert.equal(result.error.issues[0].code, 'too_big');
  assert.equal(visited, 0);
});
