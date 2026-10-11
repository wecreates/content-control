import unittest
from scripts.free_transcription_qa import ordered_word_similarity,duration_matches_contract,norm

class TranscriptionSimilarityTests(unittest.TestCase):
    def test_numeric_formatting_does_not_destroy_sequence_similarity(self):
        expected="Dave found two percent cashback. He bought an eighty dollar gadget. Yes one dollar and sixty cents."
        actual="Dave found 2% cashback. He bought an $80 gadget. Yes, $1.60."
        self.assertGreaterEqual(ordered_word_similarity(expected,actual),0.70)

    def test_duration_uses_explicit_timeline_without_accepting_truncated_audio(self):
        contract={"expected_duration_seconds":50}
        self.assertTrue(duration_matches_contract(50,contract))
        self.assertFalse(duration_matches_contract(30,contract))
        self.assertFalse(duration_matches_contract(50,{"expected_duration_seconds":True}))
        self.assertTrue(duration_matches_contract(30,{}))
        self.assertFalse(duration_matches_contract(50,{}))

    def test_currency_percent_and_decimal_notation_preserve_value(self):
        for notation,spoken in [('$1.60.','one dollar and sixty cents.'),('$80','eighty dollars'),('2%','two percent'),('2.5%','two point five percent'),('$1,200.05','one thousand two hundred dollars and five cents'),('-80','minus eighty')]:
            with self.subTest(notation=notation):
                self.assertEqual(norm(notation),norm(spoken))

    def test_different_numeric_magnitudes_and_units_remain_distinct(self):
        for left,right in [('$1.60','$160'),('2%','20%'),('-80','80'),('$1.06','$1.60'),('2','2%')]:
            with self.subTest(left=left,right=right):
                self.assertNotEqual(norm(left),norm(right))

    def test_reordered_words_still_fail(self):
        expected="buy first reward second"
        actual="second reward first buy"
        self.assertLess(ordered_word_similarity(expected,actual),0.60)

if __name__=="__main__":
    unittest.main()
