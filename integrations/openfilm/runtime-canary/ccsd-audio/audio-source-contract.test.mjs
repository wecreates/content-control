import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSourceTrim,validateAudioSources} from './audio-source-contract.mjs';
const probe=(duration='.5',rate='48000')=>({streams:[{codec_type:'audio',duration,sample_rate:rate,channels:2}]});
test('source boundaries allow one sample rounding but reject overruns',()=>{
 for(const rate of [16000,44100,48000]){
  assert.equal(validateSourceTrim({from:0,to:.5},probe('.5',rate)).sample_rate,rate);
  validateSourceTrim({from:.1,to:.5+.5/rate},probe('.5',rate));
  assert.throws(()=>validateSourceTrim({from:0,to:.5+2/rate},probe('.5',rate)),/exceeds/);
 }
});
test('missing or invalid source timing and invalid trims fail closed',()=>{
 for(const p of [{},probe('N/A'),probe('0'),probe('Infinity'),probe('.5','0'),probe('.5','NaN')])
  assert.throws(()=>validateSourceTrim({from:0,to:.5},p),/unavailable/);
 for(const c of [{from:-1,to:.5},{from:0,to:NaN},{from:.5,to:.5},{from:Infinity,to:1}])
  assert.throws(()=>validateSourceTrim(c,probe()),/Invalid/);
});
test('pre-cancel source inspection never launches ffprobe',async()=>{
 const c=new AbortController();c.abort();
 await assert.rejects(validateAudioSources([{file:'must-not-open.wav'}],c.signal),/cancelled/);
});
