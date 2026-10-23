"""Independent adversarial lifecycle review; local synthetic observations only."""
import copy
from datetime import datetime, timedelta, timezone
from decimal import Decimal, localcontext
import json
from pathlib import Path
import random
import unittest

from pricewatch_price import create_watch, extract_price, observe_watch
from pricewatch_price.history import HISTORY_LIMIT, MAX_REVISION, _threshold, _valid_state

PAGE = 'https://shop.example.test/products/mug'
FIXTURE = (Path(__file__).parent / 'fixtures' / 'baseline.html').read_text(encoding='utf-8')


def observation(price='100', availability='InStock', currency='USD', color='blue'):
    html = FIXTURE.replace('"price": "29.90"', '"price": ' + json.dumps(price))
    html = html.replace('schema.org/InStock', 'schema.org/' + availability)
    html = html.replace('"USD"', json.dumps(currency)).replace('"blue"', json.dumps(color))
    result = extract_price(html, page_url=PAGE)
    assert result['status'] == 'ok', result
    return result


def empty(**policy):
    return create_watch('review-client', 'review-watch', currency='USD', **policy)['state']


def apply(state, data, index, **overrides):
    observed_at = (datetime(2026, 10, 21, tzinfo=timezone.utc) + timedelta(seconds=index)).isoformat().replace('+00:00', 'Z')
    arguments = dict(scope_id='review-client', watch_id='review-watch',
                     observation_id=f'review-{index}', observed_at=observed_at)
    arguments.update(overrides)
    return observe_watch(state, data, **arguments)


def fixed_decimal(coefficient, scale):
    digits = str(coefficient).zfill(scale + 1)
    return digits if not scale else digits[:-scale] + '.' + digits[-scale:]


class IndependentHistoryReviewTests(unittest.TestCase):
    def assert_rejected_state(self, state, index=1000):
        before = copy.deepcopy(state)
        self.assertEqual(apply(state, observation('1', color='red'), index),
                         {'status': 'rejected', 'reason': 'invalid_state'})
        self.assertEqual(state, before)

    def test_cleared_snapshot_after_gap_cannot_retarget(self):
        state = apply(empty(), observation(), 1)['state']
        state = apply(state, {'status': 'unsupported', 'reason': 'no_jsonld'}, 2)['state']
        state['last_snapshot'] = None
        self.assert_rejected_state(state)

    def test_cleared_snapshot_after_success_ages_out_cannot_retarget(self):
        state = apply(empty(), observation(), 1)['state']
        for index in range(2, HISTORY_LIMIT + 3):
            state = apply(state, {'status': 'unsupported', 'reason': 'no_jsonld'}, index)['state']
        self.assertTrue(_valid_state(state))
        self.assertEqual(state['last_success_revision'], 1)
        self.assertTrue(all(row['price'] is None for row in state['history']))
        broken = copy.deepcopy(state)
        broken['last_snapshot'] = None
        self.assert_rejected_state(broken)
        different = apply(state, observation('1', color='red'), 1000)
        self.assertEqual(different['outcome'], 'incomparable')
        recovered = apply(different['state'], observation('1'), 1001)
        self.assertEqual(recovered['outcome'], 'baseline_recorded')
        self.assertIsNone(recovered['event'])

    def test_gap_outcome_cannot_keep_a_comparable_price(self):
        for outcome in ('unsupported', 'ambiguous', 'incomparable'):
            with self.subTest(outcome=outcome):
                state = apply(empty(), observation(), 1)['state']
                state['history'][-1]['outcome'] = outcome
                state['history'][-1]['reason'] = 'fixture_error'
                self.assert_rejected_state(state)

    def test_stored_snapshot_must_match_last_retained_success_through_gap(self):
        state = apply(empty(), observation(), 1)['state']
        state = apply(state, {'status': 'unsupported', 'reason': 'no_jsonld'}, 2)['state']
        state['last_snapshot'] = observation('50')['snapshot']
        self.assert_rejected_state(state)

    def test_history_outcome_reason_and_availability_must_agree(self):
        cases = [
            ('baseline_recorded', 'unexpected_reason', 'InStock'),
            ('not_comparable_price', 'both_observations_must_be_in_stock', 'InStock'),
            ('price_decreased', None, 'InStock'),
            ('unchanged', None, 'OutOfStock'),
        ]
        for outcome, reason, availability in cases:
            with self.subTest(outcome=outcome, availability=availability):
                state = apply(empty(), observation(), 1)['state']
                row = state['history'][-1]
                row.update(outcome=outcome, reason=reason)
                row['price']['availability'] = availability
                self.assert_rejected_state(state)

    def test_success_revision_must_identify_the_retained_success(self):
        state = apply(empty(), observation(), 1)['state']
        state = apply(state, {'status': 'unsupported', 'reason': 'no_jsonld'}, 2)['state']
        for revision in (0, 2, True, 1.0, -1):
            with self.subTest(revision=revision):
                corrupt = copy.deepcopy(state)
                corrupt['last_success_revision'] = revision
                self.assert_rejected_state(corrupt)

    def test_last_revision_is_valid_terminal_state_and_retries_remain_safe(self):
        state = empty()
        for index in range(1, HISTORY_LIMIT + 1):
            state = apply(state, observation(), index)['state']
        delta = MAX_REVISION - 1 - state['revision']
        state['revision'] += delta
        state['last_success_revision'] += delta
        for row in state['history']:
            row['revision'] += delta
        self.assertTrue(_valid_state(state))
        data = observation('99')
        terminal = apply(state, data, HISTORY_LIMIT + 1)
        self.assertEqual(terminal['status'], 'recorded')
        self.assertEqual(terminal['state']['revision'], MAX_REVISION)
        self.assertTrue(_valid_state(terminal['state']))
        retry = apply(terminal['state'], data, HISTORY_LIMIT + 1)
        self.assertEqual(retry['status'], 'duplicate')
        self.assertIsNone(retry['event'])
        self.assertEqual(apply(terminal['state'], observation('98'), HISTORY_LIMIT + 2),
                         {'status': 'rejected', 'reason': 'revision_exhausted'})

    def test_retry_timestamp_normalization_and_exact_evicted_replay(self):
        data = observation()
        state = apply(empty(), data, 1)['state']
        retry = apply(state, data, 1, observed_at='2026-10-21T00:00:01.000000Z')
        self.assertEqual(retry['status'], 'duplicate')
        self.assertEqual(retry['state'], state)
        for index in range(2, HISTORY_LIMIT + 3):
            state = apply(state, data, index)['state']
        self.assertEqual(apply(state, data, 1), {'status': 'rejected', 'reason': 'stale_observation'})
        self.assertEqual(apply(state, data, 3)['status'], 'duplicate')
        self.assertEqual(apply(state, observation('1'), 3),
                         {'status': 'rejected', 'reason': 'observation_id_conflict'})

    def test_seeded_exact_threshold_oracle(self):
        randomizer = random.Random(406)
        with localcontext() as context:
            context.prec = 200
            for index in range(5000):
                # Generate bounded decimal strings directly; no float construction.
                def number():
                    return fixed_decimal(randomizer.randrange(10 ** 30), randomizer.randrange(13))
                before, after, minimum = number(), number(), number()
                if Decimal(before) < Decimal(after):
                    before, after = after, before
                percent = fixed_decimal(randomizer.randrange(100 * 10 ** 12 + 1), 12)
                actual, drop_text = _threshold(before, after, {
                    'minimum_drop': minimum, 'minimum_drop_percent': percent})
                drop = Decimal(before) - Decimal(after)
                expected = (drop > 0 and drop >= Decimal(minimum)
                            and drop * 100 >= Decimal(before) * Decimal(percent))
                self.assertEqual(actual, expected, (index, before, after, minimum, percent))
                self.assertEqual(Decimal(drop_text), drop)

    def test_seeded_lifecycle_model_and_json_roundtrip(self):
        randomizer = random.Random(404)
        state = empty(minimum_drop='5', minimum_drop_percent='3.333333333333')
        pinned, ready = None, False
        with localcontext() as context:
            context.prec = 120
            for index in range(1, 501):
                choice = randomizer.randrange(10)
                if choice < 2:
                    data = {'status': 'unsupported' if choice == 0 else 'ambiguous', 'reason': 'fixture_gap'}
                else:
                    data = observation(fixed_decimal(randomizer.randrange(100000), 2),
                                       availability=randomizer.choice(['InStock'] * 7 + ['OutOfStock', 'BackOrder']),
                                       currency='EUR' if choice == 2 else 'USD',
                                       color='red' if choice == 3 else 'blue')
                event_expected = False
                if data['status'] != 'ok':
                    expected, ready = data['status'], False
                else:
                    current = data['snapshot']
                    compatible = (current['price']['currency'] == 'USD' and
                                  (pinned is None or all(current[key] == pinned[key]
                                                        for key in ('page_url', 'product', 'offer'))))
                    if not compatible:
                        expected, ready = 'incomparable', False
                    elif current['availability'] != 'InStock':
                        expected, pinned, ready = 'not_comparable_price', current, False
                    elif not ready:
                        expected, pinned, ready = 'baseline_recorded', current, True
                    else:
                        before, after = Decimal(pinned['price']['amount']), Decimal(current['price']['amount'])
                        expected = 'price_decreased' if after < before else 'price_increased' if after > before else 'unchanged'
                        event_expected = (before - after > 0 and before - after >= Decimal('5')
                                          and (before - after) * 100 >= before * Decimal('3.333333333333'))
                        pinned, ready = current, True
                original = copy.deepcopy(state)
                result = apply(state, data, index)
                self.assertEqual(result['status'], 'recorded', index)
                self.assertEqual(result['outcome'], expected, index)
                self.assertEqual(bool(result['event']), event_expected, index)
                self.assertEqual(state, original, index)
                state = json.loads(json.dumps(result['state']))
                self.assertTrue(_valid_state(state), index)
                self.assertEqual(state['baseline_ready'], ready, index)


if __name__ == '__main__':
    unittest.main()
