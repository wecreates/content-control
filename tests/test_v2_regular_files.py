import hashlib,json,os,subprocess,sys,tempfile,unittest
from pathlib import Path
from scripts.v2_build_status import candidate_digest,read_receipt,summarize

ROOT=Path(__file__).resolve().parents[1]
class RegularFileTests(unittest.TestCase):
 def run_child(self,code,*args):
  result=subprocess.run([sys.executable,'-c',code,*map(str,args)],cwd=ROOT,text=True,capture_output=True,timeout=1.5)
  self.assertEqual(result.returncode,0,result.stderr);return json.loads(result.stdout)
 def test_fifo_and_symlink_fifo_receipts_fail_without_blocking(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);(root/'receipts').mkdir();fifo=root/'input.pipe';os.mkfifo(fifo)
   receipt=root/'receipts/voice.json'
   for linked in [False,True]:
    if linked:receipt.symlink_to(fifo)
    else:os.mkfifo(receipt)
    result=self.run_child("from scripts.v2_build_status import summarize;import sys,json;print(json.dumps(summarize(sys.argv[1],123,'a'*40,'success')))",root)
    self.assertEqual(result['checks']['voices']['status'],'INVALID_RECEIPT');self.assertFalse(result['production_approved']);receipt.unlink()
 def test_fifo_and_symlink_fifo_candidates_fail_without_blocking(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);fifo=root/'candidate';os.mkfifo(fifo);alias=root/'candidate-link';alias.symlink_to(fifo)
   for target in [fifo,alias]:
    self.assertIsNone(self.run_child("from scripts.v2_build_status import candidate_digest;from pathlib import Path;import sys,json;print(json.dumps(candidate_digest(Path(sys.argv[1]))))",target))
 def test_regular_symlink_empty_missing_and_size_limits(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);regular=root/'receipt.json';payload=b'{"status":"PASS"}';regular.write_bytes(payload);alias=root/'receipt-link';alias.symlink_to(regular)
   for target in [regular,alias]:
    self.assertEqual(read_receipt(target),payload);self.assertEqual(candidate_digest(target),hashlib.sha256(payload).hexdigest())
   empty=root/'empty';empty.touch()
   for target in [empty,root/'missing',root]:
    self.assertIsNone(candidate_digest(target))
    with self.assertRaises((ValueError,OSError)):read_receipt(target)
   with regular.open('wb') as stream:stream.truncate(512*1024+1)
   with self.assertRaises(ValueError):read_receipt(regular)
   with regular.open('wb') as stream:stream.truncate(512*1024*1024+1)
   self.assertIsNone(candidate_digest(regular))
 def test_receipt_hash_uses_the_same_bytes_that_were_parsed(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);(root/'receipts').mkdir();receipt=root/'receipts/voice.json';payload=b'{"status":"PASS","publication_enabled":false}';receipt.write_bytes(payload)
   report=summarize(root,123,'a'*40,'success')
   self.assertEqual(report['checks']['voices']['receipt_sha256'],hashlib.sha256(payload).hexdigest())

if __name__=='__main__':unittest.main()
