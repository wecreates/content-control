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


class OperationalAnalysisTests(unittest.TestCase):
    def test_real_decodes_produce_hashed_review_sheets_without_approval(self):
        from scripts.rendered_visual_parity import analyze_comparison
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);video=root/'candidate.avi';refs=root/'refs';refs.mkdir()
            writer=cv2.VideoWriter(str(video),cv2.VideoWriter_fourcc(*'MJPG'),8,(80,80))
            self.assertTrue(writer.isOpened())
            for i in range(8):
                image=np.full((80,80,3),255,dtype=np.uint8)
                cv2.line(image,(10+i,10),(60,65),(0,0,0),4)
                writer.write(image)
                if i<4:cv2.imwrite(str(refs/f'ref-{i:02}.jpg'),image)
            writer.release()
            result=analyze_comparison(refs,video,root/'evidence')
            self.assertEqual(result['status'],'COMPLETE')
            self.assertFalse(result['production_approved'])
            self.assertEqual(result['acceptance_effect'],'none')
            self.assertEqual([p['candidate_frame'] for p in result['samples']],[0,2,5,7])
            self.assertEqual(result['candidate_sha256'],sha256(video))
            sheet=result['contact_sheets'][0];path=root/'evidence'/sheet['file']
            self.assertEqual(sheet['sha256'],sha256(path))
            decoded=cv2.imread(str(path));self.assertEqual(decoded.shape[:2],(1584,640))
            import json
            manifest={'frames':[{'file':p.name,'sha256':sha256(p)} for p in sorted(refs.glob('ref-*.jpg'))]}
            (refs/'reference-manifest.json').write_text(json.dumps(manifest))
            verified=analyze_comparison(refs,video,root/'manifest-evidence')
            self.assertEqual(verified['reference_provenance']['status'],'FRAME_HASHES_VERIFIED')
            self.assertFalse(verified['reference_provenance']['source_url_attribution_verified'])
            manifest['frames'][0]['sha256']='0'*64
            (refs/'reference-manifest.json').write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError,'hash mismatch'):analyze_comparison(refs,video,root/'tampered')
            (refs/'reference-manifest.json').unlink()
            (refs/'ref-00.jpg').write_bytes(b'corrupt')
            with self.assertRaises(ValueError):analyze_comparison(refs,video,root/'invalid')


class DocumentedVisualReviewTests(unittest.TestCase):
    def test_exact_bound_review_can_pass_fail_and_reject_tampering(self):
        import copy
        from scripts.rendered_visual_parity import evaluate_visual_review, REVIEW_DIMENSIONS
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);video=root/'candidate.avi'
            image=np.full((80,80,3),255,dtype=np.uint8)
            cv2.line(image,(10,10),(65,65),(0,0,0),4)
            writer=cv2.VideoWriter(str(video),cv2.VideoWriter_fourcc(*'MJPG'),8,(80,80))
            self.assertTrue(writer.isOpened())
            for i in range(8):writer.write(image)
            writer.release()
            refs=[]
            for i in range(4):
                path=root/f'ref-{i}.jpg';cv2.imwrite(str(path),image)
                refs.append({'path':path.name,'sha256':sha256(path)})
            review={'review_type':'independent_sampled_frame_visual_analysis',
                    'candidate':{'sha256':sha256(video)},'reviewer':{'id':'test-fixture-reviewer','method':'fixture only; not real creative evidence'},
                    'reviewed_at':'2026-10-13T00:00:00Z','coverage':{'sample_count':8,'sampled_frame_indices':list(range(8))},
                    'reference_frames':refs,'decision':'PASS','unresolved_issues':[],
                    'findings':[{'dimension':d,'status':'PASS','candidate_frames':[0,7],'observation':'Synthetic test contract only.'} for d in REVIEW_DIMENSIONS]}
            result=evaluate_visual_review(root,video,review)
            self.assertEqual(result['status'],'PASS');self.assertTrue(result['framewise_style_parity'])
            self.assertFalse(result['production_approved'])
            failed=copy.deepcopy(review);failed['decision']='FAIL';failed['findings'][0]['status']='MISMATCH'
            failed['unresolved_issues']=['Fixture mismatch']
            self.assertEqual(evaluate_visual_review(root,video,failed)['status'],'FAIL')
            mutations=[lambda r:r['candidate'].update(sha256='0'*64),
                       lambda r:r['reference_frames'][0].update(sha256='0'*64),
                       lambda r:r['coverage']['sampled_frame_indices'].pop(),
                       lambda r:r['coverage']['sampled_frame_indices'].__setitem__(0,80),
                       lambda r:r['coverage']['sampled_frame_indices'].__setitem__(0,1),
                       lambda r:r['findings'].pop(),
                       lambda r:r['reviewer'].update(id=''),
                       lambda r:r['findings'][0].update(candidate_frames=[79]),
                       lambda r:r['unresolved_issues'].append('Still broken'),
                       lambda r:r['findings'][0].update(status='MISMATCH')]
            for mutate in mutations:
                bad=copy.deepcopy(review);mutate(bad)
                with self.subTest(mutation=mutate):
                    self.assertEqual(evaluate_visual_review(root,video,bad)['status'],'BLOCKED')


if __name__ == "__main__":
    unittest.main()
