import json
import os
import subprocess
import sys
import threading
from pathlib import Path
from flask import Flask, jsonify, request

import config

app = Flask(__name__)
ROOT = Path(__file__).resolve().parent
STATE_DIR = Path(os.getenv("AGENTIC_STATE_DIR", ROOT.parent / "state"))
STATE_DIR.mkdir(parents=True, exist_ok=True)
STATE_FILE = STATE_DIR / "agentic-studio.json"
_lock = threading.Lock()

def _state():
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {"status": "idle", "publication": False}

def _write(data):
    STATE_FILE.write_text(json.dumps(data, indent=2))

@app.get("/health")
def health():
    missing = [name for name, value in {
        "GEMINI_API_KEY": config.GEMINI_API_KEY,
        "PEXELS_API_KEY": config.PEXELS_API_KEY,
    }.items() if not value]
    return jsonify({
        "ok": not missing,
        "service": "viralforge-studio",
        "publication": False,
        "youtubePrivacy": config.VIDEO_PRIVACY,
        "missingConfiguration": missing,
        "state": _state(),
    }), (200 if not missing else 503)

@app.get("/status")
def status():
    return jsonify({**_state(), "publication": False})

@app.post("/run")
def run_pipeline():
    if not config.GEMINI_API_KEY or not config.PEXELS_API_KEY:
        return jsonify({"error": "required API configuration missing", "publication": False}), 503
    if not _lock.acquire(blocking=False):
        return jsonify({"status": "already-running", "publication": False}), 202
    def worker():
        try:
            _write({"status": "running", "publication": False})
            env = {**os.environ, "PUBLICATION_ENABLED": "false"}
            result = subprocess.run(
                [sys.executable, str(ROOT / "pipeline_cloud.py")],
                cwd=str(ROOT), env=env, text=True, capture_output=True, timeout=3600
            )
            _write({
                "status": "complete" if result.returncode == 0 else "failed",
                "returnCode": result.returncode,
                "logTail": (result.stdout + "\n" + result.stderr)[-12000:],
                "publication": False,
            })
        except Exception as exc:
            _write({"status": "failed", "error": str(exc), "publication": False})
        finally:
            _lock.release()
    threading.Thread(target=worker, daemon=True).start()
    return jsonify({"status": "started", "publication": False}), 202

@app.post("/publish")
def publish():
    return jsonify({
        "error": "publication is disabled in ViralForge Studio",
        "publication": False,
    }), 403

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "10000")))
