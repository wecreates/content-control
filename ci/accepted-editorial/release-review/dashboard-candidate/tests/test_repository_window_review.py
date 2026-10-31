import unittest,json,tempfile,hashlib,subprocess,sys,copy
from pathlib import Path
from datetime import datetime,timezone,timedelta
from scripts.repository_window_review import review_windows,PIN
class WindowReviewTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.h=self.root/'handoff';self.h.mkdir();(self.root/'public-review').mkdir();(self.root/'public-review/v2-draft.mp4').write_bytes(b'SYNTHETIC NOT MEDIA')
  (self.h/'openshorts-transcript-windows').mkdir();self.result=self.h/'openshorts-transcript-windows/result.json';self.receipt=Path(str(self.result)+'.receipt.json')
  self.source={'duration':30,'transcript':{'segments':[{'start':0,'end':10,'text':'Synthetic opening.'},{'start':10,'end':20,'text':'Synthetic support.'},{'start':20,'end':30,'text':'Synthetic ending.'}]}}
  self.windows=[{'id':'window_001','start':0,'end':20,'text':'Synthetic opening. Synthetic support.'},{'id':'window_002','start':20,'end':30,'text':'Synthetic ending.'}]
  self.p={'schema_version':1,'tool':'openshorts','operation':'transcript-windows','revision':PIN,'status':'PASS','verified_at':datetime.now(timezone.utc).isoformat(),'publication_enabled':False}
  self.sync()
 def tearDown(self):self.tmp.cleanup()
 def sync(self):
  def write(p,obj):p.write_text(json.dumps(obj));return hashlib.sha256(p.read_bytes()).hexdigest()
  ih=write(self.h/'transcript-input.json',self.source);rh=write(self.result,self.windows);self.p['output_sha256']=rh;write(self.receipt,self.p)
  m={'candidate_sha256':hashlib.sha256(b'SYNTHETIC NOT MEDIA').hexdigest(),'publication_enabled':False,'production_approved':False,'inputs':{'transcript-input.json':ih},'operations':[{'tool':'openshorts','operation':'transcript-windows','input_sha256':ih,'output_sha256':rh,'receipt':self.p}]}
  self.mh=write(self.h/'handoff.json',m)
 def run_review(self):return review_windows(self.root,self.h,self.root/'output',self.mh,'SYNTHETIC_FIXTURE')
 def test_actual_existing_cli_generates_disabled_clipper_drafts(self):
  cli=Path(__file__).parents[1]/'scripts/repository_v2_handoff.py'
  r=subprocess.run([sys.executable,'-B',str(cli),'review-windows','--root',str(self.root),'--handoff',str(self.h),'--handoff-sha256',self.mh,'--evidence-kind','SYNTHETIC_FIXTURE','--out',str(self.root/'output')],capture_output=True,text=True)
  self.assertEqual(r.returncode,0,r.stderr);d=json.loads((self.root/'output/window-review.json').read_bytes());self.assertEqual(len(d['proposals']),2);self.assertEqual(d['evidence_kind'],'SYNTHETIC_FIXTURE');self.assertFalse(d['production_approved']);self.assertFalse(d['semantic_review_verified'])
  for p in d['proposals']:self.assertFalse(p['dispatch_enabled']);self.assertNotIn('output',p['proposed_job']);self.assertIsNone(p['review']['standalone_opening'])
 def test_wrong_source_bytes_rejected_before_output(self):
  (self.h/'transcript-input.json').write_text('{}')
  with self.assertRaises(ValueError):self.run_review()
  self.assertFalse((self.root/'output').exists())
 def test_stale_and_unverified_receipt_rejected(self):
  for key,value in [('verified_at',(datetime.now(timezone.utc)-timedelta(days=8)).isoformat()),('status','BLOCKED'),('revision','a'*40),('publication_enabled',True)]:
   original=copy.deepcopy(self.p);self.p[key]=value;self.sync()
   with self.assertRaises(ValueError):self.run_review()
   self.p=original
 def test_rehashed_invented_text_bool_bounds_and_duplicate_reject(self):
  original=copy.deepcopy(self.windows)
  for change in [{'text':'Invented meaning'},{'start':False},{'end':31},{'id':'window_002'}]:
   self.windows=copy.deepcopy(original);self.windows[0].update(change);self.sync()
   with self.assertRaises(ValueError):self.run_review()
 def test_changed_candidate_and_wrong_handoff_hash_reject(self):
  self.mh='0'*64
  with self.assertRaises(ValueError):self.run_review()
  self.sync();(self.root/'public-review/v2-draft.mp4').write_bytes(b'changed')
  with self.assertRaises(ValueError):self.run_review()
 def test_existing_output_not_overwritten(self):
  self.run_review();saved=(self.root/'output/window-review.json').read_bytes()
  with self.assertRaises(FileExistsError):self.run_review()
  self.assertEqual(saved,(self.root/'output/window-review.json').read_bytes())
