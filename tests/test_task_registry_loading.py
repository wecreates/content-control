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

    def test_queue_requires_explicit_false_original_publication_policy(self):
        from scripts.complete_task_one_by_one import select_task
        base = {'capabilities': {'1': dict(capability='Synthetic fixture',
                group='Synthetic group', domain='renderer', state='TESTED',
                evidence=['unchanged.json'])}, 'custom': {'keep': [1, 2]}}
        cases = [('missing', None), ('true', True), ('null', None),
                 ('zero', 0), ('string_false', 'false')]
        for label, value in cases:
            with self.subTest(policy=label):
                progress = copy.deepcopy(base)
                if label != 'missing':
                    progress['publication_enabled'] = value
                original = copy.deepcopy(progress)
                queue = build_queue(progress)
                self.assertEqual(progress, original)
                self.assertEqual(queue['status'], 'BLOCKED')
                self.assertIn('publication_must_remain_disabled', queue['blockers'])
                self.assertIs(queue['publication_enabled'], False)
                self.assertEqual(queue['total_tasks'], 1)
                self.assertEqual(queue['tasks'][0]['required'], ['verify_render_evidence'])
                with self.assertRaisesRegex(ValueError, 'queue_not_ready'):
                    select_task(queue, 0)

    def test_explicit_false_preserves_complete_queue_behavior_and_input(self):
        from scripts.autonomous_completion_scheduler import build_plan
        from scripts.complete_task_one_by_one import select_task
        states = ['MISSING', 'INSTALLED', 'IMPLEMENTED', 'INTEGRATED',
                  'TESTED', 'RENDER_PROVEN']
        progress = {'publication_enabled': False, 'custom': {'keep': ['value']},
                    'capabilities': {str(i): dict(capability='Synthetic fixture',
                        group='Synthetic group', domain='renderer', state=state,
                        evidence=['unchanged.json'])
                        for i, state in enumerate(states, 1)}}
        original = copy.deepcopy(progress)
        expected = build_plan(progress, shards=1, limit=len(states))
        for position, task in enumerate(expected['tasks'], 1):
            task.update(position=position, status='QUEUED')
        expected.update(mode='ORDERED_COMPLETION', total_tasks=len(states))
        queue = build_queue(progress)
        self.assertEqual(queue, expected)
        self.assertEqual(progress, original)
        self.assertEqual(queue['status'], 'READY')
        self.assertIs(queue['publication_enabled'], False)
        self.assertNotIn('completion_verified', queue)
        for i, state in enumerate(states):
            task = select_task(queue, i)
            self.assertEqual(task['current_state'], state)
            self.assertEqual(task['status'], 'QUEUED')
            self.assertIs(task['publication_enabled'], False)
            self.assertNotIn('proven_state', task)
            self.assertNotIn('upgrade_state', task)
            self.assertNotIn('completion_verified', task)
        self.assertEqual(queue['tasks'][-1]['required'], ['audit_render_evidence'])
        queue['tasks'][0]['required'].append('synthetic output mutation')
        self.assertEqual(progress, original)

    def test_malformed_progress_fails_closed_without_mutation(self):
        from scripts.complete_task_one_by_one import select_task
        malformed = [None, [], 0, False, 'progress', {},
                     {'publication_enabled': False},
                     *({'publication_enabled': False, 'capabilities': value}
                       for value in [None, 0, False, 'invalid', [], {}, {'1': None}])]
        for progress in malformed:
            with self.subTest(progress=progress):
                original = copy.deepcopy(progress)
                queue = build_queue(progress)
                self.assertEqual(progress, original)
                self.assertEqual(queue['status'], 'BLOCKED')
                self.assertIs(queue['publication_enabled'], False)
                self.assertEqual(queue['tasks'], [])
                self.assertEqual(queue['total_tasks'], 0)
                with self.assertRaisesRegex(ValueError, 'queue_not_ready'):
                    select_task(queue, 0)
