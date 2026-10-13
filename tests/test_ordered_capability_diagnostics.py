import tempfile,unittest
from pathlib import Path
from types import SimpleNamespace
from scripts.complete_task_one_by_one import select_task
from scripts.upgrade_and_test_capability import diagnose,SUITES
class OrderedDiagnosticsTests(unittest.TestCase):
 def test_blocked_and_empty_queue_and_missing_domain_never_execute(self):
  for q in ({'status':'BLOCKED','publication_enabled':False,'tasks':[]},{'status':'READY','publication_enabled':False,'tasks':[]},{'status':'READY','publication_enabled':False,'tasks':[{'capability_id':1,'group':'reliability','publication_enabled':False}]}):
   with self.assertRaises(ValueError):select_task(q,0)
 def test_unknown_domain_has_no_generic_fallback(self):
  def forbidden(*a,**k):self.fail('unknown domain executed')
  result=diagnose({'capability':'Existing capability','group':'Existing group','current_state':'INTEGRATED','capability_id':1,'domain':'unknown','publication_enabled':False},runner=forbidden)
  self.assertEqual(result['status'],'BLOCKED')
 def test_passing_domain_checks_cannot_promote_task(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory)
   for name in SUITES['reliability'].split():
    file=root/name;file.parent.mkdir(parents=True,exist_ok=True);file.touch()
   calls=[]
   def runner(cmd,**kwargs):calls.append(cmd);return SimpleNamespace(returncode=0,stdout='SECRET',stderr='')
   result=diagnose({'capability':'Existing capability','group':'Existing group','current_state':'INTEGRATED','capability_id':1,'domain':'reliability','publication_enabled':False},root,runner)
   self.assertEqual(result['status'],'CHECKS_PASSED_UNVERIFIED');self.assertFalse(result['completion_verified']);self.assertNotIn('proven_state',result);self.assertNotIn('upgrade_state',result);self.assertNotIn('SECRET',str(result));self.assertEqual(len(calls),1)
   (root/SUITES['reliability'].split()[0]).unlink()
   self.assertEqual(diagnose({'capability':'Existing capability','group':'Existing group','current_state':'INTEGRATED','capability_id':1,'domain':'reliability','publication_enabled':False},root,runner)['reason'],'paired_test_missing');self.assertEqual(len(calls),1)

 def test_malformed_direct_input_blocks_without_execution(self):
  def forbidden(*args,**kwargs):self.fail('invalid task executed')
  valid={'capability_id':1,'capability':'Existing','group':'Existing','current_state':'INTEGRATED','domain':'reliability','publication_enabled':False}
  invalid=[None,[],42,'task',dict(valid,domain=[]),dict(valid,domain={}),dict(valid,current_state='BOGUS')]
  for field in ('capability','group','current_state'):
   task=valid.copy();del task[field];invalid.append(task)
  for task in invalid:
   with self.subTest(task=task):
    result=diagnose(task,runner=forbidden)
    self.assertEqual(result['status'],'BLOCKED');self.assertFalse(result['completion_verified'])
