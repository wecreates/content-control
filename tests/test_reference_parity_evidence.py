import copy
import unittest
from scripts.reference_style_parity_qa import qa

class ReferenceParityEvidenceTests(unittest.TestCase):
    def fixture(self,count=2):
        rows=[{'start':i,'end':i+1,'camera':'punch_in','shot_scale':'close'} for i in range(count)]
        return {'shot_timeline':rows},{'beats':copy.deepcopy(rows),'publication_enabled':False}

    def test_matching_known_grammar_remains_compatible(self):
        ref,clone=self.fixture()
        self.assertEqual(qa(ref,clone)['status'],'PASS')

    def test_matching_unknown_labels_are_not_evidence(self):
        for value in [None,'',' ','unknown','UNKNOWN','not measured','unclassified','to_be_classified_from_visual_sequence']:
            with self.subTest(value=value):
                ref,clone=self.fixture()
                for row in ref['shot_timeline']+clone['beats']:
                    row['camera']=value;row['shot_scale']=value
                report=qa(ref,clone)
                self.assertEqual(report['status'],'FAIL')
                self.assertFalse(report['checks']['camera_grammar_parity'])
                self.assertFalse(report['checks']['shot_scale_parity'])
                self.assertEqual(report['camera_mismatches'],[0,1])
                self.assertEqual(report['scale_mismatches'],[0,1])

    def test_single_missing_row_cannot_hide_behind_parity_threshold(self):
        ref,clone=self.fixture(10)
        ref['shot_timeline'][3]['camera']=None
        clone['beats'][3]['camera']=None
        report=qa(ref,clone)
        self.assertEqual(report['status'],'FAIL')
        self.assertIn('camera_evidence_available',report['failed_checks'])
        self.assertIn(3,report['mismatched_scene_indices'])

    def test_missing_fields_and_candidate_only_unknown_fail_without_mutation(self):
        ref,clone=self.fixture()
        del clone['beats'][1]['shot_scale']
        before=copy.deepcopy((ref,clone))
        report=qa(ref,clone)
        self.assertEqual(report['status'],'FAIL')
        self.assertFalse(report['checks']['shot_scale_evidence_available'])
        self.assertEqual((ref,clone),before)

if __name__=='__main__':unittest.main()
