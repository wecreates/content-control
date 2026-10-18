import copy,hashlib,tempfile,unittest
from pathlib import Path
from scripts.v2_clip_transcription import transcribe_windows
class ClipTranscriptionTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.audio=Path(self.tmp.name)/'audio';self.audio.write_bytes(b'fixture')
  self.cc={'publication_enabled':False,'scenes':[{'id':'a','start':0,'audio':{'dialogue':[{'speaker':'dave','text':'You summoned'}]}},{'id':'b','start':2,'audio':{'dialogue':[{'speaker':'monk','text':'Me'}]}}]}
  self.receipt={'status':'PASS','publication_enabled':False,'audio_sha256':hashlib.sha256(b'fixture').hexdigest(),'duration':3,'dialogue':[{'scene_id':'a','speaker':'dave','start':0,'end':1.5},{'scene_id':'b','speaker':'monk','start':2,'end':3}]}
  self.calls=[]
 def tearDown(self):self.tmp.cleanup()
 def observe(self,samples):
  self.calls.append(len(samples))
  return [{'word':'You','start':0,'end':.4},{'word':'summoned','start':.4,'end':1.4}] if len(samples)==24000 else [{'word':'Me','start':.1,'end':.8}]
 def build(self,observe=None):return transcribe_windows(self.cc,self.receipt,self.audio,[0]*48000,observe or self.observe)
 def test_crop_and_offset_preserve_observed_times_without_script_hints(self):
  r=self.build();self.assertEqual(self.calls,[24000,16000]);self.assertEqual(r['words'][-1]['start'],2.1);self.assertEqual(r['words'][-1]['end'],2.8);self.assertEqual(r['words'][-1]['speaker'],'monk')
 def test_incorrect_word_not_replaced_by_script(self):
  def incorrect(s):
   words=self.observe(s);words[1]['word']='summon';return words
  with self.assertRaisesRegex(ValueError,'differ'):self.build(incorrect)
 def test_asr_cannot_stretch_word_into_next_character(self):
  def stretched(s):
   words=self.observe(s);words[-1]['end']=2.5;return words
  with self.assertRaisesRegex(ValueError,'outside'):self.build(stretched)
 def test_invalid_receipts_rejected_before_asr(self):
  for patch in [{'status':'FAIL'},{'audio_sha256':'wrong'},{'publication_enabled':True},{'duration':4},{'dialogue':[]}]:
   original=copy.deepcopy(self.receipt);self.receipt.update(patch)
   with self.assertRaises(ValueError):self.build()
   self.assertEqual(self.calls,[]);self.receipt=original

 def test_overlap_wrong_speaker_and_nonfinite_window_block(self):
  for patch in [{'start':1},{'end':float('nan')},{'speaker':'dave'}]:
   original=copy.deepcopy(self.receipt);self.receipt['dialogue'][1].update(patch)
   with self.assertRaises(ValueError):self.build()
   self.assertEqual(self.calls,[]);self.receipt=original


class FractionalAssemblyWindowTests(unittest.TestCase):
 """Real PCM assembly/decoding with an explicitly synthetic observer, never ASR."""
 def setUp(self):
  import math,struct,wave
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
  self.root=Path(self.tmp.name);clip=self.root/'synthetic-tone.wav';rate=44100
  self.start=312375/rate;self.frames=185220
  pcm=b''.join(struct.pack('<hh',value,value) for value in
      (round(2000*math.sin(i*.1)) for i in range(self.frames)))
  with wave.open(str(clip),'wb') as output:
   output.setnchannels(2);output.setsampwidth(2);output.setframerate(rate);output.writeframes(pcm)
  self.cc={'publication_enabled':False,'fps':24,'scenes':[{'id':'fractional','start':self.start,'end':12,
       'audio':{'dialogue':[{'speaker':'dave','text':'Watch.'}]}}]}
  manifest={'publication_enabled':False,'provider':'kokoro','model_id':'Kokoro-82M',
       'voice_assignments':{'dave':'am_fenrir'},'clips':[{'scene_id':'fractional','speaker':'dave',
       'voice_id':'am_fenrir','file':clip.name,'text_sha256':hashlib.sha256(b'Watch.').hexdigest(),
       'audio_sha256':hashlib.sha256(clip.read_bytes()).hexdigest()}]}
  self.manifest=manifest;self.audio=self.root/'assembled.wav';self.rebuild()
 def rebuild(self):
  import array,subprocess,sys
  from scripts.v2_audio_assemble import assemble
  self.receipt=assemble(self.cc,self.manifest,self.root,self.audio)
  decoded=subprocess.run(['ffmpeg','-nostdin','-v','error','-i',str(self.audio),
       '-map','0:a:0','-vn','-ac','1','-ar','16000','-f','f32le','pipe:1'],
       capture_output=True,check=True,timeout=10).stdout
  self.samples=array.array('f');self.samples.frombytes(decoded)
  if sys.byteorder!='little':self.samples.byteswap()
  self.seen=[]
 def observe(self,samples):
  self.seen.append(samples[:])
  return [{'word':'Watch.','start':0.0,'end':.2}]
 def test_fractional_pcm_window_crops_inward_and_preserves_observed_offset(self):
  from scripts.v2_captions import build_captions
  report=transcribe_windows(self.cc,self.receipt,self.audio,self.samples,self.observe)
  window=report['windows'][0]
  self.assertEqual((window['sample_start'],window['sample_end']),(113334,180533))
  self.assertEqual(self.seen[0].tolist(),self.samples[113334:180533].tolist())
  self.assertGreaterEqual(window['sample_start']/16000,window['assembly_start'])
  self.assertLessEqual(window['sample_end']/16000,window['assembly_end'])
  self.assertEqual(report['words'][0]['start'],113334/16000)
  self.assertEqual(report['words'][0]['end'],.2+113334/16000)
  self.assertEqual(report['audio_sha256'],hashlib.sha256(self.audio.read_bytes()).hexdigest())
  before=copy.deepcopy(report);captions=build_captions(self.cc,report,self.audio)
  self.assertEqual(report,before);self.assertEqual(captions['status'],'PASS')
  self.assertIs(captions['publication_enabled'],False)
  self.assertEqual(captions['cues'][0]['start'],report['words'][0]['start'])
 def test_subsample_window_blocks_before_observation(self):
  self.receipt['dialogue'][0]['end']=self.start+1/44100
  with self.assertRaisesRegex(ValueError,'no complete decoded samples'):
   transcribe_windows(self.cc,self.receipt,self.audio,self.samples,self.observe)
  self.assertEqual(self.seen,[])
 def test_assembly_rounding_before_scene_still_crops_inside_nominal_window(self):
  from scripts.v2_captions import build_captions
  self.cc['scenes'][0]['start']=.10001;self.rebuild()
  self.assertEqual(self.receipt['dialogue'][0]['start'],.1)
  report=transcribe_windows(self.cc,self.receipt,self.audio,self.samples,self.observe)
  self.assertEqual(report['windows'][0]['sample_start'],1601)
  self.assertEqual(report['words'][0]['start'],1601/16000)
  self.assertEqual(build_captions(self.cc,report,self.audio)['status'],'PASS')
 def test_next_speaker_rounded_late_cannot_extend_previous_observation(self):
  from scripts.v2_captions import build_captions
  first=copy.deepcopy(self.cc['scenes'][0]);first.update(id='first',start=0,end=4.19999)
  second=copy.deepcopy(first);second.update(id='second',start=4.19999,end=9)
  self.cc['scenes']=[first,second]
  clip=self.manifest['clips'][0]
  self.manifest['clips']=[{**clip,'scene_id':'first'},{**clip,'scene_id':'second'}]
  self.rebuild();self.assertEqual(self.receipt['dialogue'][0]['end'],4.2)
  def observe(samples):return [{'word':'Watch.','start':0,'end':len(samples)/16000}]
  report=transcribe_windows(self.cc,self.receipt,self.audio,self.samples,observe)
  self.assertEqual(report['windows'][0]['sample_end'],67199)
  self.assertLessEqual(report['words'][0]['end'],second['start'])
  self.assertEqual(build_captions(self.cc,report,self.audio)['status'],'PASS')
 def test_word_outside_corrected_sample_window_remains_blocked(self):
  def escaped(samples):return [{'word':'Watch.','start':0,'end':len(samples)/16000+1/16000}]
  with self.assertRaisesRegex(ValueError,'outside speech window'):
   transcribe_windows(self.cc,self.receipt,self.audio,self.samples,escaped)
 def test_exact_audio_hash_is_required_before_observation(self):
  self.receipt['audio_sha256']='0'*64
  with self.assertRaisesRegex(ValueError,'exact audio'):
   transcribe_windows(self.cc,self.receipt,self.audio,self.samples,self.observe)
  self.assertEqual(self.seen,[])


class CaptionObservationWorkflowTests(unittest.TestCase):
 def test_window_observation_is_required_and_selected_without_waiving_content_qa(self):
  import re
  workflow=(Path(__file__).resolve().parents[1]/'.github/workflows/content-control-v2.yml').read_text()
  observe=re.search(r'^      - name: Observe caption words within exact assembled speech windows\n(.*?)(?=^      - )',workflow,re.M|re.S)
  self.assertIsNotNone(observe)
  self.assertNotIn('continue-on-error',observe.group(1))
  self.assertIn('--assembly state/v2/receipts/voice.json --audio state/v2/voice.wav',observe.group(1))
  self.assertIn('--out state/v2/receipts/clip-transcription.json',observe.group(1))
  caption=re.search(r'^      - name: Align captions to actual spoken words\n(.*?)(?=^      - )',workflow,re.M|re.S)
  self.assertIn('--transcription state/v2/receipts/clip-transcription.json --audio state/v2/voice.wav',caption.group(1))
  whole=re.search(r'^      - name: Transcribe actual free narration\n(.*?)(?=^      - )',workflow,re.M|re.S)
  self.assertNotIn('continue-on-error',whole.group(1))
  self.assertIn('python scripts/free_transcription_qa.py',whole.group(1))
  self.assertIn('--output state/v2/receipts/transcription.json',whole.group(1))


if __name__=='__main__':unittest.main()
