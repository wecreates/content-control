"""Offline producer/workflow regressions; no model/provider/network calls."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock
from scripts import free_transcription_qa as producer
from scripts.segment_observed_words import derive

ROOT=Path(__file__).resolve().parents[1]
WORKFLOW=ROOT/'.github/workflows/narration-transcription-gate.yml'


def step(name):
    block=WORKFLOW.read_text().split('      - name: '+name+'\n',1)[1].split('      - ',1)[0]
    return '\n'.join(line[10:] for line in block.split('        run: |\n',1)[1].splitlines() if line.startswith('          '))


class WordTimedWorkflowTests(unittest.TestCase):
    def check_decoder_mode(self, full_audio):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);audio=root/'audio';audio.write_bytes(b'Synthetic audio fixture')
            sentence='We pay twenty dollars today and keep the remaining sixty dollars.'
            text=' '.join([sentence]*4)
            contract=root/'contract.json';contract.write_text(json.dumps({'publication_enabled':False,
                'narration_text':text,'caption_cues':[{'start':0,'end':1,'text':text}]}))
            output=root/'raw.json';observed={}
            class Recognizer:
                def __init__(self,*args,**kwargs):
                    self.hf_tokenizer=SimpleNamespace(get_vocab=lambda:{})
                def transcribe(self,*args,**kwargs):
                    observed.update(kwargs)
                    return iter([SimpleNamespace(start=0,end=20,text=text,words=[])]),SimpleNamespace(language='en')
            args=['producer','--audio',str(audio),'--contract',str(contract),'--output',str(output),'--spoken-numbers']
            if full_audio:args.append('--full-audio')
            with mock.patch.dict(sys.modules,{'faster_whisper':SimpleNamespace(WhisperModel=Recognizer)}),mock.patch.object(producer,'decode_transcription_audio',return_value=(object(),20)),mock.patch('importlib.metadata.version',return_value='fixture'),mock.patch.object(sys,'argv',args):
                if full_audio:producer.main()
                else:
                    with self.assertRaises(SystemExit) as failure:producer.main()
                    self.assertEqual(failure.exception.code,2)
            report=json.loads(output.read_text())
            self.assertEqual(observed['clip_timestamps'],'0' if full_audio else '0,1.0')
            self.assertNotIn('initial_prompt',observed)
            self.assertEqual(report['full_audio_decoding'],full_audio)
            self.assertTrue(report['spoken_number_decoding'])

    def test_full_audio_flag_does_not_clip_at_contract_end(self):
        self.check_decoder_mode(True)

    def test_default_without_full_audio_preserves_contract_end_clipping(self):
        self.check_decoder_mode(False)

    def test_workflow_uses_fresh_raw_full_spoken_input_before_derivation(self):
        shell=step('Transcribe actual narration and compare to approved script')
        self.assertIn('--model base.en --spoken-numbers --full-audio',shell)
        self.assertIn('--output state/narration-transcription-raw.json',shell)
        self.assertLess(shell.index('free_transcription_qa.py'),shell.index('segment_observed_words.py'))
        text=WORKFLOW.read_text()
        self.assertIn('state/narration-transcription-raw.json',text.split('name: narration-transcription-health',1)[1])

    def test_failed_asr_step_never_calls_segmentation(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);binary=root/'bin';binary.mkdir();log=root/'calls'
            python=binary/'python';python.write_text('#!/bin/sh\necho "$*" >> "$CALLS"\nexit 17\n');python.chmod(0o755)
            result=subprocess.run(['bash','-e','-o','pipefail','-c',step('Transcribe actual narration and compare to approved script')],
                cwd=root,env={**os.environ,'PATH':str(binary)+':'+os.environ['PATH'],'CALLS':str(log)},capture_output=True)
            self.assertEqual(result.returncode,17)
            self.assertNotIn('segment_observed_words.py',log.read_text())

    def test_verify_mode_checks_without_overwriting_tampered_output(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);audio=root/'audio';audio.write_bytes(b'Synthetic fixture')
            raw={'status':'PASS','publication_enabled':False,'audio_sha256':hashlib.sha256(audio.read_bytes()).hexdigest(),
                 'actual_transcript':'Keep twenty dollars.','media_duration_seconds':2,'transcribed_duration_seconds':2,
                 'segments':[{'start':0,'end':2,'text':'Keep twenty dollars.'}],
                 'words':[{'start':0,'end':.5,'word':'Keep'},{'start':.5,'end':1,'word':'twenty'},{'start':1,'end':2,'word':'dollars.'}]}
            source=root/'raw.json';source.write_text(json.dumps(raw));output=root/'derived.json'
            output.write_text(json.dumps(derive(source.read_bytes(),audio.read_bytes())))
            cmd=[sys.executable,str(ROOT/'scripts/segment_observed_words.py'),'--receipt',str(source),'--audio',str(audio),'--output',str(output),'--verify']
            self.assertEqual(subprocess.run(cmd,capture_output=True).returncode,0)
            invalid=json.loads(output.read_text());invalid['segments'][0]['end']=1.8;output.write_text(json.dumps(invalid));before=output.read_bytes()
            self.assertEqual(subprocess.run(cmd,capture_output=True).returncode,2)
            self.assertEqual(output.read_bytes(),before)

    def test_reconcile_verifies_retained_raw_before_caption_build(self):
        text=(ROOT/'.github/workflows/candidate-state-reconcile.yml').read_text()
        self.assertIn('--output state/narration-transcription-health.json --verify',text)
        self.assertLess(text.index('Verify retained word timing provenance'),text.index('Reconcile verified captions without rerender'))

    def test_preparation_invalidates_raw_before_audio_read(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);(root/'state').mkdir()
            raw=root/'state/narration-transcription-raw.json';raw.write_text('{"status":"PASS"}')
            result=subprocess.run(['bash','-e','-c',step('Prepare fresh transcription failure receipt')],cwd=root,capture_output=True)
            self.assertNotEqual(result.returncode,0)
            self.assertEqual(json.loads(raw.read_text())['status'],'FAIL')
