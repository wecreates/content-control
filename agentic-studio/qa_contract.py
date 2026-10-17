import json
from pathlib import Path
import config

def validate_handoff(output_dir):
    root = Path(output_dir)
    required = [
        root / "research.json",
        root / "script.json",
        root / "audio_manifest.json",
        root / "handoff.json",
    ]
    missing = [str(p) for p in required if not p.exists()]
    if missing:
        return {"ok": False, "errors": ["missing artifacts"], "missing": missing}

    handoff = json.loads((root / "handoff.json").read_text(encoding="utf-8"))
    errors = []
    if config.PUBLICATION_ENABLED:
        errors.append("publication must remain disabled")
    if config.VIDEO_PRIVACY != "private":
        errors.append("video privacy must remain private")
    if handoff.get("publication") is not False:
        errors.append("handoff publication must be disabled")
    if handoff.get("youtubePrivacy") != "private":
        errors.append("handoff video privacy must be private")
    video = Path(str(handoff.get("video", "")))
    if not video.exists() or video.stat().st_size < 1024:
        errors.append("rendered video missing or empty")

    return {
        "ok": not errors,
        "errors": errors,
        "publication": False,
        "youtubePrivacy": "private",
        "video": str(video),
    }
