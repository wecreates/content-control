import unittest
import numpy as np
from scripts.rendered_visual_parity import (compare_metric_series, frame_metrics,
    foreground_diagnostics, benchmark_diagnostics, METRIC_WEIGHTS)

class RenderedVisualParityTests(unittest.TestCase):
    def test_paper_tint_is_diagnosed_without_overriding_gate(self):
        white=np.full((100,100,3),255,dtype=np.uint8)
        paper=np.full((100,100,3),230,dtype=np.uint8)
        white[25:75,40:60]=0
        paper[25:75,40:60]=0
        refs=[frame_metrics(paper)]*2
        candidates=[frame_metrics(white)]*2
        result=compare_metric_series(refs,candidates)
        diagnostics=benchmark_diagnostics(refs,candidates)
        self.assertFalse(result['framewise_style_parity'])
        self.assertEqual(diagnostics['acceptance_effect'],'none')
        self.assertGreater(diagnostics['white_fraction_distance_share'],.9)
        self.assertEqual(refs[0]['foreground_diagnostics']['dark_foreground_fraction'],
                         candidates[0]['foreground_diagnostics']['dark_foreground_fraction'])
        self.assertAlmostEqual(sum(diagnostics['weighted_distance_contributions'].values()),
                               result['mean_frame_distance'])

    def test_empty_frame_has_no_foreground_centroid(self):
        blank=foreground_diagnostics(np.full((100,100),255,dtype=np.uint8))
        self.assertEqual(blank['dark_foreground_fraction'],0)
        self.assertIsNone(blank['foreground_centroid_xy'])
        self.assertEqual(blank['foreground_vertical_quarters'],[0,0,0,0])

    def test_composition_diagnostics_expose_displaced_subject(self):
        upper=np.full((100,100),255,dtype=np.uint8)
        lower=upper.copy()
        upper[5:20,40:60]=0
        lower[80:95,40:60]=0
        a,b=foreground_diagnostics(upper),foreground_diagnostics(lower)
        self.assertEqual(a['dark_foreground_fraction'],b['dark_foreground_fraction'])
        self.assertLess(a['foreground_centroid_xy'][1],.25)
        self.assertGreater(b['foreground_centroid_xy'][1],.75)

    def test_supplemental_metrics_cannot_change_original_score(self):
        rng=np.random.default_rng(17)
        refs=[frame_metrics(rng.integers(0,256,(80,80,3),dtype=np.uint8)) for _ in range(3)]
        candidates=[frame_metrics(rng.integers(0,256,(80,80,3),dtype=np.uint8)) for _ in range(3)]
        bare=lambda xs:[{k:x[k] for k in METRIC_WEIGHTS} for x in xs]
        self.assertEqual(compare_metric_series(refs,candidates),
                         compare_metric_series(bare(refs),bare(candidates)))

    def test_no_pairs_cannot_generate_comparison_evidence(self):
        self.assertEqual(benchmark_diagnostics([],[])['paired_frames'],0)

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

