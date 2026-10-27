import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from scripts.setup_pinned_media_runtime import setup, verified_executable

class PinnedMediaRuntimeTests(unittest.TestCase):
    def test_hash_mismatch_and_nonexecutable_fail_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'fixture';p.write_bytes(b'test-only binary fixture')
            with self.assertRaises(RuntimeError):verified_executable(p,'0'*64)
            p.chmod(0o700)
            with self.assertRaisesRegex(RuntimeError,'hash mismatch'):verified_executable(p,'0'*64)
            self.assertEqual(verified_executable(p,hashlib.sha256(p.read_bytes()).hexdigest()),p)

    @patch('scripts.setup_pinned_media_runtime.platform.system',return_value='Darwin')
    def test_unpinned_platform_fails_before_setup(self,_):
        with tempfile.TemporaryDirectory() as folder:
            destination=Path(folder)/'bin'
            with self.assertRaisesRegex(RuntimeError,'Linux x86_64'):setup('.',destination)
            self.assertFalse(destination.exists())

    @patch('scripts.setup_pinned_media_runtime.importlib.metadata.version',return_value='0.5.2')
    def test_unpinned_version_fails_closed(self,_):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(RuntimeError,'version'):setup('.',Path(folder)/'bin')

    @unittest.skipUnless(importlib.util.find_spec('imageio_ffmpeg'),'Pinned imageio-ffmpeg required')
    def test_real_pinned_tools_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as folder:
            destination=Path(folder)/'bin'
            with patch.dict(os.environ,{'IMAGEIO_FFMPEG_EXE':'/unapproved/override'}):
                result=setup('.',destination)
            self.assertEqual(result['status'],'PASS')
            self.assertEqual(result['float32_decode_samples'],1600)
            self.assertTrue((destination/'ffmpeg').is_symlink())
            self.assertTrue((destination/'ffprobe').is_symlink())
            before=(destination/'ffmpeg').readlink()
            with self.assertRaises(FileExistsError):setup('.',destination)
            self.assertEqual((destination/'ffmpeg').readlink(),before)

if __name__=='__main__':unittest.main()
