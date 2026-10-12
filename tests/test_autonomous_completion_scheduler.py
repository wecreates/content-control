import copy
import unittest
from scripts.autonomous_completion_scheduler import build_plan


def row(state):
    return dict(state=state, capability='Wallet animation', group='animation', domain='renderer')


class CompletionSchedulerTests(unittest.TestCase):
    def test_integrated_and_tested_remain_pending(self):
        progress = {'capabilities': {str(i): row('TESTED' if i <= 160 else 'INTEGRATED') for i in range(1, 2501)}}
        original = copy.deepcopy(progress)
        plan = build_plan(progress, shards=16, limit=160)
        self.assertEqual(plan['remaining_total'], 2500)
        self.assertEqual(plan['remaining_selected'], 160)
        self.assertTrue(all(t['required'] == ['verify_render_evidence'] for t in plan['tasks']))
        self.assertEqual(progress, original)
        self.assertFalse(plan['publication_enabled'])

    def test_no_false_completion_or_invented_metadata(self):
        for progress in [{}, {'capabilities': {}}, {'capabilities': []}]:
            self.assertEqual(build_plan(progress)['status'], 'BLOCKED')
        plan = build_plan({'capabilities': {'1': {'state': 'INTEGRATED'}, '2': row('BOGUS')}})
        self.assertEqual(plan['status'], 'BLOCKED')
        self.assertEqual(plan['remaining_total'], 2)
        self.assertEqual(plan['tasks'], [])
        self.assertEqual(plan['blocked_tasks'][0]['domain'], 'unknown')
        self.assertIn('missing_domain', plan['blocked_tasks'][0]['blockers'])
        self.assertIn('unknown_capability_state', plan['blocked_tasks'][1]['blockers'])

    def test_limits_do_not_hide_blockers_or_remaining(self):
        plan = build_plan({'capabilities': {'1': row('TESTED'), '2': row('BOGUS')}}, limit=1)
        self.assertEqual(plan['status'], 'BLOCKED')
        self.assertEqual(plan['remaining_total'], 2)
        for value in [0, -1, True, 1.5]:
            for option in ['limit', 'shards']:
                with self.assertRaises(ValueError):
                    build_plan({}, **{option: value})

    def test_recorded_proof_requires_audit_and_invalid_rows_stay_visible(self):
        plan = build_plan({'capabilities': {'1': row('RENDER_PROVEN'), 'bad': None}})
        self.assertEqual(plan['tasks'][0]['required'], ['audit_render_evidence'])
        self.assertEqual(plan['remaining_total'], 2)
        self.assertEqual(plan['status'], 'BLOCKED')


if __name__ == '__main__':
    unittest.main()
