import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
from scripts.v2_clip_transcription import observe_clip

class SpokenNumberDecodingTests(unittest.TestCase):
 def test_opt_in_suppresses_numeric_tokens_but_keeps_observed_word_times(self):
  word=SimpleNamespace(word=' second',start=.12,end=.48,probability=.98)
  model=Mock();model.transcribe.return_value=([SimpleNamespace(words=[word])],None)
  clip=object()
  with patch('scripts.v2_clip_transcription.spoken_number_suppression',return_value=[-1,12,99]) as suppress:
   result=observe_clip(model,clip,True)
   suppress.assert_called_once_with(model.hf_tokenizer)
  args,kwargs=model.transcribe.call_args
  self.assertIs(args[0],clip);self.assertEqual(kwargs['suppress_tokens'],[-1,12,99])
  self.assertNotIn('initial_prompt',kwargs);self.assertFalse(kwargs['condition_on_previous_text'])
  self.assertEqual(result,[{'word':' second','start':.12,'end':.48,'probability':.98}])
 def test_default_preserves_existing_decoder_options(self):
  model=Mock();model.transcribe.return_value=([],None)
  with patch('scripts.v2_clip_transcription.spoken_number_suppression') as suppress:
   self.assertEqual(observe_clip(model,object()),[]);suppress.assert_not_called()
  self.assertNotIn('suppress_tokens',model.transcribe.call_args.kwargs)
