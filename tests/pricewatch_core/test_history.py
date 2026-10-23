"""Customer watch sequences through the actual parser and lifecycle, fixture only."""
import copy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import socket
import subprocess
import sys
import unittest
from unittest.mock import patch

from pricewatch_price import create_watch, extract_price, observe_watch
from pricewatch_price.history import HISTORY_LIMIT

PAGE = "https://shop.example.test/products/mug"
FIXTURE = (Path(__file__).parent / "fixtures" / "baseline.html").read_text(encoding="utf-8")


def observation(price="29.90", availability="InStock", currency="USD", color="blue", page=PAGE, seller=None):
    html = FIXTURE.replace('"price": "29.90"', '"price": ' + json.dumps(price))
    html = html.replace('schema.org/InStock', 'schema.org/' + availability)
    html = html.replace('"USD"', json.dumps(currency)).replace('"blue"', json.dumps(color))
    if seller is not None:
        html = html.replace('"@type": "Offer",', '"@type": "Offer", "seller": ' + json.dumps(seller) + ',')
    result = extract_price(html, page_url=page)
    assert result["status"] == "ok", result
    return result


def timestamp(index):
    return (datetime(2026, 10, 21, tzinfo=timezone.utc) + timedelta(seconds=index)).isoformat().replace("+00:00", "Z")


def apply(state, data, index, **overrides):
    args = {"scope_id": "fixture-client", "watch_id": "fixture-mug", "observation_id": f"check-{index}", "observed_at": timestamp(index)}
    args.update(overrides)
    return observe_watch(state, data, **args)


def empty(**policy):
    return create_watch("fixture-client", "fixture-mug", currency="USD", **policy)["state"]


class HistoryWorkflowTests(unittest.TestCase):
    def test_baseline_promotion_drop_and_retry(self):
        first = apply(empty(), observation(), 1)
        self.assertEqual(first["outcome"], "baseline_recorded")
        self.assertIsNone(first["event"])
        promo = extract_price(FIXTURE.replace("Normal day", "FLASH SALE!"), page_url=PAGE)
        second = apply(first["state"], promo, 2)
        self.assertEqual(second["outcome"], "unchanged")
        third = apply(second["state"], observation("24.90"), 3)
        self.assertEqual(third["event"]["drop_amount"], "5")
        self.assertEqual(third["event"]["current_amount"], "24.9")
        retry = apply(third["state"], observation("24.90"), 3)
        self.assertEqual(retry["status"], "duplicate")
        self.assertIsNone(retry["event"])
        self.assertEqual(retry["state"], third["state"])
        next_check = apply(third["state"], observation("24.90"), 4)
        self.assertEqual(next_check["outcome"], "unchanged")
        self.assertIsNone(next_check["event"])

    def test_unsupported_gap_preserves_last_success_and_rebaselines(self):
        first = apply(empty(), observation(), 1)
        failed = apply(first["state"], extract_price("Challenge page", page_url=PAGE), 2)
        self.assertEqual(failed["outcome"], "unsupported")
        self.assertEqual(failed["state"]["last_snapshot"], first["state"]["last_snapshot"])
        self.assertFalse(failed["state"]["baseline_ready"])
        recovered = apply(failed["state"], observation("24.90"), 3)
        self.assertEqual(recovered["outcome"], "baseline_recorded")
        self.assertIsNone(recovered["event"])
        next_drop = apply(recovered["state"], observation("20"), 4)
        self.assertEqual(next_drop["event"]["previous_amount"], "24.9")

    def test_ambiguous_gap_also_rebaselines(self):
        first = apply(empty(), observation(), 1)
        failed = apply(first["state"], {"status": "ambiguous", "reason": "multiple_products"}, 2)
        self.assertEqual(failed["outcome"], "ambiguous")
        self.assertIsNone(apply(failed["state"], observation("1"), 3)["event"])

    def test_invalid_snapshot_is_a_recorded_gap(self):
        first = apply(empty(), observation(), 1)
        corrupt = observation("1")
        corrupt["snapshot"]["price"]["coefficient"] = "999"
        failed = apply(first["state"], corrupt, 2)
        self.assertEqual(failed["outcome"], "unsupported")
        self.assertEqual(failed["state"]["history"][-1]["reason"], "invalid_snapshot")
        self.assertIsNone(apply(failed["state"], observation("1"), 3)["event"])

    def test_every_non_instock_observation_breaks_continuity(self):
        for stock in ("OutOfStock", "SoldOut", "PreOrder", "PreSale", "BackOrder", "Discontinued", "LimitedAvailability", "OnlineOnly", "InStoreOnly"):
            with self.subTest(stock=stock):
                first = apply(empty(), observation(), 1)
                unavailable = apply(first["state"], observation("10", availability=stock), 2)
                self.assertEqual(unavailable["outcome"], "not_comparable_price")
                self.assertIsNone(unavailable["event"])
                self.assertFalse(unavailable["state"]["baseline_ready"])
                recovered = apply(unavailable["state"], observation("5"), 3)
                self.assertEqual(recovered["outcome"], "baseline_recorded")
                self.assertIsNone(recovered["event"])

    def test_first_out_of_stock_does_not_create_price_baseline(self):
        first = apply(empty(), observation("100", availability="OutOfStock"), 1)
        self.assertEqual(first["outcome"], "not_comparable_price")
        second = apply(first["state"], observation("10"), 2)
        self.assertEqual(second["outcome"], "baseline_recorded")
        self.assertIsNone(second["event"])

    def test_variant_source_seller_and_currency_cannot_retarget_watch(self):
        changed = [observation("1", color="red"), observation("1", page=PAGE + "?variant=red"),
                   observation("1", currency="EUR"), observation("1", seller={"@type": "Organization", "url": "https://other.example.test/"})]
        for data in changed:
            with self.subTest(data=data):
                first = apply(empty(), observation(), 1)
                mismatch = apply(first["state"], data, 2)
                self.assertEqual(mismatch["outcome"], "incomparable")
                self.assertIsNone(mismatch["event"])
                self.assertIsNone(mismatch["state"]["history"][-1]["price"])
                self.assertEqual(mismatch["state"]["last_snapshot"], first["state"]["last_snapshot"])
                still_mismatch = apply(mismatch["state"], data, 3)
                self.assertEqual(still_mismatch["outcome"], "incomparable")
                recovered = apply(still_mismatch["state"], observation("15"), 4)
                self.assertEqual(recovered["outcome"], "baseline_recorded")
                self.assertIsNone(recovered["event"])

    def test_policy_currency_applies_before_first_snapshot(self):
        wrong = apply(empty(), observation("1", currency="EUR"), 1)
        self.assertEqual(wrong["outcome"], "incomparable")
        self.assertIsNone(wrong["state"]["last_snapshot"])
        self.assertEqual(apply(wrong["state"], observation(), 2)["outcome"], "baseline_recorded")

    def test_exact_inclusive_absolute_and_percent_thresholds(self):
        first = apply(empty(minimum_drop="5.00", minimum_drop_percent="5.0"), observation("100"), 1)
        exact = apply(first["state"], observation("95"), 2)
        self.assertIsNotNone(exact["event"])
        self.assertEqual(exact["event"]["drop_amount"], "5")
        below = apply(first["state"], observation("95.000000000001"), 2)
        self.assertIsNone(below["event"])
        self.assertEqual(below["state"]["history"][-1]["reason"], "below_threshold")

    def test_both_thresholds_must_pass(self):
        for policy in ({"minimum_drop": "6", "minimum_drop_percent": "4"}, {"minimum_drop": "4", "minimum_drop_percent": "6"}):
            first = apply(empty(**policy), observation("100"), 1)
            self.assertIsNone(apply(first["state"], observation("95"), 2)["event"])

    def test_percent_threshold_uses_exact_cross_multiplication(self):
        first = apply(empty(minimum_drop_percent="33.333333333333"), observation("3"), 1)
        self.assertIsNotNone(apply(first["state"], observation("2"), 2)["event"])
        first = apply(empty(minimum_drop_percent="33.333333333334"), observation("3"), 1)
        self.assertIsNone(apply(first["state"], observation("2"), 2)["event"])

    def test_large_prices_and_smallest_supported_drop_remain_exact(self):
        before = "999999999999999999999999999999.999999999999"
        after = "999999999999999999999999999999.999999999998"
        first = apply(empty(minimum_drop="0.000000000001"), observation(before), 1)
        result = apply(first["state"], observation(after), 2)
        self.assertEqual(result["event"]["drop_amount"], "0.000000000001")
        self.assertEqual(result["event"]["previous_amount"], before)
        self.assertEqual(result["event"]["current_amount"], after)

    def test_zero_price_100_percent_threshold_and_increases(self):
        first = apply(empty(minimum_drop_percent="100"), observation("10"), 1)
        free = apply(first["state"], observation("0"), 2)
        self.assertEqual(free["event"]["current_amount"], "0")
        unchanged = apply(free["state"], observation("0.00"), 3)
        self.assertEqual(unchanged["outcome"], "unchanged")
        rise = apply(unchanged["state"], observation("1"), 4)
        self.assertEqual(rise["outcome"], "price_increased")
        self.assertIsNone(rise["event"])

    def test_thresholds_compare_consecutive_valid_prices_not_cumulative_drops(self):
        first = apply(empty(minimum_drop="5"), observation("100"), 1)
        second = apply(first["state"], observation("97"), 2)
        third = apply(second["state"], observation("94"), 3)
        self.assertIsNone(second["event"])
        self.assertIsNone(third["event"])
        self.assertEqual(third["state"]["last_snapshot"]["price"]["amount"], "94")

    def test_conflicting_reused_id_and_stale_observations_do_not_mutate(self):
        first = apply(empty(), observation(), 3)
        state = copy.deepcopy(first["state"])
        for data, index, reason in [(observation("1"), 3, "observation_id_conflict"), (observation("1"), 2, "stale_observation")]:
            result = apply(state, data, index)
            self.assertEqual(result, {"status": "rejected", "reason": reason})
            self.assertEqual(state, first["state"])
        same_time = apply(state, observation(), 3, observation_id="different-id")
        self.assertEqual(same_time["reason"], "stale_observation")

    def test_older_retained_replay_does_not_roll_state_back(self):
        first = apply(empty(), observation(), 1)
        second = apply(first["state"], observation("20"), 2)
        replay = apply(second["state"], observation(), 1)
        self.assertEqual(replay["status"], "duplicate")
        self.assertEqual(replay["state"], second["state"])

    def test_history_is_bounded_and_evicted_replays_still_cannot_alert(self):
        state = empty()
        for index in range(1, HISTORY_LIMIT + 3):
            result = apply(state, observation(), index)
            self.assertEqual(result["status"], "recorded")
            state = result["state"]
        self.assertEqual(len(state["history"]), HISTORY_LIMIT)
        self.assertEqual(state["history"][0]["observation_id"], "check-3")
        self.assertEqual(apply(state, observation(), 1), {"status": "rejected", "reason": "stale_observation"})

    def test_scope_and_watch_mismatch_return_no_private_state(self):
        state = apply(empty(), observation(), 1)["state"]
        for overrides in ({"scope_id": "another-client"}, {"watch_id": "another-watch"}):
            result = apply(state, observation("1"), 2, **overrides)
            self.assertEqual(result, {"status": "rejected", "reason": "scope_or_watch_mismatch"})

    def test_events_do_not_include_source_urls_seller_or_raw_markup(self):
        secret_url = PAGE + "?private_token=fixture-secret"
        seller = {"@type": "Organization", "url": "https://seller.example.test/", "name": "Fixture Seller"}
        first = apply(empty(), observation(page=secret_url, seller=seller), 1)
        result = apply(first["state"], observation("1", page=secret_url, seller=seller), 2)
        serialized = json.dumps(result["event"])
        for forbidden in ("fixture-secret", "seller.example.test", "Fixture Seller", "script", "product", "evidence"):
            self.assertNotIn(forbidden, serialized)
        # The full private state intentionally retains exact source identity.
        self.assertEqual(result["state"]["last_snapshot"]["page_url"], secret_url)

    def test_extra_snapshot_payload_is_not_retained(self):
        data = observation()
        data["snapshot"]["private_note"] = "do not retain this"
        result = apply(empty(), data, 1)
        self.assertEqual(result["outcome"], "unsupported")
        self.assertNotIn("do not retain this", json.dumps(result))

    def test_inputs_and_returned_snapshots_do_not_alias(self):
        state, data = empty(), observation()
        before = copy.deepcopy((state, data))
        result = apply(state, data, 1)
        self.assertEqual((state, data), before)
        result["state"]["last_snapshot"]["product"]["variant"]["color"] = "mutated"
        self.assertEqual((state, data), before)

    def test_json_roundtrip_and_deterministic_candidate_id(self):
        first = apply(empty(), observation(), 1)
        restored = json.loads(json.dumps(first["state"]))
        result = apply(restored, observation("1"), 2)
        replay_from_same_revision = apply(first["state"], observation("1"), 2)
        self.assertEqual(result, replay_from_same_revision)
        self.assertEqual(len(result["event"]["event_id"]), 67)

    def test_invalid_policies_timestamps_and_states(self):
        for fields in ({"minimum_drop": -1}, {"minimum_drop": "-1"}, {"minimum_drop_percent": "100.000000000001"}, {"minimum_drop_percent": "NaN"}, {"minimum_drop": 1.0}):
            self.assertEqual(create_watch("client", "watch", currency="USD", **fields)["status"], "rejected")
        for time in ("2026-10-21", "2026-02-30T00:00:00Z", "2026-10-21T00:00:00+00:00", "2026-10-21T00:00:00.1234567Z", None):
            self.assertEqual(apply(empty(), observation(), 1, observed_at=time)["reason"], "invalid_observed_at")
        state = apply(empty(), observation(), 1)["state"]
        for field, value in (("revision", True), ("baseline_ready", False), ("history", []), ("policy", {})):
            corrupt = copy.deepcopy(state)
            corrupt[field] = value
            self.assertEqual(apply(corrupt, observation("1"), 2)["reason"], "invalid_state")

    def test_lifecycle_uses_no_network(self):
        with patch.object(socket, "socket", side_effect=AssertionError("network forbidden")):
            first = apply(empty(), observation(), 1)
            self.assertIsNotNone(apply(first["state"], observation("1"), 2)["event"])

    def test_cli_create_record_and_duplicate_roundtrip(self):
        def cli(request):
            process = subprocess.run([sys.executable, "-m", "pricewatch_price"], input=json.dumps(request), text=True, capture_output=True, check=True)
            return json.loads(process.stdout)
        state = cli({"operation": "create_watch", "scope_id": "fixture-client", "watch_id": "fixture-mug", "currency": "USD"})["state"]
        request = {"operation": "observe_watch", "state": state, "observation": observation(), "scope_id": "fixture-client", "watch_id": "fixture-mug", "observation_id": "check-1", "observed_at": timestamp(1)}
        first = cli(request)
        self.assertEqual(first["outcome"], "baseline_recorded")
        request["state"] = first["state"]
        self.assertEqual(cli(request)["status"], "duplicate")


if __name__ == "__main__":
    unittest.main()
