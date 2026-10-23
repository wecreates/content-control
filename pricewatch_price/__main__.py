"""Read one bounded JSON request from stdin; write one result. Never fetch URLs."""
import json
import sys
from .core import MAX_HTML_BYTES, compare_prices, extract_price
from .history import create_watch, observe_watch

MAX_REQUEST_BYTES = 6 * MAX_HTML_BYTES + 4096  # JSON Unicode escaping can expand HTML.

def unique_pairs(items):
    result = {}
    for key, value in items:
        if key in result:
            raise ValueError("duplicate_request_key")
        result[key] = value
    return result


def no_constants(value):
    raise ValueError("invalid_json_constant")


def main():
    data = sys.stdin.buffer.read(MAX_REQUEST_BYTES + 1)
    try:
        if len(data) > MAX_REQUEST_BYTES:
            raise ValueError("request_too_large")
        request = json.loads(data, object_pairs_hook=unique_pairs, parse_constant=no_constants)
        if not isinstance(request, dict):
            raise ValueError("invalid_request")
        if request.get("operation", "extract") == "extract":
            result = extract_price(request.get("html"), page_url=request.get("page_url"))
        elif request["operation"] == "compare":
            result = compare_prices(request.get("previous"), request.get("current"))
        elif request["operation"] == "create_watch":
            result = create_watch(request.get("scope_id"), request.get("watch_id"),
                                  currency=request.get("currency"),
                                  minimum_drop=request.get("minimum_drop", "0"),
                                  minimum_drop_percent=request.get("minimum_drop_percent", "0"))
        elif request["operation"] == "observe_watch":
            result = observe_watch(request.get("state"), request.get("observation"),
                                   scope_id=request.get("scope_id"), watch_id=request.get("watch_id"),
                                   observation_id=request.get("observation_id"), observed_at=request.get("observed_at"))
        else:
            raise ValueError("invalid_operation")
    except (ValueError, UnicodeError, RecursionError):
        result = {"status": "unsupported", "reason": "invalid_request"}
    print(json.dumps(result, ensure_ascii=True, sort_keys=True))
    return 0 if result["status"] not in ("unsupported", "ambiguous", "incomparable", "rejected") else 2

if __name__ == "__main__":
    raise SystemExit(main())
