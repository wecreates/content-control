#!/usr/bin/env python3
import hashlib, json
from pathlib import Path

ROOT=Path(".")
health=json.loads((ROOT/"state/content-control-health.json").read_text())
receipt=json.loads((ROOT/"qa-output/free/final-receipt.json").read_text())
owner=json.loads((ROOT/"control/publication-owner-gate.json").read_text())
sep=json.loads((ROOT/"control/publication-separation.json").read_text())
video=ROOT/"public-review/episode1-v10-free.mp4"
source=(ROOT/"remotion/Episode1V10FinalProof.jsx").read_text()

def sha256(p):
    h=hashlib.sha256()
    with open(p,"rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""):
            h.update(chunk)
    return h.hexdigest()

checks={}
checks["health_green"]=health.get("status")=="GREEN"
checks["receipt_green"]=receipt.get("status")=="FREE_QA_GREEN"
checks["health_receipt_hash_match"]=health.get("candidate_sha256")==receipt.get("candidate_sha256")
checks["video_exists"]=video.is_file() and video.stat().st_size>1_000_000
actual_hash=sha256(video) if checks["video_exists"] else None
checks["video_hash_bound"]=actual_hash==health.get("candidate_sha256")
checks["publication_health_off"]=health.get("publication_enabled") is False
checks["publication_receipt_off"]=receipt.get("publication_enabled") is False
checks["publication_owner_gate_off"]=owner.get("publication_enabled") is False
checks["publication_separation_off"]=sep.get("publication_enabled") is False
checks["zero_credit"]=receipt.get("credit_cost")==0 and health.get("credit_cost")==0
checks["no_paid_vision"]=receipt.get("paid_vision_dependency") is False and health.get("paid_vision_dependency") is False
checks["florence_green"]=receipt.get("semantic",{}).get("checks",{}).get("florence_completed") is True
checks["local_audio_runtime"]="staticFile(" in source and "creativeclaw" not in source.lower() and "storage.googleapis.com" not in source.lower()
checks["audio_assets_present"]=all((ROOT/p).is_file() and (ROOT/p).stat().st_size>1000 for p in [
    "public/audio/episode1-narration.mp3","public/audio/episode1-music.mp3",
    "public/audio/episode1-sfx-1.mp3","public/audio/episode1-sfx-2.mp3"])
checks["reference_frames_present"]=len(list((ROOT/"reference/frames").glob("ref-*.jpg")))>=10
history=ROOT/"qa-output/free/history"/(str(health.get("candidate_sha256"))+".json")
checks["immutable_history_present"]=history.is_file()

status="GREEN" if all(checks.values()) else "REPAIR_REQUIRED"
report={
    "schema_version":1,
    "status":status,
    "candidate_sha256":health.get("candidate_sha256"),
    "actual_video_sha256":actual_hash,
    "checks":checks,
    "failed_checks":[k for k,v in checks.items() if not v],
    "repair_action":"none" if status=="GREEN" else "dispatch_free_vision_qa",
    "publication_enabled":False,
}
out=ROOT/"state/free-production-watchdog.json"
out.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
print(json.dumps(report,sort_keys=True))
raise SystemExit(0 if status=="GREEN" else 2)
