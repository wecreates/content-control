import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaybackTracker} from '../comparison-ui/playback.mjs';
const identity={identity_verified:true,sha256:'a'.repeat(64),byte_length:100};
const frame=(time,wall,patch={})=>({time,wall,duration:5,rate:1,playing:true,visible:true,audible:true,...patch});
test('continuous player progression records both modalities but never review',()=>{
 const t=createPlaybackTracker('synthetic-session');t.sample(frame(0,0));t.sample(frame(.25,250));t.sample(frame(.5,500));
 const s=t.snapshot(identity);assert.deepEqual(s.video_playback_intervals,[[0,.5]]);assert.deepEqual(s.unmuted_playback_intervals,[[0,.5]]);
 assert.equal(s.artifact_sha256,identity.sha256);assert.equal(s.session_id,'synthetic-session');
 for(const k of ['perception_verified','full_video_review','full_audio_review'])assert.equal(s[k],false);
});
test('seeks, long callbacks, hidden and paused periods never fill gaps',()=>{
 for(const second of [frame(4,250),frame(2,2000),frame(.25,250,{visible:false}),frame(.25,250,{playing:false})]){
  const t=createPlaybackTracker('synthetic');t.sample(frame(0,0));t.sample(second);assert.deepEqual(t.snapshot(identity).video_playback_intervals,[]);
 }
 const t=createPlaybackTracker('synthetic');t.sample(frame(0,0));t.interrupt();t.sample(frame(4,250));
 assert.deepEqual(t.snapshot(identity).video_playback_intervals,[]);
});
test('muted reference movement is not audio playback evidence',()=>{
 const t=createPlaybackTracker('synthetic');t.sample(frame(0,0,{audible:false}));t.sample(frame(.25,250,{audible:false}));
 assert.deepEqual(t.snapshot(identity).video_playback_intervals,[[0,.25]]);assert.deepEqual(t.snapshot(identity).unmuted_playback_intervals,[]);
});
test('new selection is a new session with no inherited coverage and requires hash',()=>{
 const old=createPlaybackTracker('old');old.sample(frame(0,0));old.sample(frame(.25,250));
 const fresh=createPlaybackTracker('fresh');assert.deepEqual(fresh.snapshot(identity).video_playback_intervals,[]);
 assert.throws(()=>fresh.snapshot({...identity,identity_verified:false}));
});

test('replaying earlier intervals unions telemetry without inventing the intervening gap',()=>{
 const t=createPlaybackTracker('synthetic');t.sample(frame(4,0));t.sample(frame(4.25,250));t.interrupt();
 t.sample(frame(0,500));t.sample(frame(.25,750));
 assert.deepEqual(t.snapshot(identity).video_playback_intervals,[[0,.25],[4,4.25]]);
});
