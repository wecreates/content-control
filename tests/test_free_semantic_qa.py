import importlib.util
from pathlib import Path
import tempfile
import unittest

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


if __name__ == '__main__':
    unittest.main()
