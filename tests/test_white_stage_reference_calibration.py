"""Calibrate only from repository references, never from the candidate render."""
import unittest
from pathlib import Path
import cv2
import numpy as np
from scripts.rendered_visual_parity import frame_metrics,compare_white_stage


class WhiteStageReferenceCalibrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.references=[cv2.imread(str(p)) for p in sorted(Path('reference/frames').glob('ref-*.jpg'))]
        if len(cls.references)<4 or any(x is None for x in cls.references):
            raise AssertionError('Real reference frames are required for calibration')
        cls.reference_metrics=[frame_metrics(x) for x in cls.references]
        cls.white=[]
        for image in cls.references:
            gray=cv2.cvtColor(image,cv2.COLOR_BGR2GRAY)
            normalized=np.clip(gray.astype(float)*255/np.percentile(gray,90),0,255).astype(np.uint8)
            cls.white.append(cv2.cvtColor(normalized,cv2.COLOR_GRAY2BGR))

    def compare(self,images):
        return compare_white_stage(self.reference_metrics,[frame_metrics(x) for x in images])

    def test_preserved_reference_geometry_on_white_passes(self):
        self.assertTrue(self.compare(self.white)['framewise_style_parity'])

    def test_jpeg_recompression_does_not_reverse_valid_style(self):
        copies=[cv2.imdecode(cv2.imencode('.jpg',x,[cv2.IMWRITE_JPEG_QUALITY,65])[1],cv2.IMREAD_COLOR) for x in self.white]
        self.assertTrue(self.compare(copies)['framewise_style_parity'])

    def test_shortening_only_reserved_caption_band_preserves_action_evidence(self):
        copies=[]
        for image in self.white:
            copy=image.copy();copy[:image.shape[0]//4]=255;copies.append(copy)
        original=self.compare(self.white);short=self.compare(copies)
        self.assertEqual(original['foreground_density_ratio'],short['foreground_density_ratio'])
        self.assertEqual(original['edge_density_ratio'],short['edge_density_ratio'])
        self.assertTrue(short['framewise_style_parity'])

    def test_bad_reference_perturbations_fail_independently_of_candidate(self):
        tiny=[];erased=[]
        for image in self.white:
            h,w=image.shape[:2]
            tiny.append(cv2.warpAffine(image,cv2.getRotationMatrix2D((w/2,h/2),0,.25),(w,h),borderValue=(255,255,255)))
            copy=image.copy();copy[round(h*.15625):]=255;erased.append(copy)
        variants={
            'blank':[np.full_like(x,255) for x in self.white],
            'black':[np.zeros_like(x) for x in self.white],
            'colored_background':[np.full_like(x,(0,0,255)) for x in self.white],
            'quarter_scale_foreground':tiny,
            'erased_foreground':erased,
        }
        for name,images in variants.items():
            with self.subTest(name=name):
                self.assertFalse(self.compare(images)['framewise_style_parity'])


if __name__=='__main__':
    unittest.main()
