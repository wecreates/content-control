import unittest
from scripts.rendered_visual_parity import compare_metric_series

class RenderedVisualParityTests(unittest.TestCase):
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
