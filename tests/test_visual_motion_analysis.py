import tempfile,unittest
from pathlib import Path
import cv2
import numpy as np
from scripts.visual_motion_analysis import analyze

class MotionTests(unittest.TestCase):
 def test_full_decode_detects_static_interval_and_change_without_approval(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'test.avi';w=cv2.VideoWriter(str(p),cv2.VideoWriter_fourcc(*'MJPG'),10,(80,80))
   for i in range(30):w.write(np.full((80,80,3),255 if i<20 else 0,np.uint8))
   w.release();r=analyze(p)
   self.assertEqual(r['decoded_frames'],30);self.assertEqual(r['analysis_status'],'COMPLETE')
   self.assertTrue(r['observations']['low_change_intervals_seconds']);self.assertIn(2.,r['observations']['large_change_timestamps_seconds'])
   self.assertFalse(r['production_approved'])
   self.assertEqual(r['parameters']['analysis_resolution'],[180,180])
   self.assertTrue(r['parameters']['aspect_ratio_preserved'])
 def test_invalid_video_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'bad.mp4';p.write_bytes(b'invalid')
   with self.assertRaises(ValueError):analyze(p)
