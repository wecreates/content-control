import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAudioPadding} from './audio-mix-compat.mjs';
const graph=()=>({inputs:['-i','tone.wav'],filter:'[0:a]amix=inputs=1:normalize=0,apad=whole_dur=4,atrim=0:4[out]'});
test('normalization preserves input graph and returns independent inputs',()=>{
 const before=graph(),snapshot=structuredClone(before),after=normalizeAudioPadding(before,4);
 assert.deepEqual(before,snapshot);after.inputs.push('mutated');assert.deepEqual(before,snapshot);
 assert.ok(after.filter.endsWith('asetpts=N/SR/TB,apad=whole_dur=4,atrim=0:4[out]'));
});
test('changed duration, output label, trailing filters, duplicate and already normalized graphs reject',()=>{
 const source=graph();
 for(const filter of [source.filter.replace('whole_dur=4','whole_dur=3.5'),
  source.filter.replace('[out]','[other]'),source.filter+';anull',source.filter+';'+source.filter,
  normalizeAudioPadding(source,4).filter])assert.throws(()=>normalizeAudioPadding({...source,filter},4));
});
test('unbounded durations and malformed inputs reject',()=>{
 for(const duration of [0,-1,31,NaN,Infinity,'4'])assert.throws(()=>normalizeAudioPadding(graph(),duration));
 for(const bad of [null,{}, {inputs:[null],filter:graph().filter}])assert.throws(()=>normalizeAudioPadding(bad,4));
});
