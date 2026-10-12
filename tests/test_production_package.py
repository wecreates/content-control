import json
from pathlib import Path
import tempfile
import unittest
from scripts.production_package import REQUIRED, caption_files, package, sha, timestamp


class PackageTests(unittest.TestCase):
    def test_measured_caption_intervals_are_preserved(self):
        track={'status':'PASS','publication_enabled':False,'cues':[{'start':1.125,'end':2.375,'text':'A real phrase'},{'start':3,'end':4.2,'text':'Next phrase'}]}
        srt,vtt=caption_files(track,5)
        self.assertIn('00:00:01,125 --> 00:00:02,375',srt)
        self.assertIn('00:00:03.000 --> 00:00:04.200',vtt)
        self.assertTrue(vtt.startswith('WEBVTT\n\n'))
        self.assertEqual(timestamp(3661.007,','),'01:01:01,007')

    def test_invalid_caption_timing_and_failed_report_reject(self):
        for cue in [{'start':2,'end':1,'text':'bad'},{'start':0,'end':6,'text':'bad'},{'start':float('nan'),'end':2,'text':'bad'}]:
            with self.assertRaises(ValueError):
                caption_files({'status':'PASS','publication_enabled':False,'cues':[cue]},5)
        with self.assertRaises(ValueError):
            caption_files({'status':'FAIL','publication_enabled':False,'cues':[]},5)

    def test_stale_failed_and_incomplete_qa_reject_before_packaging(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);candidate=root/'candidate.mp4';candidate.write_bytes(b'test fixture only')
            audio=root/'voice.wav';audio.write_bytes(b'test voice fixture')
            for name in ('ccsd','metadata'):(root/(name+'.json')).write_text(json.dumps({'publication_enabled':False}))
            (root/'captions.json').write_text(json.dumps({'publication_enabled':False,'source_audio_sha256':sha(audio)}))
            good={'publication_enabled':False,'status':'PASS','checks':dict.fromkeys(REQUIRED,True),'candidate_sha256':sha(candidate)}
            for broken in [{**good,'candidate_sha256':'stale'},{**good,'status':'FAIL'},{**good,'checks':{'decodes':True}}]:
                (root/'qa.json').write_text(json.dumps(broken))
                with self.assertRaises(ValueError):
                    package(root/'ccsd.json',root/'metadata.json',candidate,root/'qa.json',root/'captions.json',root/'output')
                self.assertFalse(list((root/'output').rglob('review-package.json')))

    def test_versioned_reuse_and_tamper_rejection(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);sources={name:root/(name+'.json') for name in ('ccsd','metadata','candidate','qa','captions','audio')}
            for name,path in sources.items():path.write_text(name)
            def build(ccsd,metadata,candidate,qa,captions,out,audio):
                out.mkdir(parents=True)
                names=['captions.srt','captions.vtt','metadata.json','thumbnail.png']
                for name in names:(out/name).write_text('generated '+name)
                return {'schema_version':1,'generator':'cyzor.production_package.v1','status':'REVIEW_PACKAGE_PENDING_APPROVAL','publication_enabled':False,'production_approved':False,'inputs':{name:{'path':str(path),'sha256':sha(path)} for name,path in sources.items()},'outputs':{name:{'path':str(out/name),'sha256':sha(out/name)} for name in names}}
            args=[sources[name] for name in ('ccsd','metadata','candidate','qa','captions')]+[root/'packages',sources['audio']]
            with patch('scripts.production_package._build_package',side_effect=build) as mocked:
                first=package(*args);second=package(*args)
                self.assertEqual(mocked.call_count,1)
                self.assertEqual(first['manifest_path'],second['manifest_path'])
                sources['candidate'].write_text('repaired candidate')
                repaired=package(*args)
                self.assertNotEqual(first['manifest_path'],repaired['manifest_path'])
                self.assertTrue(Path(first['manifest_path']).exists())
                Path(repaired['outputs']['thumbnail.png']['path']).write_text('tampered')
                with self.assertRaisesRegex(ValueError,'hash mismatch'):package(*args)


if __name__=='__main__':unittest.main()
