"""Pure mocked observations. No ASR, model loading, render, network, or real media."""
import hashlib
import importlib.util
import json
from pathlib import Path
import runpy
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('observer_under_test', ROOT/'scripts/observe_preview_asr.py')
observer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(observer)


class PassiveObserverTests(unittest.TestCase):
    def test_allowlist_rejects_text_paths_secrets_and_unbounded_values(self):
        sentinel = 'PRIVATE_TRANSCRIPT_TOKEN_PATH_SENTINEL'
        raw = {'status': [], 'model_path':sentinel,'token':sentinel,'versions':{'numpy':sentinel,'unknown':sentinel},
            'cpu':{'vendor':[],'architecture':{},'model_name':sentinel,'features':{'avx2':True,'secret':sentinel}},
            'backend':{'device':[],'compute_type':{},'effective_compute_type':'int8'},
            'decoded_samples':{'dtype':[],'sample_count':10**1000,'bytes':sentinel},
            'resolved_options':{'initial_prompt':sentinel,'temperature':[float('nan')]},
            'model_files':{'privatefile':sentinel,'model.bin':'a'*64},
            'segment_scalars':[{'text':sentinel,'tokens':[42],'temperature':0.4,'avg_logprob':float('nan')}]*100}
        result = observer.public_summary(raw)
        serialized=json.dumps(result,allow_nan=False)
        self.assertNotIn(sentinel,serialized)
        self.assertNotIn('initial_prompt',serialized)
        self.assertLess(len(serialized),12000)
        self.assertEqual(len(result['segment_scalars']),64)
        self.assertFalse(result['available']['model_revision'])
        self.assertIn('not_loaded_weights_attestation',result['model_hash_scope'])

    def test_no_eager_consumption_or_segment_mutation(self):
        with patch.object(observer,'host_metadata',return_value={'cpu':{}}):obj=observer.Observer()
        segment=types.SimpleNamespace(text='PRIVATE_TEXT',temperature=.6,avg_logprob=-.4,no_speech_prob=.1,compression_ratio=1.5,start=0,end=1)
        original=vars(segment).copy()
        frame=types.SimpleNamespace(f_globals={'__name__':'faster_whisper.transcribe'},
            f_code=types.SimpleNamespace(co_qualname='WhisperModel.generate_segments'),f_locals={})
        self.assertIsNone(obj.profile(frame,'return',segment))
        self.assertEqual(vars(segment),original)
        self.assertEqual(obj.report['observed_segment_count'],1)
        self.assertEqual(obj.report['segment_scalars'][0]['temperature'],.6)
        self.assertNotIn('PRIVATE_TEXT',json.dumps(observer.public_summary(obj.report)))
        obj.profile(frame,'return',None)
        self.assertEqual(obj.report['observed_segment_count'],1)

    def test_observation_errors_do_not_escape_or_log_exception(self):
        with patch.object(observer,'host_metadata',return_value={'cpu':{}}):obj=observer.Observer()
        frame=types.SimpleNamespace(f_globals={'__name__':'faster_whisper.transcribe'},
            f_code=types.SimpleNamespace(co_qualname='WhisperModel.__init__'),f_locals={})
        obj.profile(frame,'return',None)
        self.assertEqual(obj.report['observer_errors'],1)
        self.assertNotIn('model_path',json.dumps(observer.public_summary(obj.report)))

    def test_argv_receipt_options_and_generator_order_unchanged(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);model=root/'private-user-path/snapshots'/('a'*40);model.mkdir(parents=True)
            (model/'model.bin').write_bytes(b'explicitly synthetic model fixture')
            (model/'secret.txt').write_text('PRIVATE_SECRET')
            module=types.ModuleType('faster_whisper.transcribe')
            module.MODEL_PATH=str(model);module.CALLS=[]
            exec('''
from types import SimpleNamespace
class Samples:
    ndim=1
    size=2
    dtype='float32'
    def tobytes(self, order='C'):return b'synthetic-samples'
class WhisperModel:
    def __init__(self, model_size_or_path, device='auto', compute_type='default', cpu_threads=0, num_workers=1):
        model_path=MODEL_PATH
        CALLS.append(('init',model_size_or_path,device,compute_type,cpu_threads,num_workers))
        self.model=SimpleNamespace(device=device,compute_type=compute_type)
    def transcribe(self,audio,beam_size=5,best_of=5,word_timestamps=True,vad_filter=True,condition_on_previous_text=True,temperature=(0,.2,.4,.6,.8,1),suppress_tokens=None,clip_timestamps='0'):
        CALLS.append(('transcribe',beam_size,best_of,word_timestamps,vad_filter,condition_on_previous_text,temperature,suppress_tokens,clip_timestamps))
        self.audio=audio
        return self.generate_segments(),None
    def generate_segments(self):
        for index in range(2):
            CALLS.append(('yield',index))
            yield SimpleNamespace(text='PRIVATE_TRANSCRIPT',start=index,end=index+1,temperature=.2,avg_logprob=-.3,no_speech_prob=.1,compression_ratio=1.2)
''',module.__dict__)
            producer=root/'producer.py';receipt=root/'receipt.json'
            producer.write_text("import sys,json\nfrom pathlib import Path\nfrom faster_whisper.transcribe import WhisperModel,Samples\nm=WhisperModel('base.en',device='cpu',compute_type='int8')\naudio=Samples()\nsegments,info=m.transcribe(audio,suppress_tokens=[-1,2,3])\nassert m.audio is audio\nPath(sys.argv[1]).write_text(json.dumps({'argv':sys.argv,'text':[s.text for s in segments]},sort_keys=True))\n")
            arguments=[str(receipt),'--full-audio','--spoken-numbers']
            oldargv=sys.argv
            with patch.dict(sys.modules,{'faster_whisper.transcribe':module}):
                try:
                    sys.argv=[str(producer),*arguments];runpy.run_path(str(producer),run_name='__main__')
                finally:sys.argv=oldargv
                original=receipt.read_bytes();calls=list(module.CALLS);module.CALLS.clear()
                with patch.object(observer,'host_metadata',return_value={'cpu':{}}):
                    observer.observe_producer(producer,arguments,root/'observed.json')
                self.assertEqual(receipt.read_bytes(),original)
                self.assertEqual(module.CALLS,calls)
                self.assertIs(sys.argv,oldargv)
                self.assertIsNone(sys.getprofile())
            report=json.loads((root/'observed.json').read_text())
            self.assertEqual(report['model_revision'],'a'*40)
            self.assertEqual(report['model_files']['model.bin'],hashlib.sha256(b'explicitly synthetic model fixture').hexdigest())
            self.assertEqual(report['decoded_samples']['sha256'],hashlib.sha256(b'synthetic-samples').hexdigest())
            self.assertEqual(report['observed_segment_count'],2)
            self.assertEqual(report['segment_scalars'][0]['temperature'],.2)
            self.assertFalse(report['decoder_options_changed'])
            self.assertNotIn('start',report['segment_scalars'][0])
            self.assertNotIn('end',report['segment_scalars'][0])
            self.assertIn('before_VAD_timestamp_restoration',report['segment_scalar_basis'])
            text=json.dumps(report)
            for secret in ['PRIVATE_TRANSCRIPT','PRIVATE_SECRET',str(root),'model_path','secret.txt']:
                self.assertNotIn(secret,text)

    def test_observer_write_failure_never_masks_primary_outcome(self):
        for source,exception in [('pass',None),('raise SystemExit(7)',SystemExit),('raise ValueError("PRIVATE_EXCEPTION")',ValueError)]:
            with self.subTest(exception=exception),tempfile.TemporaryDirectory() as temporary:
                root=Path(temporary);producer=root/'producer.py';producer.write_text(source)
                before=sys.argv
                with patch.object(observer,'host_metadata',return_value={'cpu':{}}), \
                     patch.object(observer.Path,'write_text',side_effect=OSError('PRIVATE_WRITE_ERROR')):
                    if exception:
                        with self.assertRaises(exception) as caught:
                            observer.observe_producer(producer,[],root/'observer.json')
                        if exception is SystemExit:self.assertEqual(caught.exception.code,7)
                    else:observer.observe_producer(producer,[],root/'observer.json')
                self.assertIs(sys.argv,before);self.assertIsNone(sys.getprofile())

    def test_producer_exception_and_systemexit_preserved(self):
        for source,exception in [('raise SystemExit(7)',SystemExit),('raise ValueError("PRIVATE_EXCEPTION")',ValueError)]:
            with self.subTest(exception=exception),tempfile.TemporaryDirectory() as temporary:
                root=Path(temporary);producer=root/'producer.py';producer.write_text(source)
                before=sys.argv
                with patch.object(observer,'host_metadata',return_value={'cpu':{}}),self.assertRaises(exception) as caught:
                    observer.observe_producer(producer,['--unchanged'],root/'observer.json')
                if exception is SystemExit:self.assertEqual(caught.exception.code,7)
                self.assertIs(sys.argv,before);self.assertIsNone(sys.getprofile())
                self.assertNotIn('PRIVATE_EXCEPTION',(root/'observer.json').read_text())

if __name__=='__main__':unittest.main()
