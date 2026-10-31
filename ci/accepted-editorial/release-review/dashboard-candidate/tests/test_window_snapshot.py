import unittest,hashlib,os
from pathlib import Path
from unittest.mock import patch
import test_repository_window_review as existing
import scripts.repository_window_review as module
class SnapshotTests(unittest.TestCase):
 def setUp(self):
  self.case=existing.WindowReviewTests();self.case.setUp()
 def tearDown(self):self.case.tearDown()
 def test_all_four_documents_mutated_after_read_keep_original_snapshot(self):
  c=self.case;paths=[c.h/'handoff.json',c.h/'transcript-input.json',c.result,c.receipt];original={p:p.read_bytes() for p in paths};counts={p:0 for p in paths};base=Path.open
  class Stream:
   def __init__(self,p,f):self.p=p;self.f=f
   def __enter__(self):return self
   def __exit__(self,*a):self.f.close()
   def fileno(self):return self.f.fileno()
   def read(self,n):
    self_data=self.f.read(n);counts[self.p]+=1
    assert n==module.EVIDENCE_LIMIT+1
    with base(self.p,'wb') as out:out.write(b'{}')
    return self_data
  def opened(p,mode='r',*a,**kw):
   f=base(p,mode,*a,**kw)
   return Stream(p,f) if p in paths and mode=='rb' else f
  with patch.object(Path,'open',opened):d=c.run_review()
  self.assertEqual(list(counts.values()),[1,1,1,1]);self.assertEqual(d['raw_windows'],c.windows)
  for field,p in [('handoff_sha256',paths[0]),('transcript_sha256',paths[1]),('result_sha256',paths[2]),('receipt_sha256',paths[3])]:self.assertEqual(d[field],hashlib.sha256(original[p]).hexdigest())
 def test_oversize_handoff_rejects_before_read_or_parse(self):
  c=self.case;p=c.h/'handoff.json'
  with p.open('wb') as f:f.truncate(module.EVIDENCE_LIMIT+1)
  with patch.object(module.json,'loads',side_effect=AssertionError('must not parse oversized handoff')):
   with self.assertRaisesRegex(ValueError,'BOUNDED'):c.run_review()
  self.assertFalse((c.root/'output').exists())
 def test_growth_after_stat_still_bounded_and_rejected(self):
  c=self.case;target=c.h/'handoff.json';base=Path.open;sizes=[]
  class Stream:
   def __init__(self,f):self.f=f
   def __enter__(self):return self
   def __exit__(self,*a):self.f.close()
   def fileno(self):return self.f.fileno()
   def read(self,n):sizes.append(n);return b' '*n
  def opened(p,mode='r',*a,**kw):
   f=base(p,mode,*a,**kw);return Stream(f) if p==target and mode=='rb' else f
  with patch.object(Path,'open',opened):
   with self.assertRaisesRegex(ValueError,'BOUNDED'):c.run_review()
  self.assertEqual(sizes,[module.EVIDENCE_LIMIT+1]);self.assertFalse((c.root/'output').exists())
