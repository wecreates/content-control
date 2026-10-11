import unittest
from scripts.rendered_visual_parity import compare_metric_series,explain_comparison

class RenderedVisualParityTests(unittest.TestCase):
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
