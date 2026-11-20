import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pictureSceneAtFrame, pictureTimeline, narrationSha256} from '../remotion/episode1-picture-timeline.mjs';

test('timeline is bound to unchanged repository narration', () => {
  const audio = readFileSync(new URL('../public/audio/episode1-narration.mp3', import.meta.url));
  assert.equal(createHash('sha256').update(audio).digest('hex'), narrationSha256);
});
test('all eighteen art scenes appear exactly once, without empty frame windows', () => {
  assert.deepEqual([...pictureTimeline.map(x => x.scene)].sort((a,b)=>a-b), Array.from({length:18},(_,i)=>i));
  for (let i=1;i<pictureTimeline.length;i++) {
    assert.ok(Math.ceil(pictureTimeline[i].start*24)>Math.ceil(pictureTimeline[i-1].start*24));
  }
});
test('spoken arithmetic and decisions show the matching picture on the first eligible frame', () => {
  for (const [seconds, scene] of [[9.6,6],[12.02,5],[15.3,8],[18.2,9],[21.24,10],[24.2,11]]) {
    const frame = Math.ceil(seconds*24);
    assert.equal(pictureSceneAtFrame(frame).scene, scene);
    assert.notEqual(pictureSceneAtFrame(frame-1).scene, scene);
    assert.equal(pictureSceneAtFrame(frame).progress, 0);
  }
});
test('every rendered frame maps to a bounded scene; final picture holds', () => {
  for (let frame=0;frame<720;frame++) {
    const current=pictureSceneAtFrame(frame);
    assert.ok(current.progress>=0 && current.progress<=1);
    assert.ok(current.scene>=0 && current.scene<18);
  }
  assert.equal(pictureSceneAtFrame(719).scene,17);
  assert.equal(pictureSceneAtFrame(1000).progress,1);
});
test('invalid frame and fps cannot enter the renderer', () => {
  for (const [frame,fps] of [[-1,24],[NaN,24],[0,0],[0,Infinity]]) assert.throws(()=>pictureSceneAtFrame(frame,fps));
});


test('authored detail cuts interrupt each former long hold within 60 frames', () => {
  for(const [seconds,scene] of [[5.6,12],[16.75,13],[20,14],[22.8,15],[26.2,16],[28.2,17]]) {
    const frame=Math.ceil(seconds*24);
    assert.equal(pictureSceneAtFrame(frame).scene,scene);
    assert.notEqual(pictureSceneAtFrame(frame-1).scene,scene);
  }
  for(let i=0;i<pictureTimeline.length;i++) {
    assert.ok(Math.ceil((pictureTimeline[i+1]?.start??30)*24)-Math.ceil(pictureTimeline[i].start*24)<=60);
  }
});
