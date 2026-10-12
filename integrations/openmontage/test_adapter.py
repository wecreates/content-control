"""Actual local upstream acceptance with owned synthetic media; no model calls."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from verify_render import verify
import unittest
spec=importlib.util.spec_from_file_location('adapter',Path(__file__).with_name('adapter.py'));adapter=importlib.util.module_from_spec(spec);spec.loader.exec_module(adapter)

class AdapterTests(unittest.TestCase):
    def test_disallowed_operation_and_publication_fail_before_execution(self):
        for request in ({'operation':'generate','publication_enabled':False},{'operation':'probe','publication_enabled':True}):
            with self.assertRaises(ValueError):adapter.execute('/not-a-checkout',request)

    @unittest.skipUnless(os.environ.get('OPENMONTAGE_CHECKOUT'),'Set OPENMONTAGE_CHECKOUT for real upstream acceptance')
    def test_real_owned_media_probe_and_concat(self):
        upstream=os.environ['OPENMONTAGE_CHECKOUT']
        with tempfile.TemporaryDirectory(prefix='openmontage-acceptance-') as tmp:
            root=Path(tmp);clips=[]
            for i,color in enumerate(('red','blue')):
                p=root/f'{i}.mp4';clips.append(str(p))
                subprocess.run(['ffmpeg','-v','error','-nostdin','-y','-f','lavfi','-i',f'color={color}:s=160x90:r=24:d=1','-f','lavfi','-i',f'sine=frequency={440+i*220}:sample_rate=44100:duration=1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',str(p)],check=True)
            request={'operation':'concat','clips':clips,'output_path':str(root/'joined.mp4'),'publication_enabled':False}
            receipt=adapter.execute(upstream,request)
            self.assertEqual(receipt['status'],'PASS');self.assertEqual(receipt['result']['data']['method'],'concat_demuxer');self.assertEqual(receipt['provider_calls'],0)
            probe=adapter.execute(upstream,{'operation':'probe','input_path':request['output_path'],'publication_enabled':False})
            data=probe['result']['data'];self.assertAlmostEqual(data['duration_seconds'],2,delta=.15);self.assertEqual(data['audio']['codec'],'aac');self.assertEqual(data['stream_count'],2)
            # Decode both halves and prove source order, not just container duration.
            for timestamp,channel in ((.3,0),(1.3,2)):
                pixels=subprocess.check_output(['ffmpeg','-v','error','-ss',str(timestamp),'-i',request['output_path'],'-frames:v','1','-vf','scale=1:1','-f','rawvideo','-pix_fmt','rgb24','-'])
                self.assertGreater(pixels[channel],150);self.assertLess(pixels[2-channel],80)
            acceptance=verify(upstream,request['output_path'],2)
            self.assertEqual(acceptance['status'],'PASS')
            self.assertEqual(acceptance['candidate_sha256'],receipt['output_sha256'])
            wrong_duration=verify(upstream,request['output_path'],10)
            self.assertEqual(wrong_duration['status'],'FAIL')
            self.assertIn('duration_matches',wrong_duration['failed_checks'])
            with self.assertRaises(ValueError):adapter.execute(upstream,request)
            bad=root/"unsafe'name.mp4";bad.write_bytes((root/'0.mp4').read_bytes())
            with self.assertRaises(ValueError):adapter.media_path(str(bad))
            print(json.dumps({'acceptance':'PASS','upstream_commit':receipt['upstream_commit'],'duration':data['duration_seconds'],'streams':data['stream_count'],'source_order':'red then blue','output_sha256':receipt['output_sha256'],'publication_enabled':False}))
if __name__=='__main__':unittest.main()
