import unittest
from scripts.free_transcription_qa import ordered_word_similarity

class TranscriptionSimilarityTests(unittest.TestCase):
    def test_numeric_formatting_does_not_destroy_sequence_similarity(self):
        expected="Dave found two percent cashback. He bought an eighty dollar gadget. Yes one dollar and sixty cents."
        actual="Dave found 2% cashback. He bought an $80 gadget. Yes, $1.60."
        self.assertGreaterEqual(ordered_word_similarity(expected,actual),0.70)

    def test_reordered_words_still_fail(self):
        expected="buy first reward second"
        actual="second reward first buy"
        self.assertLess(ordered_word_similarity(expected,actual),0.60)

if __name__=="__main__":
    unittest.main()
