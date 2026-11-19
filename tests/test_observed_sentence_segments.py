import copy
import hashlib
import json
import unittest
from scripts.segment_observed_words import derive


class ObservedSentenceTests(unittest.TestCase):
    def setUp(self):
        self.audio = b'Explicitly synthetic identity fixture'
        self.source = {'status': 'PASS', 'publication_enabled': False,
            'audio_sha256': hashlib.sha256(self.audio).hexdigest(),
            'actual_transcript': 'Pay twenty dollars. Keep sixty dollars.',
            'media_duration_seconds': 4, 'transcribed_duration_seconds': 4,
            'segments': [{'start': 0, 'end': 4, 'text': 'Pay twenty dollars. Keep sixty dollars.'}],
            'words': [{'start': i * .5, 'end': i * .5 + .5, 'word': w}
                      for i,w in enumerate(['Pay', 'twenty', 'dollars.', 'Keep', 'sixty', 'dollars.'])]}
        self.source['words'][-1]['end'] = 4

    def run_derive(self):
        return derive(json.dumps(self.source).encode(), self.audio)

    def test_only_observed_punctuation_and_word_times_define_cues(self):
        before = copy.deepcopy(self.source)
        out = self.run_derive()
        self.assertEqual(self.source, before)
        self.assertEqual(out['segments'], [{'start': 0, 'end': 1.5, 'text': 'Pay twenty dollars.'},
                                          {'start': 1.5, 'end': 4, 'text': 'Keep sixty dollars.'}])
        self.assertEqual(out['words'], before['words'])
        self.assertEqual(out['segmentation_derivation']['source_receipt_sha256'],
                         hashlib.sha256(json.dumps(self.source).encode()).hexdigest())
        self.assertFalse(out['segmentation_derivation']['script_used_for_alignment'])

    def test_wrong_audio_or_failed_receipt_is_rejected(self):
        for key,value in [('audio_sha256','f'*64),('status','FAIL'),('publication_enabled',True)]:
            with self.subTest(key=key):
                old=self.source[key];self.source[key]=value
                with self.assertRaises(ValueError):self.run_derive()
                self.source[key]=old

    def test_missing_currency_word_cannot_be_inserted_from_transcript(self):
        self.source['words'].pop(2)
        with self.assertRaisesRegex(ValueError,'differ'):self.run_derive()

    def test_source_segment_mismatch_is_rejected(self):
        self.source['segments'][0]['text']='Something different.'
        with self.assertRaises(ValueError):self.run_derive()

    def test_invalid_or_nonfinite_word_timing_is_rejected(self):
        for value in [float('inf'),float('nan'),-1,True,10**1000]:
            with self.subTest(value=str(value)[:20]):
                self.source['words'][0]['end']=value
                with self.assertRaises(ValueError):self.run_derive()

    def test_word_coverage_cannot_shrink_to_fit_caption(self):
        self.source['words'][-1]['end']=3
        with self.assertRaisesRegex(ValueError,'duration'):self.run_derive()

    def test_inconsistent_source_segment_coverage_cannot_be_repaired_by_words(self):
        self.source['segments'][0]['end'] = .5
        with self.assertRaisesRegex(ValueError,'Source segments'):self.run_derive()

    def test_zero_or_overlong_durations_are_rejected(self):
        for media,end in [(0,0),(4,0),(4,5)]:
            with self.subTest(media=media,end=end):
                self.source['media_duration_seconds']=media
                self.source['transcribed_duration_seconds']=end
                with self.assertRaisesRegex(ValueError,'duration'):self.run_derive()

    def test_deep_auxiliary_json_does_not_trigger_recursive_copy(self):
        raw=json.dumps(self.source).encode()
        auxiliary=b'['*600+b'0'+b']'*600
        raw=raw[:-1]+b',"auxiliary":'+auxiliary+b'}'
        result=derive(raw,self.audio)
        self.assertEqual(len(result['segments']),2)
