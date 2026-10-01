REQUIRED=("story_locked","fact_locked","audio_locked","rendered","technical_qa","creative_qa","stream_verified")

def evaluate(state):
    missing=[key for key in REQUIRED if not state.get(key)]
    if state.get("stream_verified") and not state.get("stream_url"):
        missing.append("stream_url")
    missing=list(dict.fromkeys(missing))
    return {
        "status":"READY" if not missing else "BLOCKED",
        "missing":missing,
        "stream_url":state.get("stream_url"),
    }
