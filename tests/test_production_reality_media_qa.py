import unittest
import numpy as np
from scripts.production_reality_media_qa import duplicate_run_stats

class DuplicateRunStatsTests(unittest.TestCase):
    def test_measures_longest_continuous_duplicate_run(self):
        a=np.zeros((16,16),dtype=np.uint8)
        b=np.full((16,16),25,dtype=np.uint8)
        hashes=[a.copy(),a.copy(),a.copy(),b.copy(),a.copy(),a.copy()]
        stats=duplicate_run_stats(hashes,threshold=1.0)
        self.assertEqual(stats["duplicate_pairs"],3)
        self.assertEqual(stats["max_duplicate_run_pairs"],2)

    def test_scattered_duplicates_do_not_become_one_long_run(self):
        a=np.zeros((16,16),dtype=np.uint8)
        b=np.full((16,16),25,dtype=np.uint8)
        c=np.full((16,16),50,dtype=np.uint8)
        hashes=[a.copy(),a.copy(),b.copy(),b.copy(),c.copy(),c.copy()]
        stats=duplicate_run_stats(hashes,threshold=1.0)
        self.assertEqual(stats["duplicate_pairs"],3)
        self.assertEqual(stats["max_duplicate_run_pairs"],1)

if __name__=="__main__":
    unittest.main()
