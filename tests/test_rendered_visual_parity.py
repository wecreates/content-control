import unittest
from unittest.mock import patch
import numpy as np
import cv2
from scripts.rendered_visual_parity import compare_metric_series,explain_comparison,sample_video

class RenderedVisualParityTests(unittest.TestCase):
    def test_sampling_checks_seek_and_releases_decoder_on_failure(self):
        class Decoder:
            released=False
            position=0
            allow_seek=True
            report_offset=0
            fps=24
            def get(self, prop):
                return {cv2.CAP_PROP_FPS:self.fps,cv2.CAP_PROP_FRAME_COUNT:100,
                        cv2.CAP_PROP_POS_FRAMES:self.position+self.report_offset}[prop]
            def set(self, prop, position):
                self.position=position
                return self.allow_seek
            def read(self):
                self.position+=1
                return True,np.full((10,10,3),255,dtype=np.uint8)
            def release(self):self.released=True
        for attribute,value in [('allow_seek',False),('report_offset',-1),('fps',float('inf'))]:
            decoder=Decoder();setattr(decoder,attribute,value)
            with patch('scripts.rendered_visual_parity.cv2.VideoCapture',return_value=decoder):
                with self.assertRaises(RuntimeError):sample_video('fixture.mp4',4)
            self.assertTrue(decoder.released)
        decoder=Decoder()
        with patch('scripts.rendered_visual_parity.cv2.VideoCapture',return_value=decoder):
            samples,duration=sample_video('fixture.mp4',4)
        self.assertEqual(len(samples),4)
        self.assertAlmostEqual(duration,100/24)
        self.assertTrue(decoder.released)

    def test_background_mismatch_is_explained_without_waiving_failure(self):
        ref={'edge_density':.02,'white_fraction':.02,'mean_brightness':.86}
        candidate={'edge_density':.02,'white_fraction':.96,'mean_brightness':.96}
        result=compare_metric_series([ref]*4,[candidate]*4)
        self.assertFalse(result['framewise_style_parity'])
        self.assertAlmostEqual(sum(result['weighted_mean_distance_components'].values()),result['mean_frame_distance'])
        self.assertIn('white_fraction',explain_comparison(result))
        self.assertIn('does not assess creative quality',explain_comparison(result))

    def test_incomplete_or_nonfinite_metrics_cannot_pass(self):
        m={'edge_density':.02,'white_fraction':.96,'mean_brightness':.96}
        with self.assertRaises(ValueError):compare_metric_series([m]*4,[m]*2)
        with self.assertRaises(ValueError):compare_metric_series([m]*4,[m]*4,float('nan'))
        with self.assertRaises(ValueError):compare_metric_series([m]*4,[dict(m,white_fraction=float('nan'))]*4)
        self.assertFalse(compare_metric_series([m],[m])['framewise_style_parity'])

    def test_rejects_large_framewise_style_gap(self):
        refs=[{'edge_density':0.10,'white_fraction':0.80,'mean_brightness':0.85},
              {'edge_density':0.12,'white_fraction':0.78,'mean_brightness':0.83}]
        cands=[{'edge_density':0.01,'white_fraction':0.10,'mean_brightness':0.20},
               {'edge_density':0.02,'white_fraction':0.12,'mean_brightness':0.22}]
        result=compare_metric_series(refs,cands)
        self.assertFalse(result['framewise_style_parity'])
        self.assertGreater(result['mean_frame_distance'],0.25)

    def test_accepts_close_normalized_frame_structure(self):
        refs=[{'edge_density':0.10,'white_fraction':0.80,'mean_brightness':0.85},
              {'edge_density':0.12,'white_fraction':0.78,'mean_brightness':0.83}]
        cands=[{'edge_density':0.11,'white_fraction':0.77,'mean_brightness':0.84},
               {'edge_density':0.11,'white_fraction':0.79,'mean_brightness':0.82}]
        result=compare_metric_series(refs,cands)
        self.assertTrue(result['framewise_style_parity'])
        self.assertLess(result['mean_frame_distance'],0.08)

if __name__=='__main__':
    unittest.main()
