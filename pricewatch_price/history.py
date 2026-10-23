"""Pure, bounded watch lifecycle. Candidate events are not delivered notifications.

The caller owns storage, ordering, scope authorization, atomic updates and an
idempotent delivery outbox. This module never fetches, writes, or sends anything.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime
import hashlib
import json
import re

from .core import AVAILABILITIES, CURRENCIES, Rejected, _valid_snapshot, amount, compare_prices

WATCH_SCHEMA = "pricewatch.watch.v1"
HISTORY_LIMIT = 128
MAX_REVISION = 2**53 - 1
TOKEN = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}\Z", re.ASCII)
TIMESTAMP = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,6})?Z\Z", re.ASCII)
SNAPSHOT_KEYS = {"schema", "page_url", "product", "offer", "price", "availability", "evidence"}
EVIDENCE_KEYS = {"method", "product_script_index", "offer_script_index", "product_path", "offer_path", "price_path", "script_line", "raw_price", "raw_price_type", "raw_currency", "raw_availability"}
OUTCOMES = {"baseline_recorded", "unsupported", "ambiguous", "incomparable", "not_comparable_price", "unchanged", "price_decreased", "price_increased"}


def _token(value):
    return type(value) is str and TOKEN.fullmatch(value) is not None


def _timestamp(value):
    if type(value) is not str or not TIMESTAMP.fullmatch(value):
        raise ValueError("invalid_observed_at")
    return datetime.fromisoformat(value[:-1] + "+00:00").isoformat(timespec="microseconds").replace("+00:00", "Z")


def _digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("ascii")).hexdigest()


def _strict_snapshot(value):
    # Do not retain arbitrary extra fields (such as HTML or caller secrets).
    return (_valid_snapshot(value) and set(value) == SNAPSHOT_KEYS
            and set(value["evidence"]) == EVIDENCE_KEYS)


def _units(value, scale):
    parsed = amount(value)
    return int(parsed["coefficient"]) * 10 ** (scale - parsed["scale"])


def _format_units(value, scale):
    digits = str(value).zfill(scale + 1)
    text = digits if not scale else digits[:-scale] + "." + digits[-scale:]
    return amount(text)["amount"]


def _policy(currency, minimum_drop, minimum_drop_percent):
    if type(currency) is not str or currency not in CURRENCIES:
        raise ValueError("invalid_currency")
    drop = amount(minimum_drop)["amount"]
    percent = amount(minimum_drop_percent)["amount"]
    parsed = amount(percent)
    if int(parsed["coefficient"]) > 100 * 10 ** parsed["scale"]:
        raise ValueError("invalid_percent_threshold")
    return {"currency": currency, "minimum_drop": drop, "minimum_drop_percent": percent}


def create_watch(scope_id, watch_id, *, currency, minimum_drop="0", minimum_drop_percent="0"):
    """Make empty JSON-serializable state. IDs must be opaque non-personal tokens.

    Both inclusive thresholds must pass. Amounts are exact major currency units;
    currency is pinned, and the first successful observation pins item identity.
    """
    if not _token(scope_id) or not _token(watch_id):
        return {"status": "rejected", "reason": "invalid_scope_or_watch_id"}
    try:
        policy = _policy(currency, minimum_drop, minimum_drop_percent)
    except (Rejected, ValueError, TypeError):
        return {"status": "rejected", "reason": "invalid_policy"}
    return {"status": "ok", "state": {
        "schema": WATCH_SCHEMA, "scope_id": scope_id, "watch_id": watch_id,
        "policy": policy, "revision": 0, "last_snapshot": None,
        "last_success_revision": 0, "baseline_ready": False, "history": [],
    }}


def _valid_state(state):
    if type(state) is not dict or set(state) != {"schema", "scope_id", "watch_id", "policy", "revision", "last_snapshot", "last_success_revision", "baseline_ready", "history"}:
        return False
    try:
        if state["schema"] != WATCH_SCHEMA or not _token(state["scope_id"]) or not _token(state["watch_id"]):
            return False
        policy = state["policy"]
        if type(policy) is not dict or set(policy) != {"currency", "minimum_drop", "minimum_drop_percent"}:
            return False
        if policy != _policy(**policy):
            return False
        revision, history = state["revision"], state["history"]
        if type(revision) is not int or not 0 <= revision <= MAX_REVISION or type(history) is not list or len(history) != min(revision, HISTORY_LIMIT):
            return False
        if type(state["baseline_ready"]) is not bool:
            return False
        snapshot = state["last_snapshot"]
        success_revision = state["last_success_revision"]
        if type(success_revision) is not int or not 0 <= success_revision <= revision or (success_revision == 0) != (snapshot is None):
            return False
        if snapshot is not None and (not _strict_snapshot(snapshot) or snapshot["price"]["currency"] != policy["currency"]):
            return False
        if state["baseline_ready"] and (snapshot is None or snapshot["availability"] != "InStock"):
            return False
        seen, previous_time, latest_success = set(), "", None
        for index, record in enumerate(history, start=revision - len(history) + 1):
            if type(record) is not dict or set(record) != {"revision", "observation_id", "observed_at", "fingerprint", "outcome", "reason", "price", "event_id"}:
                return False
            if type(record["revision"]) is not int or record["revision"] != index or not _token(record["observation_id"]) or record["observation_id"] in seen:
                return False
            seen.add(record["observation_id"])
            timestamp = _timestamp(record["observed_at"])
            if timestamp != record["observed_at"] or timestamp <= previous_time:
                return False
            previous_time = timestamp
            if type(record["fingerprint"]) is not str or not re.fullmatch("[0-9a-f]{64}", record["fingerprint"]):
                return False
            outcome, reason = record["outcome"], record["reason"]
            if outcome not in OUTCOMES or (reason is not None and not _token(reason)):
                return False
            if record["event_id"] is not None and (type(record["event_id"]) is not str or not re.fullmatch("pw_[0-9a-f]{64}", record["event_id"]) or record["outcome"] != "price_decreased"):
                return False
            price = record["price"]
            if (price is None) != (outcome in {"unsupported", "ambiguous", "incomparable"}):
                return False
            if price is None and reason is None:
                return False
            if outcome in {"baseline_recorded", "unchanged", "price_increased"} and reason is not None:
                return False
            if outcome == "price_decreased" and reason != (None if record["event_id"] else "below_threshold"):
                return False
            if outcome == "not_comparable_price" and reason != "both_observations_must_be_in_stock":
                return False
            if price is not None:
                if type(price) is not dict or set(price) != {"amount", "currency", "availability"} or price["currency"] != policy["currency"]:
                    return False
                if amount(price["amount"])["amount"] != price["amount"] or price["availability"] not in AVAILABILITIES:
                    return False
                if (price["availability"] != "InStock") != (outcome == "not_comparable_price"):
                    return False
                latest_success = record
        if latest_success is not None:
            if snapshot is None or latest_success["revision"] != success_revision or latest_success["price"] != _price_summary(snapshot):
                return False
        elif success_revision > revision - len(history):
            return False
        if not history:
            return snapshot is None and not state["baseline_ready"]
        latest = history[-1]
        if latest["price"] is not None:
            if snapshot is None or latest["price"] != _price_summary(snapshot):
                return False
            if state["baseline_ready"] != (snapshot["availability"] == "InStock"):
                return False
        elif state["baseline_ready"]:
            return False
        return True
    except (KeyError, TypeError, ValueError, Rejected):
        return False


def _price_summary(snapshot):
    return {"amount": snapshot["price"]["amount"], "currency": snapshot["price"]["currency"], "availability": snapshot["availability"]}


def _threshold(previous, current, policy):
    a, b, minimum = amount(previous), amount(current), amount(policy["minimum_drop"])
    scale = max(a["scale"], b["scale"], minimum["scale"])
    before, after = _units(previous, scale), _units(current, scale)
    drop = before - after
    percent = amount(policy["minimum_drop_percent"])
    # Cross multiplication is exact, including tiny changes and very large prices.
    eligible = (drop > 0 and drop >= _units(policy["minimum_drop"], scale)
                and drop * 100 * 10 ** percent["scale"] >= before * int(percent["coefficient"]))
    return eligible, _format_units(drop, scale)


def observe_watch(state, observation, *, scope_id, watch_id, observation_id, observed_at):
    """Apply one extraction result, without mutating inputs.

    Source/product/variant/offer/currency changes do not retarget the watch. A
    rejected extraction or non-InStock observation breaks continuity. Recovery
    records a fresh baseline without an event. Retained replayed IDs and stale
    timestamps never create another candidate. Caller IDs must be lifetime unique.
    Strictly increasing UTC observation times
    are required; concurrent callers must use compare-and-swap on revision.
    """
    if not _valid_state(state):
        return {"status": "rejected", "reason": "invalid_state"}
    if scope_id != state["scope_id"] or watch_id != state["watch_id"]:
        return {"status": "rejected", "reason": "scope_or_watch_mismatch"}
    if not _token(observation_id):
        return {"status": "rejected", "reason": "invalid_observation_id"}
    try:
        timestamp = _timestamp(observed_at)
    except (ValueError, TypeError):
        return {"status": "rejected", "reason": "invalid_observed_at"}
    if type(observation) is not dict:
        return {"status": "rejected", "reason": "invalid_observation"}
    if observation.get("status") == "ok" and set(observation) == {"status", "snapshot"}:
        normalized = observation if _strict_snapshot(observation["snapshot"]) else {"status": "unsupported", "reason": "invalid_snapshot"}
    elif observation.get("status") in ("unsupported", "ambiguous") and set(observation) == {"status", "reason"} and _token(observation.get("reason")):
        normalized = observation
    else:
        return {"status": "rejected", "reason": "invalid_observation"}
    fingerprint = _digest({"observed_at": timestamp, "observation": normalized})
    for record in state["history"]:
        if record["observation_id"] == observation_id:
            if record["fingerprint"] != fingerprint:
                return {"status": "rejected", "reason": "observation_id_conflict"}
            return {"status": "duplicate", "state": deepcopy(state), "event": None}
    if state["history"] and timestamp <= state["history"][-1]["observed_at"]:
        return {"status": "rejected", "reason": "stale_observation"}
    if state["revision"] == MAX_REVISION:
        return {"status": "rejected", "reason": "revision_exhausted"}

    updated = deepcopy(state)
    updated["revision"] += 1
    updated["baseline_ready"] = False
    outcome, reason, summary, event = normalized["status"], normalized.get("reason"), None, None
    if normalized["status"] == "ok":
        snapshot = normalized["snapshot"]
        previous = state["last_snapshot"]
        comparison = compare_prices(previous, snapshot) if previous is not None else None
        if snapshot["price"]["currency"] != state["policy"]["currency"]:
            outcome, reason = "incomparable", "currency_changed"
        elif comparison is not None and comparison["status"] == "incomparable":
            outcome, reason = comparison["status"], comparison["reason"]
        else:
            updated["last_snapshot"] = deepcopy(snapshot)
            updated["last_success_revision"] = updated["revision"]
            summary = _price_summary(snapshot)
            updated["baseline_ready"] = snapshot["availability"] == "InStock"
            if not updated["baseline_ready"]:
                outcome, reason = "not_comparable_price", "both_observations_must_be_in_stock"
            elif not state["baseline_ready"]:
                outcome, reason = "baseline_recorded", None
            else:
                outcome, reason = comparison["status"], comparison.get("reason")
                if outcome == "price_decreased":
                    eligible, drop = _threshold(comparison["previous_amount"], comparison["current_amount"], state["policy"])
                    if eligible:
                        event = {"type": "price_decreased", "scope_id": scope_id, "watch_id": watch_id,
                                 "observation_id": observation_id, "observed_at": timestamp,
                                 "previous_amount": comparison["previous_amount"], "current_amount": comparison["current_amount"],
                                 "drop_amount": drop, "currency": comparison["currency"],
                                 "event_id": "pw_" + _digest([scope_id, watch_id, observation_id, fingerprint])}
                    else:
                        reason = "below_threshold"
    record = {"revision": updated["revision"], "observation_id": observation_id, "observed_at": timestamp,
              "fingerprint": fingerprint, "outcome": outcome, "reason": reason, "price": summary,
              "event_id": event["event_id"] if event else None}
    updated["history"] = (updated["history"] + [record])[-HISTORY_LIMIT:]
    return {"status": "recorded", "state": updated, "outcome": outcome, "event": event}
