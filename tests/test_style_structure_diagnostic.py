import unittest
import cv2
import numpy as np
from scripts.style_structure_diagnostic import compare_structure


def artwork(background=255, variant=False):
    image = np.full((640, 360, 3), background, dtype=np.uint8)
    if variant:
        cv2.rectangle(image, (30, 70), (300, 550), (15, 15, 15), 14)
        cv2.line(image, (30, 70), (300, 550), (15, 15, 15), 14)
    else:
        cv2.circle(image, (180, 150), 45, (15, 15, 15), 7)
        for a, b in [((180, 195), (180, 380)), ((90, 250), (270, 250)), ((180, 380), (95, 540)), ((180, 380), (265, 540))]:
            cv2.line(image, a, b, (15, 15, 15), 7)
    return image


class StructureDiagnosticTests(unittest.TestCase):
    def test_same_art_white_and_nearwhite_are_equivalent(self):
        result = compare_structure(artwork(), artwork(242))
        self.assertGreater(result['mask_iou'], .99)
        self.assertLess(result['spatial_occupancy_distance'], .001)
        self.assertEqual(result['acceptance_effect'], 'none')
        self.assertFalse(result['calibrated'])

    def test_light_paper_texture_and_jpeg_do_not_dominate_geometry(self):
        reference=artwork()
        paper=reference.copy()
        background=np.all(paper==255,axis=2)
        rng=np.random.default_rng(42)
        texture=rng.integers(235,245,size=background.shape,dtype=np.uint8)
        paper[background]=np.repeat(texture[background,None],3,axis=1)
        ok,encoded=cv2.imencode('.jpg',paper,[cv2.IMWRITE_JPEG_QUALITY,85])
        self.assertTrue(ok)
        result=compare_structure(reference,cv2.imdecode(encoded,cv2.IMREAD_COLOR))
        self.assertGreater(result['mask_iou'],.95)
        self.assertLess(result['spatial_occupancy_distance'],.005)

    def test_different_geometry_is_distinguished(self):
        result = compare_structure(artwork(), artwork(242, True))
        self.assertLess(result['mask_iou'], .20)
        self.assertGreater(result['spatial_occupancy_distance'], .03)

    def test_blank_never_looks_like_verified_matching_art(self):
        blank = np.full((640, 360, 3), 255, dtype=np.uint8)
        for ref in [artwork(), blank]:
            result = compare_structure(ref, blank)
            self.assertFalse(result['foreground_present_in_both'])
            self.assertIsNone(result['mask_iou'])
            self.assertNotEqual(result['status'], 'PASS')

    def test_resolution_normalization_and_unsupported_dark_background(self):
        source = artwork()
        self.assertGreater(compare_structure(source, cv2.resize(source, (720, 1280)))['mask_iou'], .98)
        self.assertEqual(compare_structure(source, np.zeros_like(source))['status'], 'UNSUPPORTED')


if __name__ == '__main__':
    unittest.main()
