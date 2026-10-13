import test from 'node:test';import assert from 'node:assert/strict';
import {v2FeeLabelBaseline} from '../remotion/StudioLayout.mjs';
test('fee label clears jaw envelope throughout opening and stays below caption reserve',()=>{
 for(let i=0;i<=1000;i++){const open=i/1000,baseline=v2FeeLabelBaseline(open),jawTop=-90-27*open-2.5;
  assert.ok(jawTop-(baseline+6)>=5.5-1e-10,'gap after stroke and text descent');
  const labelTopWorld=500+(baseline-31)*.8;
  assert.ok(400+(labelTopWorld-400)*1.14*1.035>320,'label top below caption reserve including maximum camera');
 }
});
