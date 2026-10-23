import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

WORKER = Path(__file__).resolve().parents[1] / 'pricewatch-transaction.py'
spec = importlib.util.spec_from_file_location('transaction', WORKER)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def request(n, amount):
    product={'@context':'https://schema.org','@type':'Product','sku':'mug','offers':{'@type':'Offer','price':amount,'priceCurrency':'USD','availability':'https://schema.org/InStock'}}
    return dict(runtime_pid=os.getpid(),runtime_token='test-runtime',continuity_epoch='test-process-epoch',scope_id='client-one',watch_id='watch-one',currency='USD',observation_id=f'check-{n}',observed_at=f'2026-10-21T12:00:{n:02}Z',page_url='https://shop.example.test/item',html='<script type="application/ld+json">'+json.dumps(product)+'</script>')

class Transactions(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = str(Path(self.temp.name)/'prices.sqlite')
        module.record(self.db,request(1,'30'))
    def tearDown(self):
        self.temp.cleanup()
    def counts(self):
        with sqlite3.connect(self.db) as c:
            return json.loads(c.execute('select state from price_states').fetchone()[0])['revision'],c.execute('select count(*) from price_outbox').fetchone()[0]
    def test_failure_between_state_and_outbox_rolls_back_both(self):
        with sqlite3.connect(self.db) as c:
            c.execute("CREATE TRIGGER fail_outbox BEFORE INSERT ON price_outbox BEGIN SELECT RAISE(ABORT, 'injected'); END")
        with self.assertRaises(sqlite3.IntegrityError):module.record(self.db,request(2,'20'))
        self.assertEqual(self.counts(),(1,0))
    def test_process_crash_before_commit_rolls_back_both(self):
        code="import importlib.util,json,os,sys;s=importlib.util.spec_from_file_location('worker',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.record(sys.argv[2],json.loads(sys.argv[3]),before_commit=lambda:os._exit(23))"
        p=subprocess.run([sys.executable,'-c',code,str(WORKER),self.db,json.dumps(request(2,'20'))])
        self.assertEqual(p.returncode,23);self.assertEqual(self.counts(),(1,0))
        self.assertEqual(module.record(self.db,request(2,'20'))['status'],'recorded');self.assertEqual(self.counts(),(2,1))
    def test_lost_response_after_commit_replay_keeps_one_outbox_row(self):
        p=subprocess.run([sys.executable,str(WORKER),self.db],input=json.dumps(request(2,'20')),text=True,stdout=subprocess.DEVNULL)
        self.assertEqual(p.returncode,0);self.assertEqual(self.counts(),(2,1))
        self.assertEqual(module.record(self.db,request(2,'20'))['status'],'duplicate');self.assertEqual(self.counts(),(2,1))
    def test_competing_live_runtime_cannot_steal_database(self):
        incoming=request(2,'20');incoming['runtime_token']='other-process-token'
        self.assertEqual(module.record(self.db,incoming)['reason'],'another_runtime_owns_database')
        self.assertEqual(self.counts(),(1,0))
    def test_epoch_change_after_uncertain_commit_rebaselines_and_retains_candidate(self):
        module.record(self.db,request(2,'20'))
        retry=request(2,'20');retry['continuity_epoch']='new-epoch'
        self.assertEqual(module.record(self.db,retry)['status'],'duplicate')
        incoming=request(3,'10');incoming['continuity_epoch']='new-epoch'
        result=module.record(self.db,incoming)
        self.assertEqual(result['monitoring_status'],'baseline_recorded');self.assertFalse(result['candidate_queued'])
        self.assertEqual(self.counts(),(4,1))
    def test_owner_restart_requires_rebaseline(self):
        # A real subprocess owns and commits a separate DB, then exits.
        other=str(Path(self.temp.name)/'restart.sqlite')
        code="import importlib.util,json,os,sys;s=importlib.util.spec_from_file_location('worker',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);r=json.loads(sys.argv[3]);r.update(runtime_pid=os.getpid(),runtime_token='old-process',continuity_epoch='old-epoch');assert m.record(sys.argv[2],r)['status']=='recorded'"
        p=subprocess.run([sys.executable,'-c',code,str(WORKER),other,json.dumps(request(1,'30'))]);self.assertEqual(p.returncode,0)
        result=module.record(other,request(2,'10'))
        self.assertEqual(result['monitoring_status'],'baseline_recorded');self.assertFalse(result['candidate_queued'])
        with sqlite3.connect(other) as c:self.assertEqual(c.execute('select count(*) from price_outbox').fetchone()[0],0)
    def test_same_id_different_payload_rejected(self):
        module.record(self.db,request(2,'20'))
        self.assertEqual(module.record(self.db,request(2,'10'))['status'],'rejected');self.assertEqual(self.counts(),(2,1))

if __name__=='__main__':unittest.main()
