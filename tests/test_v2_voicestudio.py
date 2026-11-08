import copy
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct
import tempfile
import unittest
import wave
from scripts.v2_voicestudio import generate, MODEL, MODEL_REVISION, UPSTREAM_REVISION

@unittest.skipUnless(shutil.which('ffmpeg'), 'ffmpeg required')
class VoiceStudioTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name); self.out=self.root/'clips'
        self.cc={'publication_enabled':False,'scenes':[{'id':'one','start':0,'end':2,'audio':{'dialogue':[{'speaker':'narrator','text':'Hello.'}]}}]}
    def tearDown(self): self.tmp.cleanup()
    def synth(self, request, raw):
        samples=[round(math.sin(i*.1)*1000) for i in range(12000)]
        with wave.open(str(raw),'wb') as w:
            w.setparams((1,2,24000,0,'NONE','not compressed')); w.writeframes(struct.pack('<'+'h'*len(samples),*samples))
        return {'status':'PASS','tool':'voicestudio','operation':'synthesize','engine':'kittentts','model':MODEL,'model_revision':MODEL_REVISION,'upstream_revision':UPSTREAM_REVISION,'voice':request['voice'],'speed':request['speed'],'language':'en','text_sha256':hashlib.sha256(request['text'].encode()).hexdigest(),'output_sha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'synthetic':True,'publication_enabled':False,'paid_generation_enabled':False,'watermark_applied':False}
    def run_generate(self, synth=None): return generate(self.cc,self.out,self.root,self.root,synth or self.synth)
    def test_exact_text_preserved_format_and_true_provider(self):
        before=copy.deepcopy(self.cc); m=self.run_generate(); self.assertEqual(self.cc,before)
        self.assertEqual(m['provider'],'voicestudio'); self.assertEqual(m['model_repository'],MODEL)
        request=json.loads((self.out/'00-request.json').read_text()); self.assertEqual(request['text'],'Hello.')
        with wave.open(str(self.out/m['clips'][0]['file'])) as w: self.assertEqual((w.getnchannels(),w.getframerate(),w.getsampwidth()),(2,44100,2))
    def test_preserve_existing_output(self):
        self.run_generate(); before={p.name:p.read_bytes() for p in self.out.iterdir()}
        with self.assertRaises(FileExistsError): self.run_generate()
        self.assertEqual(before,{p.name:p.read_bytes() for p in self.out.iterdir()})
    def test_overflow_never_truncated_or_committed(self):
        self.cc['scenes'][0]['end']=.3
        with self.assertRaisesRegex(ValueError,'exceeds'): self.run_generate()
        self.assertFalse(self.out.exists())
    def test_bad_provenance_never_committed(self):
        def bad(request,raw):
            r=self.synth(request,raw);r['model_revision']='other';return r
        with self.assertRaisesRegex(ValueError,'provenance'): self.run_generate(bad)
        self.assertFalse(self.out.exists())
    def test_paid_and_publication_flags_rejected(self):
        for key in ['publication_enabled','paid_generation_enabled']:
            def bad(request,raw):
                r=self.synth(request,raw);r[key]=True;return r
            with self.assertRaises(ValueError): self.run_generate(bad)
    def test_publication_ccsd_rejected(self):
        self.cc['publication_enabled']=True
        with self.assertRaises(ValueError): self.run_generate()
    def test_nonverbal_role_rejected(self):
        self.cc['scenes'][0]['audio']['dialogue'][0]['speaker']='cashback_goblin'
        with self.assertRaisesRegex(ValueError,'nonverbal'): self.run_generate()
    def test_invalid_speed_rejected(self):
        for speed in [True,float('nan'),0,2]:
            self.cc['scenes'][0]['audio']['dialogue'][0]['performance']={'synthesis_speed':speed}
            with self.assertRaises(ValueError): self.run_generate()
    def test_real_handoff_and_receipt_tampering(self):
        from scripts.v2_audio_assemble import assemble
        m=self.run_generate(); target=self.root/'voice.wav'
        self.assertEqual(assemble(self.cc,m,self.out,target)['status'],'PASS')
        clip=m['clips'][0]; receipt=self.out/clip['generation_file']; before=receipt.read_bytes()
        receipt.write_text('{}')
        with self.assertRaisesRegex(ValueError,'hash'): assemble(self.cc,m,self.out,target)
        receipt.write_bytes(before); source=self.out/clip['source_file']; source.write_bytes(b'bad')
        with self.assertRaisesRegex(ValueError,'hash'): assemble(self.cc,m,self.out,target)
    def test_missing_and_traversal_provenance_rejected(self):
        from scripts.v2_audio_assemble import assemble
        m=self.run_generate(); target=self.root/'voice.wav'; c=m['clips'][0]
        c['generation_file']='../outside.json'
        with self.assertRaisesRegex(ValueError,'path'): assemble(self.cc,m,self.out,target)
        c['generation_file']='missing.json'
        with self.assertRaises(OSError): assemble(self.cc,m,self.out,target)
    def test_receipt_wrong_voice_even_with_updated_hash_rejected(self):
        from scripts.v2_audio_assemble import assemble
        m=self.run_generate(); c=m['clips'][0]; p=self.out/c['generation_file']
        r=json.loads(p.read_text()); r['voice']='expr-voice-3-m'; p.write_text(json.dumps(r))
        c['generation_sha256']=hashlib.sha256(p.read_bytes()).hexdigest()
        with self.assertRaisesRegex(ValueError,'receipt'): assemble(self.cc,m,self.out,self.root/'out.wav')
    def test_receipt_fifo_rejected_without_blocking(self):
        import os
        from scripts.v2_audio_assemble import assemble
        m=self.run_generate(); p=self.out/m['clips'][0]['generation_file']; p.unlink(); os.mkfifo(p)
        with self.assertRaisesRegex(ValueError,'regular'): assemble(self.cc,m,self.out,self.root/'out.wav')
    def test_memory_accepts_pinned_receipt_but_rejects_provider_drift(self):
        from scripts.production_memory import snapshot
        m=self.run_generate(); ccsd=self.root/'ccsd.json'; ccsd.write_text(json.dumps(self.cc))
        candidate=self.root/'candidate.mp4'; candidate.write_bytes(b'fixture, not real video')
        qa={'publication_enabled':False,'status':'PASS','candidate_sha256':hashlib.sha256(candidate.read_bytes()).hexdigest(),'checks':dict.fromkeys(('decodes','complete_av_decode','audio_present','audio_audible','audio_covers_video','duration_match','no_black','no_duplicate_run','motion_alive','safe_border','publication_disabled'),True)}
        qp=self.root/'qa.json'; qp.write_text(json.dumps(qa)); mp=self.out/'approved-manifest.json'
        result=snapshot(ccsd,mp,candidate,qp)
        self.assertFalse(result['production_approved']); self.assertEqual(len(result['clip_sources']),3)
        baseline=copy.deepcopy(result); baseline['selected_voice_policy']['provider']='kokoro'
        with self.assertRaisesRegex(ValueError,'Selected voice policy drift'):snapshot(ccsd,mp,candidate,qp,baseline=baseline)
        m['model_revision']='wrong';mp.write_text(json.dumps(m))
        with self.assertRaisesRegex(ValueError,'provider'):snapshot(ccsd,mp,candidate,qp)
