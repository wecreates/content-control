import unittest
import numpy as np
import cv2
from scripts.rendered_visual_parity import (compare_metric_series, frame_metrics,
    foreground_diagnostics, benchmark_diagnostics, METRIC_WEIGHTS, compare_white_stage)

class RenderedVisualParityTests(unittest.TestCase):
    @staticmethod
    def figure(background=255,scale=1.0):
        image=np.full((240,160,3),background,dtype=np.uint8)
        cv2.circle(image,(80,75),22,(0,0,0),4)
        for a,b in [((80,97),(80,165)),((80,120),(38,148)),((80,120),(125,145)),((80,165),(44,220)),((80,165),(115,220))]:
            cv2.line(image,a,b,(0,0,0),4)
        cv2.putText(image,'VALUE',(10,35),cv2.FONT_HERSHEY_SIMPLEX,.8,(0,0,0),2)
        if scale!=1:
            image=cv2.warpAffine(image,cv2.getRotationMatrix2D((80,120),0,scale),(160,240),borderValue=(background,)*3)
        return image

    def profile(self,reference,candidate):
        return compare_white_stage([frame_metrics(reference)]*4,[frame_metrics(candidate)]*4)

    def test_white_profile_accepts_light_paper_to_required_white(self):
        self.assertTrue(self.profile(self.figure(230),self.figure())['framewise_style_parity'])

    def test_white_profile_keeps_exact_distance_thresholds_and_weights(self):
        refs=[frame_metrics(self.figure(230))]*4;cands=[frame_metrics(self.figure())]*4
        expected=compare_metric_series([x['light_stage_normalized'] for x in refs],[x['light_stage_normalized'] for x in cands])
        actual=compare_white_stage(refs,cands)
        for k in ['mean_frame_distance','p90_frame_distance','frame_distances']:
            self.assertEqual(actual[k],expected[k])
        self.assertFalse(actual['creative_acceptance'])

    def test_white_profile_rejects_empty_dark_colored_and_tiny_content(self):
        ref=self.figure(230)
        candidates=[np.full_like(ref,255),np.zeros_like(ref),np.full_like(ref,(0,0,255)),self.figure(scale=.2)]
        for candidate in candidates:
            with self.subTest(mean=float(candidate.mean())):
                self.assertFalse(self.profile(ref,candidate)['framewise_style_parity'])

    def test_white_profile_rejects_cream_output_when_brief_is_white(self):
        result=self.profile(self.figure(230),self.figure(230))
        self.assertFalse(result['checks']['raw_white_candidate_background'])
        self.assertFalse(result['framewise_style_parity'])

    def test_white_profile_rejects_whitened_dark_reference(self):
        result=self.profile(self.figure(100),self.figure())
        self.assertFalse(result['checks']['light_reference_stage'])
        self.assertFalse(result['framewise_style_parity'])

    def test_white_profile_rejects_content_erasure_even_if_global_color_close(self):
        ref=self.figure(230);candidate=self.figure();candidate[55:]=255
        result=self.profile(ref,candidate)
        self.assertFalse(result['checks']['foreground_density_preserved'])
        self.assertFalse(result['framewise_style_parity'])

    def test_progressive_caption_change_does_not_change_action_density(self):
        ref=self.figure(230);full=self.figure();short=full.copy();short[:60]=255
        a,b=self.profile(ref,full),self.profile(ref,short)
        self.assertEqual(a['foreground_density_ratio'],b['foreground_density_ratio'])
        self.assertEqual(a['edge_density_ratio'],b['edge_density_ratio'])
        self.assertTrue(b['framewise_style_parity'])

    def test_white_profile_rejects_mismatched_or_insufficient_sampling(self):
        metric=frame_metrics(self.figure())
        for a,b in [(4,3),(3,3),(0,0)]:
            self.assertFalse(compare_white_stage([metric]*a,[metric]*b)['framewise_style_parity'])

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

