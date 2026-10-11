import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyCaptionFrames} from '../scripts/verify_caption_frames.mjs';
function fixture(){
 const words=['Plot','twist:','the','winning'];const times=[[25.8,26.32],[26.32,26.68],[27.10,27.12],[27.12,27.3]];
 const ccsd={fps:24,publication_enabled:false,scenes:[{id:'a',start:0,end:30,audio:{dialogue:[{speaker:'monk',text:words.join(' ')}]}}]};
 const track={status:'PASS',publication_enabled:false,cues:words.map((word,i)=>({word,start:times[i][0],end:times[i][1],speaker:'monk',scene_id:'a',observed_word_index:i,source_word_indices:[i],display_word_indices:i<3?Array.from({length:i+1},(_,j)=>j):[3],text:i<3?words.slice(0,i+1).join(' '):word}))};
 return {ccsd,track};
}
test('actual renderer rejects frame-invisible original word and accepts carried phrase',()=>{
 const {ccsd,track}=fixture();const old=verifyCaptionFrames(ccsd,track);assert.equal(old.status,'BLOCKED');assert.deepEqual(old.missing_word_indices,[2]);
 track.cues[3].text='the winning';track.cues[3].display_word_indices=[2,3];const fixed=verifyCaptionFrames(ccsd,track);assert.equal(fixed.status,'PASS');assert.equal(fixed.visible_word_count,4);assert.equal(fixed.frame_count,720);
});
test('misbound display text and indices cannot pass',()=>{
 for(const change of [t=>t.cues[0].text='Wrong',t=>t.cues[0].display_word_indices=[20],t=>t.cues[0].source_word_indices=[1]]){
 const {ccsd,track}=fixture();change(track);assert.equal(verifyCaptionFrames(ccsd,track).status,'BLOCKED');
 }
});
test('future words are rejected even in a subframe cue',()=>{
 const {ccsd,track}=fixture();track.cues[2].text='winning';track.cues[2].display_word_indices=[3];assert.match(verifyCaptionFrames(ccsd,track).reason,/Future/);
});
test('missing frame rate and enabled publication fail closed',()=>{
 const {ccsd,track}=fixture();delete ccsd.fps;assert.match(verifyCaptionFrames(ccsd,track).reason,/fps/);
 ccsd.fps=30;assert.match(verifyCaptionFrames(ccsd,track).reason,/renderer fps/);
 ccsd.fps=24;track.publication_enabled=true;assert.match(verifyCaptionFrames(ccsd,track).reason,/Publication/);
});

test('caption visible only in scene gap is rejected like the real composition',()=>{
 const ccsd={fps:24,publication_enabled:false,scenes:[{id:'a',start:1,end:2,audio:{dialogue:[{speaker:'dave',text:'Stop'}]}}]};
 const track={status:'PASS',publication_enabled:false,cues:[{start:0,end:.1,text:'Stop',word:'Stop',speaker:'dave',scene_id:'a',observed_word_index:0,source_word_indices:[0],display_word_indices:[0]}]};
 const r=verifyCaptionFrames(ccsd,track);assert.equal(r.status,'BLOCKED');assert.equal(r.visible_word_count,0);assert.deepEqual(r.missing_word_indices,[0]);
 track.cues[0].start=1;track.cues[0].end=1.1;assert.equal(verifyCaptionFrames(ccsd,track).status,'PASS');
});
