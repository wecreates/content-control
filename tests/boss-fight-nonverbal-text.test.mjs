import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nonverbalTextAtTime, nonverbalTextLines} from '../remotion/NonverbalText.mjs';
const ccsd = JSON.parse(readFileSync(new URL('../projects/shorts/credit-score-boss-fight/ccsd.json', import.meta.url)));
const scene = ccsd.scenes.find(s => s.id === 'goblin-offer');
const beat = {id:scene.id, start:scene.start, end:scene.end};
const exactText = 'Instant credit repair. Totally legitimate.';
const changed = patch => ({...scene, visual:{text_events:[{...scene.visual.text_events[0], ...patch}]}});

test('Goblin words are explicitly visual and never assigned to an audio speaker', () => {
  assert.deepEqual(scene.audio.dialogue, []);
  assert.deepEqual(scene.visual.text_events, [{type:'nonverbal_text',character_id:'cashback_goblin',text:exactText,start:scene.start,end:scene.end}]);
  assert.ok(ccsd.scenes.flatMap(s=>s.audio.dialogue).every(d=>d.speaker!=='cashback_goblin' && d.text!==exactText));
});
test('event is visible only in its scene with inclusive start and exclusive end', () => {
  for (const time of [0,scene.start-.001,scene.end,90,NaN]) assert.equal(nonverbalTextAtTime(scene,time,beat),null);
  for (const time of [scene.start,scene.start+1/24,scene.end-.001]) assert.equal(nonverbalTextAtTime(scene,time,beat).text,exactText);
  assert.equal(nonverbalTextAtTime(ccsd.scenes[10],32,{id:'fake-button',start:29,end:32}),null);
  assert.equal(nonverbalTextAtTime(undefined,32,beat),null);
});
test('invalid voice identity, payloads and unbounded timing fail closed', () => {
  for (const patch of [{character_id:'narrator'},{character_id:'dave'},{type:'dialogue'},{text:''},{text:null},{start:scene.start-1},{end:scene.end+1},{end:scene.start},{start:NaN},{end:Infinity}]) {
    assert.throws(()=>nonverbalTextAtTime(changed(patch),scene.start,beat), /Invalid/);
  }
  assert.throws(()=>nonverbalTextAtTime(scene,scene.start,{...beat,id:'trap-snap'}),/Invalid/);
  assert.throws(()=>nonverbalTextAtTime({...scene,visual:{text_events:{}}},32,beat),/array/);
  assert.throws(()=>nonverbalTextAtTime({...scene,visual:{text_events:[...scene.visual.text_events,...scene.visual.text_events]}},scene.start,beat),/Overlapping/);
});
test('line wrapping preserves the exact source characters and readable width', () => {
  const lines=nonverbalTextLines(exactText);
  assert.equal(lines.join(''),exactText);
  assert.equal(lines.length,2);
  assert.ok(lines.every(l=>l.length<=26));
  for(const text of ['a  b   c.','A'.repeat(60),' Hello, world! ']) assert.equal(nonverbalTextLines(text).join(''),text);
  assert.throws(()=>nonverbalTextLines(exactText,0),/Invalid/);
});
test('renderer consumes event verbatim while preserving Goblin visual identity', () => {
  const renderer=readFileSync(new URL('../remotion/BossFightShortComposition.jsx',import.meta.url),'utf8');
  assert.ok(renderer.includes('nonverbalTextAtTime(scene,t,b)'));
  assert.ok(renderer.includes('nonverbalTextLines(nonverbalText.text)'));
  assert.ok(renderer.includes('data-character-id={nonverbalText.character_id}'));
  assert.ok(renderer.includes('xmlSpace="preserve"'));
  assert.ok(renderer.includes('<CashbackGoblin x={255}'));
  assert.ok(renderer.includes('{!nonverbalText?<AccentTitle'));
  assert.ok(renderer.includes('{line}</tspan>'));
  assert.ok(!renderer.includes('<Audio'));
});

test('retimed source moves visual beats and exact Goblin text together', async () => {
  const {bossFightBeats} = await import('../remotion/BossFightTimeline.mjs');
  const source = JSON.parse(readFileSync(new URL('../projects/shorts/credit-score-boss-fight/ccsd.json', import.meta.url), 'utf8'));
  const defaults = source.scenes.map(s=>({id:s.id,start:s.start,end:s.end}));
  const shifted = structuredClone(source);
  const boundary=source.scenes.find(s=>s.id==='payment-recover').end;
  for (const scene of shifted.scenes) {
    if (scene.start >= boundary) {scene.start += 2; scene.end += 2;}
    else if (scene.id === 'payment-recover') scene.end += 2;
    for (const event of scene.visual?.text_events ?? []) {event.start+=2;event.end+=2;}
  }
  const beats = bossFightBeats(shifted, defaults);
  const goblin = shifted.scenes.find(s=>s.id==='goblin-offer');
  const beat = beats.find(s=>s.id===goblin.id);
  assert.equal(beat.start,goblin.start);
  assert.equal(nonverbalTextAtTime(goblin,goblin.start,beat).text,'Instant credit repair. Totally legitimate.');
  assert.equal(beats.at(-1).end,source.scenes.at(-1).end+2);
  for (const change of [s=>s.scenes[1].start++,s=>s.scenes[0].id='other',s=>s.scenes.at(-1).end=91]) {
    const invalid=structuredClone(source);change(invalid);assert.throws(()=>bossFightBeats(invalid,defaults));
  }
});

 test('spoken captions use the observed-time renderer lookup and preserve Goblin overlay',()=>{
 const renderer=readFileSync(new URL('../remotion/BossFightShortComposition.jsx',import.meta.url),'utf8');
 assert.ok(renderer.includes('captionAtTime(ccsd?.caption_track,t)'));
 assert.ok(renderer.includes('data-caption-speaker={spokenCaption.speaker}'));
 assert.ok(renderer.includes('nonverbalTextAtTime(scene,t,b)'));
 });
