"""Offline immutable decoder/receipt identity and source-change regressions."""
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock
from scripts import free_transcription_qa as producer


class TranscriptionAudioIdentityTests(unittest.TestCase):
    def test_decoder_gets_private_snapshot_of_exact_hashed_bytes(self):
        with tempfile.TemporaryDirectory() as temporary:
            source=Path(temporary)/'source';original=b'original audio fixture';source.write_bytes(original)
            seen=[]
            def decode(path):
                seen.append(path)
                self.assertNotEqual(path,source)
                source.write_bytes(b'replacement')
                self.assertEqual(path.read_bytes(),original)
                return 'samples',20
            with mock.patch.object(producer,'decode_transcription_audio',side_effect=decode):
                samples,duration,digest=producer.decode_bound_audio(source)
            self.assertEqual((samples,duration),('samples',20))
            self.assertEqual(digest,hashlib.sha256(original).hexdigest())
            self.assertFalse(seen[0].exists())

    def test_temporary_copy_is_removed_after_decode_failure(self):
        with tempfile.TemporaryDirectory() as temporary:
            source=Path(temporary)/'source';source.write_bytes(b'fixture');seen=[]
            def decode(path):
                seen.append(path);raise ValueError('bad audio')
            with mock.patch.object(producer,'decode_transcription_audio',side_effect=decode):
                with self.assertRaises(ValueError):producer.decode_bound_audio(source)
            self.assertFalse(seen[0].exists())

    def test_empty_oversized_and_fifo_inputs_fail_without_decoding(self):
        with tempfile.TemporaryDirectory() as temporary:
            source=Path(temporary)/'source'
            for data in [b'',b'12345']:
                source.write_bytes(data)
                with self.assertRaises(ValueError):producer.audio_snapshot(source,limit=4)
            if hasattr(os,'mkfifo') and hasattr(os,'O_NONBLOCK'):
                fifo=Path(temporary)/'fifo';os.mkfifo(fifo)
                with self.assertRaises(ValueError):producer.audio_snapshot(fifo)

    def run_producer(self,change):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);audio=root/'audio';original=b'original fixture';audio.write_bytes(original)
            sentence='We pay twenty dollars today and keep the remaining sixty dollars.'
            text=' '.join([sentence]*4);contract=root/'contract.json'
            contract.write_text(json.dumps({'narration_text':text,'publication_enabled':False}))
            output=root/'receipt.json'
            class Recognizer:
                def __init__(self,*args,**kwargs):pass
                def transcribe(self,*args,**kwargs):
                    def lazy():
                        if change=='replace':audio.write_bytes(b'different bytes after decode')
                        if change=='remove':audio.unlink()
                        yield SimpleNamespace(start=0,end=20,text=text,words=[])
                    return lazy(),SimpleNamespace(language='en')
            args=['producer','--audio',str(audio),'--contract',str(contract),'--output',str(output)]
            with mock.patch.dict(sys.modules,{'faster_whisper':SimpleNamespace(WhisperModel=Recognizer)}),mock.patch.object(producer,'decode_transcription_audio',return_value=(object(),20)),mock.patch('importlib.metadata.version',return_value='fixture'),mock.patch.object(sys,'argv',args):
                if change:
                    with self.assertRaises(SystemExit) as failure:producer.main()
                    self.assertEqual(failure.exception.code,2)
                else:producer.main()
            result=json.loads(output.read_text())
            self.assertEqual(result['audio_sha256'],hashlib.sha256(original).hexdigest())
            return result

    def test_source_replaced_during_inference_fails_with_original_identity(self):
        result=self.run_producer('replace')
        self.assertEqual(result['status'],'FAIL')
        self.assertFalse(result['checks']['audio_source_unchanged'])
        self.assertIn('audio_source_unchanged',result['failed_checks'])

    def test_source_removed_during_inference_fails_with_original_identity(self):
        self.assertEqual(self.run_producer('remove')['status'],'FAIL')

    def test_unchanged_source_passes_with_snapshot_identity(self):
        result=self.run_producer(None)
        self.assertEqual(result['status'],'PASS')
        self.assertTrue(result['checks']['audio_source_unchanged'])
