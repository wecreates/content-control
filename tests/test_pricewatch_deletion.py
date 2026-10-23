from test_pricewatch_transaction import module,request,WORKER
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

class Deletion(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.db=str(Path(self.temp.name)/'prices.sqlite')
        module.record(self.db,request(1,'30'));module.record(self.db,request(2,'20'))
    def tearDown(self):self.temp.cleanup()
    def delete_request(self,scope='client-one'):
        return dict(operation='delete_watch',scope_id=scope,watch_id='watch-one',runtime_pid=os.getpid(),runtime_token='test-runtime')
    def counts(self):
        with sqlite3.connect(self.db) as c:
            return tuple(c.execute('select count(*) from '+table).fetchone()[0] for table in ['price_states','price_outbox','price_tombstones'])
    def test_atomic_delete_removes_state_outbox_and_blocks_recreation(self):
        self.assertEqual(self.counts(),(1,1,0));self.assertEqual(module.record(self.db,self.delete_request())['status'],'deleted')
        self.assertEqual(self.counts(),(0,0,1));self.assertEqual(module.record(self.db,request(3,'10'))['status'],'deleted');self.assertEqual(self.counts(),(0,0,1))
    def test_other_scope_with_same_watch_id_is_untouched(self):
        incoming=request(1,'30');incoming['scope_id']='client-two';module.record(self.db,incoming)
        incoming=request(2,'20');incoming['scope_id']='client-two';module.record(self.db,incoming)
        module.record(self.db,self.delete_request());self.assertEqual(self.counts(),(1,1,1))
        with sqlite3.connect(self.db) as c:self.assertEqual(c.execute('select scope from price_states').fetchone()[0],'client-two')
    def test_failure_between_deletes_rolls_back_tombstone_and_data(self):
        with sqlite3.connect(self.db) as c:c.execute("CREATE TRIGGER fail_delete BEFORE DELETE ON price_outbox BEGIN SELECT RAISE(ABORT,'injected'); END")
        with self.assertRaises(sqlite3.IntegrityError):module.record(self.db,self.delete_request())
        self.assertEqual(self.counts(),(1,1,0))
    def test_process_death_before_delete_commit_rolls_back(self):
        code="import importlib.util,json,os,sys;s=importlib.util.spec_from_file_location('worker',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.record(sys.argv[2],json.loads(sys.argv[3]),before_commit=lambda:os._exit(24))"
        p=subprocess.run([sys.executable,'-c',code,str(WORKER),self.db,json.dumps(self.delete_request())]);self.assertEqual(p.returncode,24);self.assertEqual(self.counts(),(1,1,0))
    def test_lost_delete_response_retries_idempotently(self):
        p=subprocess.run([sys.executable,str(WORKER),self.db],input=json.dumps(self.delete_request()),text=True,stdout=subprocess.DEVNULL)
        self.assertEqual(p.returncode,0);self.assertEqual(module.record(self.db,self.delete_request())['status'],'deleted');self.assertEqual(self.counts(),(0,0,1))
    def test_inflight_commit_then_waiting_delete_leaves_no_state_or_outbox(self):
        code="import importlib.util,json,sys;s=importlib.util.spec_from_file_location('worker',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);print(json.dumps(m.record(sys.argv[2],json.loads(sys.argv[3]),before_commit=lambda:(print('LOCKED',flush=True),sys.stdin.readline()))))"
        p=subprocess.Popen([sys.executable,'-c',code,str(WORKER),self.db,json.dumps(request(3,'10'))],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        try:
            self.assertEqual(p.stdout.readline().strip(),'LOCKED')
            d=subprocess.Popen([sys.executable,str(WORKER),self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
            try:
                d.stdin.write(json.dumps(self.delete_request()));d.stdin.close();d.stdin=None
                output,_=p.communicate('\n',timeout=10);self.assertEqual(json.loads(output)['status'],'recorded')
                output,_=d.communicate(timeout=10);self.assertEqual(json.loads(output)['status'],'deleted')
            finally:
                if d.poll() is None:d.kill();d.wait()
        finally:
            if p.poll() is None:p.kill();p.wait()
        self.assertEqual(self.counts(),(0,0,1))
    def test_tombstone_is_durable_after_new_connection(self):
        module.record(self.db,self.delete_request())
        incoming=self.delete_request();incoming['operation']='check_watch'
        p=subprocess.run([sys.executable,str(WORKER),self.db],input=json.dumps(incoming),text=True,capture_output=True)
        self.assertEqual(json.loads(p.stdout)['status'],'deleted')

if __name__=='__main__':unittest.main()
