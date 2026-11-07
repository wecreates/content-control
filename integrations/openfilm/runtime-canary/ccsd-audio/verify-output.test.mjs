import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyTimeline} from './verify-output.mjs';
const cues=[.25,1.25,2.25,3.25];
function inputs(shift=0){
 const gray=Buffer.alloc(96*64),pcm=Buffer.alloc(4*48000*4);
 for(let f=0;f<96;f++)if(cues.some(c=>f/24>=c&&f/24<c+.25))gray.fill(255,f*64,(f+1)*64);
 for(let n=0;n<48000*4;n++){
  const t=n/48000,i=cues.findIndex(c=>t>=c+shift&&t<c+shift+.25);
  pcm.writeFloatLE(i<0?0:(i===1?.05:.1)*Math.sin(2*Math.PI*880*t),n*4);
 }
 return {gray,pcm};
}
test('aligned cues pass with every frame and PCM window checked',()=>{
 const {gray,pcm}=inputs(),r=verifyTimeline(gray,pcm,cues);
 assert.equal(r.frames_checked,96);assert.equal(r.pcm_windows_checked,800);
});
test('100ms audio delay fails independently of the correct video frames',()=>{
 const {gray,pcm}=inputs(.1);assert.throws(()=>verifyTimeline(gray,pcm,cues),/onset/);
});
test('missing waveform, omitted frame and stuck visual marker fail',()=>{
 const {gray,pcm}=inputs();
 assert.throws(()=>verifyTimeline(gray,Buffer.alloc(pcm.length),cues),/cue count/);
 assert.throws(()=>verifyTimeline(gray.subarray(64),pcm,cues),/frame count/);
 assert.throws(()=>verifyTimeline(Buffer.alloc(gray.length),pcm,cues),/visual cue/);
});
