import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch
import numpy as np
import cv2
from scripts.rendered_visual_parity import compare_metric_series,explain_comparison,sample_video,compare_aligned_images,qualified_structure_comparison,sha256

class RenderedVisualParityTests(unittest.TestCase):
    def test_missing_reference_qualification_blocks_instead_of_claiming_style_failure(self):
        result=qualified_structure_comparison('unused','unused',None)
        self.assertEqual(result['status'],'BLOCKED')
        self.assertEqual(result['blocker'],'BLOCKED_UNSUPPORTED_REFERENCE')
        self.assertFalse(result['framewise_style_parity'])
        self.assertIn('diagnostic only',result['reason'])

    def test_background_normalization_never_promotes_synthetic_match_to_approval(self):
        white=np.full((320,180,3),255,dtype=np.uint8)
        nearwhite=np.full_like(white,242)
        for image in (white,nearwhite):cv2.line(image,(30,40),(140,280),(10,10,10),6)
        result=compare_aligned_images(white,nearwhite)
        self.assertLess(result['foreground_distance'],.01)
        self.assertEqual(result['acceptance_effect'],'none')
        self.assertFalse(result['calibrated'])
        self.assertNotIn('match',result)
        self.assertFalse(compare_aligned_images(white,np.full_like(white,255))['foreground_present_in_both'])

    def test_even_identical_qualified_pairs_cannot_pass_without_calibration(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);video=root/'fixture.avi'
            image=np.full((80,80,3),255,dtype=np.uint8)
            cv2.line(image,(10,10),(65,65),(10,10,10),5)
            writer=cv2.VideoWriter(str(video),cv2.VideoWriter_fourcc(*'MJPG'),24,(80,80))
            self.assertTrue(writer.isOpened())
            pairs=[]
            for i in range(4):
                writer.write(image);frame=root/f'ref-{i}.jpg';cv2.imwrite(str(frame),image)
                pairs.append({'reference_file':frame.name,'reference_sha256':sha256(frame),'candidate_frame':i,'source_seconds':i/24})
            writer.release()
            contract={'method':'aligned_line_art','status':'VERIFIED','candidate_sha256':sha256(video),'source_url':'https://example.org/source','pairs':pairs}
            result=qualified_structure_comparison(root,video,contract)
            self.assertEqual(result['status'],'BLOCKED')
            self.assertEqual(result['blocker'],'STRUCTURE_CALIBRATION_REQUIRED')
            self.assertEqual(len(result['pairs']),4)
            self.assertFalse(result['framewise_style_parity'])
            contract['pairs'][0]['reference_sha256']='a'*64
            self.assertEqual(qualified_structure_comparison(root,video,contract)['blocker'],'BLOCKED_UNSUPPORTED_REFERENCE')

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
