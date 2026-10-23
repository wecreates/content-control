from test_pricewatch_transaction import module,request,WORKER
from datetime import datetime,timedelta,timezone
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

class Capacity(unittest.TestCase):
    def setUp(self):self.temp=tempfile.TemporaryDirectory();self.db=str(Path(self.temp.name)/'prices.sqlite')
    def tearDown(self):self.temp.cleanup()
    def req(self,n,amount,watch='watch-one',limits=None):
        r=request(1,amount);r.update(observation_id=f'check-{n}',watch_id=watch,observed_at=(datetime(2026,10,22,tzinfo=timezone.utc)+timedelta(seconds=n)).isoformat().replace('+00:00','Z'))
        if limits:r['outbox_limits']=limits
        return r
    def state(self):
        with sqlite3.connect(self.db) as c:return (c.execute('select scope,watch,state,epoch from price_states order by scope,watch').fetchall(),c.execute('select * from price_outbox order by event_id').fetchall(),c.execute('select * from price_tombstones').fetchall())
    def test_watch_cap_preserves_every_candidate_and_state(self):
        module.record(self.db,self.req(1,'30',limits={'per_watch':1,'database_total':2}));module.record(self.db,self.req(2,'20'));before=self.state()
        self.assertEqual(module.record(self.db,self.req(3,'10'))['status'],'capacity_blocked');self.assertEqual(self.state(),before)
        self.assertEqual(module.record(self.db,self.req(2,'20'))['status'],'duplicate');self.assertEqual(self.state(),before)
        self.assertEqual(module.record(self.db,self.req(2,'19'))['status'],'rejected');self.assertEqual(self.state(),before)
    def test_scope_watch_limits_are_independent_until_global_capacity(self):
        module.record(self.db,self.req(1,'30',limits={'per_watch':1,'database_total':2}));module.record(self.db,self.req(2,'20'))
        r=self.req(1,'30');r['scope_id']='client-two';self.assertEqual(module.record(self.db,r)['status'],'recorded')
        r=self.req(2,'20');r['scope_id']='client-two';self.assertTrue(module.record(self.db,r)['candidate_queued']);before=self.state()
        self.assertEqual(module.record(self.db,self.req(1,'30','watch-three'))['status'],'capacity_blocked');self.assertEqual(self.state(),before)
    def test_limits_persist_and_cannot_silently_change(self):
        module.record(self.db,self.req(1,'30',limits={'per_watch':1,'database_total':2}));module.record(self.db,self.req(2,'20'));before=self.state()
        self.assertEqual(module.record(self.db,self.req(3,'10',limits={'per_watch':2,'database_total':2}))['reason'],'outbox_limits_migration_required');self.assertEqual(self.state(),before)
        p=subprocess.run([sys.executable,str(WORKER),self.db],input=json.dumps(self.req(3,'10')),text=True,capture_output=True);self.assertEqual(json.loads(p.stdout)['status'],'capacity_blocked')
    def test_invalid_limits_never_create_price_rows(self):
        for policy in [{'per_watch':True,'database_total':2},{'per_watch':0,'database_total':2},{'per_watch':2,'database_total':1},{'per_watch':129,'database_total':10000},{'per_watch':1,'database_total':10001},{'per_watch':1,'database_total':2,'extra':True}]:
            self.assertEqual(module.record(self.db,self.req(1,'30',limits=policy))['reason'],'invalid_outbox_limits')
        with sqlite3.connect(self.db) as c:
            self.assertEqual(c.execute('select count(*) from price_states').fetchone()[0],0)
            self.assertEqual(c.execute('select count(*) from price_outbox').fetchone()[0],0)
            self.assertEqual(c.execute("select name from sqlite_master where name='price_outbox_limits'").fetchall(),[])
    def test_existing_overfull_database_is_preserved_not_trimmed(self):
        module.record(self.db,self.req(1,'30'));module.record(self.db,self.req(2,'20'))
        with sqlite3.connect(self.db) as c:
            event=c.execute('select event from price_outbox').fetchone()[0]
            c.executemany('insert into price_outbox values (?,?,?,?)',[(f'legacy-{i}','client-one','watch-one',event) for i in range(128)])
            c.execute('drop table price_outbox_limits')
        before=self.state();self.assertEqual(module.record(self.db,self.req(3,'10'))['status'],'capacity_blocked');self.assertEqual(self.state(),before)
    def test_concurrent_last_slot_admission_is_atomic(self):
        module.record(self.db,self.req(1,'30','watch-one',{'per_watch':1,'database_total':1}));module.record(self.db,self.req(1,'30','watch-two'))
        for watch in ['watch-one','watch-two']:
            r=self.req(2,'20',watch);r['operation']='check_watch';self.assertEqual(module.record(self.db,r)['status'],'active')
        processes=[]
        try:
            for watch in ['watch-one','watch-two']:
                p=subprocess.Popen([sys.executable,str(WORKER),self.db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);p.stdin.write(json.dumps(self.req(2,'20',watch)));p.stdin.close();p.stdin=None;processes.append(p)
            outcomes=[json.loads(p.communicate(timeout=10)[0])['status'] for p in processes]
            self.assertEqual(sorted(outcomes),['capacity_blocked','recorded']);self.assertEqual(len(self.state()[1]),1)
            self.assertEqual(sorted(json.loads(row[2])['revision'] for row in self.state()[0]),[1,2])
        finally:
            for p in processes:
                if p.poll() is None:p.kill();p.wait()
    def test_deletion_still_works_at_capacity_and_tombstone_prevents_recreation(self):
        module.record(self.db,self.req(1,'30',limits={'per_watch':1,'database_total':1}));module.record(self.db,self.req(2,'20'))
        lookup=self.req(3,'10');lookup.update(operation='deleted_watches',watch_ids=['watch-one']);self.assertEqual(module.record(self.db,lookup),{'status':'inspected','deleted_ids':[]})
        r=self.req(3,'10');r['operation']='delete_watch';self.assertEqual(module.record(self.db,r)['status'],'deleted');self.assertEqual(module.record(self.db,self.req(4,'5'))['status'],'deleted');self.assertEqual(len(self.state()[1]),0);self.assertEqual(len(self.state()[2]),1)
    def test_persisted_observation_history_remains_bounded(self):
        for n in range(1,141):self.assertEqual(module.record(self.db,self.req(n,'30'))['status'],'recorded')
        state=json.loads(self.state()[0][0][2]);self.assertEqual(len(state['history']),128);self.assertEqual(state['revision'],140);self.assertEqual(len(self.state()[1]),0)

if __name__=='__main__':unittest.main()
