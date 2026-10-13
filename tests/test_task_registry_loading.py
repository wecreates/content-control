import copy
import unittest
from scripts.initialize_capability_progress import reconcile
from scripts.load_remaining_task_queue import build_queue

class RegistryLoadingTests(unittest.TestCase):
    def test_repair_preserves_proof_and_does_not_invent_domain(self):
        progress={'publication_enabled':False,'capabilities':{'1':{'state':'TESTED','evidence':['actual.json']}}}
        source={'publication_enabled':False,'capabilities':[{'id':1,'capability':'Existing','group':'Existing group','state':'INSTALLED','publication_enabled':False}]}
        original=copy.deepcopy(progress)
        result=reconcile(progress,[source])
        self.assertEqual(result['capabilities']['1'],dict(state='TESTED',evidence=['actual.json'],capability='Existing',group='Existing group'))
        self.assertEqual(progress,original)
        queue=build_queue(result)
        self.assertEqual(queue['tasks'],[])
        self.assertIn('missing_domain',queue['blocked_tasks'][0]['blockers'])
    def test_conflict_and_publication_fail_closed(self):
        progress={'publication_enabled':False,'capabilities':{'1':{'capability':'Original'}}}
        registry={'publication_enabled':False,'capabilities':[{'id':1,'capability':'Different','publication_enabled':False}]}
        with self.assertRaises(ValueError):reconcile(progress,[registry])
        with self.assertRaises(ValueError):reconcile(dict(progress,publication_enabled=True),[])
    def test_terminal_states_require_audit_unknown_states_block(self):
        base=dict(capability='Actual',group='Actual',domain='renderer')
        queue=build_queue({'capabilities':{'1':dict(base,state='RENDER_PROVEN'),'2':dict(base,state='BOGUS'),'3':dict(base)}})
        self.assertEqual(queue['total_tasks'],1)
        self.assertEqual(queue['tasks'][0]['required'],['audit_render_evidence'])
        self.assertEqual(queue['blocked_capabilities'],2)
        self.assertEqual(queue['status'],'BLOCKED')
        self.assertFalse(queue['publication_enabled'])
