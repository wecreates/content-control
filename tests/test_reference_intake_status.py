import hashlib,json,subprocess,tempfile,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from scripts.ingest_reference_video import ingest

class ReferenceIntakeStatusTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
  self.args=SimpleNamespace(root=str(self.root),id='valid-reference',video='local.mp4',source_type='chat_upload',characters='dave')
  self.status=self.root/self.args.id/'intake-status.json'
 def tearDown(self):self.tmp.cleanup()
 def fake_stage(self,cmd,**kwargs):
  self.assertEqual(kwargs['env']['PUBLICATION_ENABLED'],'false')
  status=json.loads(self.status.read_text());self.assertEqual(status['status'],'RUNNING');self.assertFalse(status['production_approved'])
  if '--out' in cmd:Path(cmd[cmd.index('--out')+1]).write_text('{}')
  return subprocess.CompletedProcess(cmd,0)
 def test_success_stage_order_internal_draft_and_artifact_hashes(self):
  with patch('scripts.ingest_reference_video.subprocess.run',side_effect=self.fake_stage) as run:r=ingest(self.args)
  self.assertEqual(run.call_count,9);self.assertEqual([x['name'] for x in r['stages']],['decompose','optical_flow','motion_summary','structure','enrich','validate_reference','compile_clone','validate_clone','scene_plan'])
  self.assertEqual(r['status'],'COMPLETED');self.assertFalse(r['production_approved']);self.assertFalse(r['publication_enabled']);self.assertEqual(r['scope'],'internal_draft_only')
  self.assertEqual(set(r['artifacts_sha256']),{'reference.json','clone-blueprint.json','scene-plan.json'})
  for name,digest in r['artifacts_sha256'].items():self.assertEqual(digest,hashlib.sha256((self.status.parent/name).read_bytes()).hexdigest())
 def test_failure_rethrows_stops_stages_and_does_not_leak_outputs(self):
  calls=[]
  def fail_stage(cmd,**kwargs):
   calls.append(cmd)
   if len(calls)==3:raise subprocess.CalledProcessError(7,cmd,output='TOKEN_SHOULD_NOT_APPEAR',stderr='SECRET')
   return self.fake_stage(cmd,**kwargs)
  with patch('scripts.ingest_reference_video.subprocess.run',side_effect=fail_stage):
   with self.assertRaises(subprocess.CalledProcessError):ingest(self.args)
  self.assertEqual(len(calls),3);text=self.status.read_text();r=json.loads(text)
  self.assertEqual(r['status'],'BLOCKED');self.assertEqual(r['failed_stage'],'motion_summary');self.assertEqual(r['exit_code'],7);self.assertEqual(r['stages'][3]['status'],'NOT_STARTED');self.assertNotIn('SECRET',text);self.assertNotIn('TOKEN_',text)
 def test_retry_clears_stale_success_before_first_subprocess(self):
  self.status.parent.mkdir();self.status.write_text(json.dumps({'status':'COMPLETED','artifacts_sha256':{'stale':'hash'},'production_approved':True}))
  def fail(cmd,**kwargs):
   r=json.loads(self.status.read_text());self.assertEqual(r['status'],'RUNNING');self.assertEqual(r['artifacts_sha256'],{});self.assertFalse(r['production_approved']);raise OSError('private path detail')
  with patch('scripts.ingest_reference_video.subprocess.run',side_effect=fail):
   with self.assertRaises(OSError):ingest(self.args)
  r=json.loads(self.status.read_text());self.assertEqual(r['status'],'BLOCKED');self.assertEqual(r['failed_stage'],'decompose');self.assertIsNone(r['exit_code'])
 def test_missing_artifacts_never_claim_completion(self):
  with patch('scripts.ingest_reference_video.subprocess.run',return_value=subprocess.CompletedProcess([],0)):
   with self.assertRaises(OSError):ingest(self.args)
  r=json.loads(self.status.read_text());self.assertEqual(r['status'],'BLOCKED');self.assertEqual(r['failed_stage'],'artifact_verification')
 def test_invalid_ids_and_symlink_escape_rejected_before_writes(self):
  for value in ['', '.', '..', '../outside', '/tmp/outside', 'a/b']:
   self.args.id=value
   with self.assertRaises(ValueError):ingest(self.args)
  self.assertEqual(list(self.root.iterdir()),[])
  with tempfile.TemporaryDirectory() as outside:
   (self.root/'escape').symlink_to(outside,target_is_directory=True);self.args.id='escape'
   with self.assertRaises(ValueError):ingest(self.args)
   self.assertEqual(list(Path(outside).iterdir()),[])
if __name__=='__main__':unittest.main()
