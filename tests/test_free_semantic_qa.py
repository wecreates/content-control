import importlib.util
from pathlib import Path
import tempfile
import json
import hashlib
import os
import subprocess
import sys
import unittest
from unittest import mock

spec = importlib.util.spec_from_file_location('semantic', Path(__file__).parents[1] / 'scripts/free_semantic_qa.py')
semantic = importlib.util.module_from_spec(spec)
spec.loader.exec_module(semantic)


class SemanticTest(unittest.TestCase):
    def test_sample_bounded_includes_endpoints(self):
        paths = list(range(101))
        chosen = semantic.sample(paths, 32)
        self.assertEqual(len(chosen), 32)
        self.assertEqual((chosen[0], chosen[-1]), (0, 100))
        self.assertEqual(len(set(chosen)), 32)

    def test_incomplete_frames_never_approve(self):
        with tempfile.TemporaryDirectory() as root:
            p = Path(root)
            (p / 'ref-01.jpg').write_bytes(b'first')
            (p / 'cand-01.jpg').write_bytes(b'second')
            report = semantic.analyze(p, p)
            self.assertEqual(report['analysis_status'], 'INCOMPLETE')
            self.assertEqual(report['artistic_acceptance'], 'UNASSESSED')
            self.assertFalse(report['production_ready'])
            self.assertFalse(report['publication_enabled'])
            self.assertEqual(len(report['provenance']['reference_frames'][0]['sha256']), 64)

    def test_extraction_rejects_existing_unrelated_frames(self):
        with tempfile.TemporaryDirectory() as root:
            (Path(root) / 'cand-000001.jpg').write_bytes(b'unrelated')
            with self.assertRaisesRegex(ValueError, 'must be empty'):
                semantic.extract_candidate('other.mp4', root)

    def test_video_hash_tracks_actual_bytes(self):
        with tempfile.TemporaryDirectory() as root:
            video = Path(root) / 'test.mp4'
            video.write_bytes(b'original')
            first = semantic.analyze(root, root, video)
            video.write_bytes(b'changed')
            second = semantic.analyze(root, root, video)
            self.assertNotEqual(first['provenance']['candidate_video']['sha256'], second['provenance']['candidate_video']['sha256'])


    def test_extraction_and_binding_detect_changed_bytes(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            video = root / 'video.mp4'
            video.write_bytes(b'actual fixture video')
            frames = root / 'frames'
            def extract(*args, **kwargs):
                (frames / 'cand-000001.jpg').write_bytes(b'frame fixture')
            with mock.patch.object(semantic.subprocess, 'run', side_effect=extract):
                extraction = semantic.extract_candidate(video, frames)
            report = semantic.analyze(root, frames, video)
            semantic.bind_extraction(report, extraction, video, frames)
            self.assertTrue(report['provenance']['candidate_frames_video_binding_verified'])
            self.assertFalse(report['production_ready'])
            self.assertFalse(report['publication_enabled'])
            (frames / 'cand-000001.jpg').write_bytes(b'changed frame')
            semantic.bind_extraction(report, extraction, video, frames)
            self.assertFalse(report['provenance']['candidate_frames_video_binding_verified'])
            self.assertEqual(report['analysis_status'], 'INCOMPLETE')

    def test_extraction_refuses_video_mutation(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            video = root / 'video.mp4'
            video.write_bytes(b'first')
            with mock.patch.object(semantic.subprocess, 'run', side_effect=lambda *a, **kw: video.write_bytes(b'second')):
                with self.assertRaisesRegex(ValueError, 'changed during extraction'):
                    semantic.extract_candidate(video, root / 'frames')

    def test_binding_refuses_video_mutation_after_analysis(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            video = root / 'video.mp4'
            video.write_bytes(b'first')
            frame = root / 'cand-000001.jpg'
            frame.write_bytes(b'frame')
            report = semantic.analyze(root, root, video)
            extraction = {'candidate_video_sha256': semantic.sha256(video), 'candidate_frames': semantic.manifest([frame])}
            video.write_bytes(b'second')
            semantic.bind_extraction(report, extraction, video, root)
            self.assertFalse(report['provenance']['candidate_frames_video_binding_verified'])
            self.assertEqual(report['verdict'], 'ANALYSIS_INCOMPLETE')

    def test_canonical_workflow_requests_fresh_hash_bound_extraction(self):
        workflow = (Path(__file__).parents[1] / '.github/workflows/free-vision-qa.yml').read_text()
        command = next(line for line in workflow.splitlines() if 'python scripts/free_semantic_qa.py ' in line)
        self.assertIn('--candidate-video public-review/episode1-v10-free.mp4', command)
        self.assertIn('--extract-candidate', command)
        self.assertIn('--candidate-dir "$frames"', command)
        self.assertIn('frames=$(mktemp -d)', workflow)
        self.assertIn('candidate_frames_video_binding_verified', workflow)



    def test_receipt_binding_remains_enforced_under_optimized_python(self):
        root = Path(__file__).parents[1]
        workflow = (root / '.github/workflows/free-vision-qa.yml').read_text()
        block = workflow.split('- name: Bind zero-credit receipt', 1)[1].split("python - <<'PY'\n", 1)[1].split('          ok=', 1)[0]
        code = '\n'.join(line[10:] for line in block.splitlines())
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            qa = base / 'qa-output/free'
            qa.mkdir(parents=True)
            media = base / 'public-review/episode1-v10-free.mp4'
            media.parent.mkdir()
            media.write_bytes(b'current candidate')
            digest = hashlib.sha256(media.read_bytes()).hexdigest()
            good = {'provenance': {'candidate_frames_video_binding_verified': True,
                                   'candidate_video': {'sha256': digest}}}
            for name in ('deterministic', 'audio', 'mobile'):
                (qa / (name + '.json')).write_text(json.dumps({'candidate_sha256': digest}))
            env = dict(os.environ, PYTHONPATH=str(root))
            def run(semantic_report):
                (qa / 'semantic.json').write_text(json.dumps(semantic_report))
                return subprocess.run([sys.executable, '-O', '-c', code], cwd=base, env=env, capture_output=True).returncode
            self.assertEqual(run(good), 0)
            self.assertNotEqual(run({'provenance': {}}), 0)
            self.assertNotEqual(run({'provenance': {'candidate_frames_video_binding_verified': True, 'candidate_video': {'sha256': 'a'*64}}}), 0)
            media.write_bytes(b'changed candidate')
            self.assertNotEqual(run(good), 0)


if __name__ == '__main__':
    unittest.main()
