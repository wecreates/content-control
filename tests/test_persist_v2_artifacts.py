import hashlib,json,subprocess,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from scripts import persist_v2_artifacts as module

class PersistenceTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
  self.remote=self.root/'remote.git';self.repo=self.root/'run';self.other=self.root/'other'
  self.gitcall('init','--bare','--initial-branch=main',str(self.remote))
  self.gitcall('clone',str(self.remote),str(self.repo));self.configure(self.repo)
  (self.repo/'unrelated.txt').write_text('original')
  self.draft(self.repo,1,b'old');self.commit(self.repo,'initial');self.gitcall('-C',str(self.repo),'push','origin','main')
  self.gitcall('clone',str(self.remote),str(self.other));self.configure(self.other)
 def tearDown(self):self.tmp.cleanup()
 def gitcall(self,*args):
  return subprocess.run(['git',*args],check=True,capture_output=True).stdout
 def configure(self,p):
  self.gitcall('-C',str(p),'config','user.name','test');self.gitcall('-C',str(p),'config','user.email','test@example.invalid')
 def commit(self,p,message):
  self.gitcall('-C',str(p),'add','.');self.gitcall('-C',str(p),'commit','-m',message)
 def draft(self,p,number,media):
  (p/'public-review').mkdir(exist_ok=True);(p/'state').mkdir(exist_ok=True)
  (p/'public-review/v2-draft.mp4').write_bytes(media)
  (p/'state/v2-draft.json').write_text(json.dumps({'run_id':number,'candidate_sha256':hashlib.sha256(media).hexdigest(),'publication_enabled':False,'production_approved':False,'full_av_review':False}))
 def remote_file(self,path):return self.gitcall('--git-dir',str(self.remote),'show','main:'+path)
 def test_concurrent_binary_update_preserves_other_files_and_worktree(self):
  self.draft(self.repo,3,b'new candidate')
  self.draft(self.other,2,b'concurrent candidate');(self.other/'unrelated.txt').write_text('keep this')
  self.commit(self.other,'concurrent');self.gitcall('-C',str(self.other),'push','origin','main')
  head=self.gitcall('-C',str(self.repo),'rev-parse','HEAD');index=self.gitcall('-C',str(self.repo),'diff','--cached')
  r=module.persist(self.repo,'draft')
  self.assertEqual(r['status'],'SAVED');self.assertEqual(self.remote_file('public-review/v2-draft.mp4'),b'new candidate')
  self.assertEqual(self.remote_file('unrelated.txt'),b'keep this')
  self.assertEqual(head,self.gitcall('-C',str(self.repo),'rev-parse','HEAD'));self.assertEqual(index,self.gitcall('-C',str(self.repo),'diff','--cached'))
 def test_newer_run_cannot_be_overwritten_and_hash_must_match(self):
  self.draft(self.repo,1,b'candidate');self.draft(self.other,4,b'newest');self.commit(self.other,'newest');self.gitcall('-C',str(self.other),'push','origin','main')
  self.assertEqual(module.persist(self.repo,'draft')['status'],'SUPERSEDED')
  self.assertEqual(self.remote_file('public-review/v2-draft.mp4'),b'newest')
  (self.repo/'public-review/v2-draft.mp4').write_bytes(b'tampered')
  with self.assertRaisesRegex(ValueError,'hash'):module.persist(self.repo,'draft')
 def test_push_race_refetches_without_force_or_binary_rebase(self):
  self.draft(self.repo,3,b'candidate');original=module.git;injected=[]
  def racing(repo,*args,**kwargs):
   if args[0]=='push' and not injected:
    injected.append(True);(self.other/'unrelated.txt').write_text('racing change');self.commit(self.other,'race');self.gitcall('-C',str(self.other),'push','origin','main')
   return original(repo,*args,**kwargs)
  with patch.object(module,'git',side_effect=racing):self.assertEqual(module.persist(self.repo,'draft')['status'],'SAVED')
  self.assertEqual(self.remote_file('unrelated.txt'),b'racing change')
  self.assertEqual(self.remote_file('public-review/v2-draft.mp4'),b'candidate')
 def test_report_order_and_publication_guard(self):
  path=self.repo/'state/v2-production-status.json'
  report={'run_id':9,'production_approved':False,'publication_enabled':False}
  path.write_text(json.dumps(report));self.assertEqual(module.persist(self.repo,'report')['status'],'SAVED')
  report['run_id']=8;path.write_text(json.dumps(report));self.assertEqual(module.persist(self.repo,'report')['status'],'SUPERSEDED')
  report['publication_enabled']=True;path.write_text(json.dumps(report))
  with self.assertRaisesRegex(ValueError,'publication-disabled'):module.persist(self.repo,'report')
if __name__=='__main__':unittest.main()
