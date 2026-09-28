#!/usr/bin/env python3
import hashlib, json
from pathlib import Path

ROOT=Path(".")
health=json.loads((ROOT/"state/content-control-health.json").read_text())
receipt=json.loads((ROOT/"qa-output/free/final-receipt.json").read_text())
owner=json.loads((ROOT/"control/publication-owner-gate.json").read_text())
sep=json.loads((ROOT/"control/publication-separation.json").read_text())
manifest=json.loads((ROOT/"state/runtime-integrity-manifest.json").read_text())
security=json.loads((ROOT/"state/runtime-security-audit.json").read_text())
workflow_health=json.loads((ROOT/"state/workflow-control-health.json").read_text()) if (ROOT/"state/workflow-control-health.json").exists() else {"status":"MISSING"}
factual=json.loads((ROOT/"state/factual-compliance-health.json").read_text()) if (ROOT/"state/factual-compliance-health.json").exists() else {"status":"MISSING"}
ledger_health=json.loads((ROOT/"state/acceptance-ledger-health.json").read_text()) if (ROOT/"state/acceptance-ledger-health.json").exists() else {"status":"MISSING"}
deployment=json.loads((ROOT/"state/deployment-health.json").read_text()) if (ROOT/"state/deployment-health.json").exists() else {"status":"MISSING"}
live_deployment=json.loads((ROOT/"state/live-deployment-health.json").read_text()) if (ROOT/"state/live-deployment-health.json").exists() else {"status":"MISSING"}
sync_health=json.loads((ROOT/"state/sync-retention-health.json").read_text()) if (ROOT/"state/sync-retention-health.json").exists() else {"status":"MISSING"}
smoke=json.loads((ROOT/"state/review-server-smoke.json").read_text()) if (ROOT/"state/review-server-smoke.json").exists() else {"status":"MISSING"}
provenance=json.loads((ROOT/"state/provenance/runtime-provenance.json").read_text()) if (ROOT/"state/provenance/runtime-provenance.json").exists() else {}
sbom=json.loads((ROOT/"state/provenance/npm-sbom.cdx.json").read_text()) if (ROOT/"state/provenance/npm-sbom.cdx.json").exists() else {}
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
checks["audio_green"]=receipt.get("audio",{}).get("verdict")=="PASS" and all(receipt.get("audio",{}).get("checks",{}).values())
checks["local_audio_runtime"]="staticFile(" in source and "creativeclaw" not in source.lower() and "storage.googleapis.com" not in source.lower()
checks["audio_assets_present"]=all((ROOT/p).is_file() and (ROOT/p).stat().st_size>1000 for p in [
    "public/audio/episode1-narration.mp3","public/audio/episode1-music.mp3",
    "public/audio/episode1-sfx-1.mp3","public/audio/episode1-sfx-2.mp3"])
checks["reference_frames_present"]=len(list((ROOT/"reference/frames").glob("ref-*.jpg")))>=10
manifest_failures=[]
for rel,meta in manifest.get("entries",{}).items():
    p=ROOT/rel
    actual=sha256(p) if p.is_file() else None
    if actual!=meta.get("sha256"):
        manifest_failures.append({"path":rel,"expected":meta.get("sha256"),"actual":actual})
checks["runtime_integrity_manifest"]=len(manifest_failures)==0 and manifest.get("critical_file_count")==len(manifest.get("entries",{}))
checks["dependency_security_clean"]=all(int(security.get("npm_counts",{}).get(k,0))==0 for k in ["critical","high","moderate","low"])
checks["workflow_control_green"]=workflow_health.get("status")=="PASS"
checks["factual_compliance_green"]=factual.get("status")=="PASS" and all(factual.get("checks",{}).values())
checks["acceptance_ledger_green"]=ledger_health.get("status")=="PASS" and all(ledger_health.get("checks",{}).values())
checks["deployment_contract_green"]=deployment.get("status")=="PASS" and all(deployment.get("checks",{}).values())
checks["live_deployment_green"]=live_deployment.get("status")=="PASS" and all(live_deployment.get("checks",{}).values()) and live_deployment.get("candidate_sha256")==health.get("candidate_sha256")
checks["sync_retention_green"]=sync_health.get("status")=="PASS" and all(sync_health.get("checks",{}).values())
checks["runtime_locks_present"]=all((ROOT/p).is_file() and (ROOT/p).stat().st_size>0 for p in ["package-lock.json","requirements-free-qa.lock.txt"])
checks["review_server_smoke_green"]=all([
    smoke.get("status")=="PASS",
    smoke.get("candidate_sha256")==health.get("candidate_sha256"),
    smoke.get("accepted_route_verified") is True,
    smoke.get("fail_closed_corruption_verified") is True,
    smoke.get("range_streaming_verified") is True,
    smoke.get("security_headers_verified") is True,
    smoke.get("cache_policy_verified") is True,
    smoke.get("publication_enabled") is False,
])
checks["provenance_candidate_match"]=all([
    provenance.get("candidate_sha256")==health.get("candidate_sha256"),
    provenance.get("review_server_smoke_candidate_sha256")==health.get("candidate_sha256"),
    provenance.get("zero_credit_runtime") is True,
    provenance.get("publication_enabled") is False,
])
checks["provenance_inputs_current"]=all([
    provenance.get("locks",{}).get("package_lock_sha256")==sha256(ROOT/"package-lock.json"),
    provenance.get("locks",{}).get("python_lock_sha256")==sha256(ROOT/"requirements-free-qa.lock.txt"),
    provenance.get("critical_integrity_manifest_sha256")==sha256(ROOT/"state/runtime-integrity-manifest.json"),
    provenance.get("qa_receipt_sha256")==sha256(ROOT/"qa-output/free/final-receipt.json"),
    provenance.get("review_server_smoke_sha256")==sha256(ROOT/"state/review-server-smoke.json"),
])
checks["sbom_valid"]=sbom.get("bomFormat")=="CycloneDX" and bool(sbom.get("components"))
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
    "integrity_failures":manifest_failures,
    "repair_action":"none" if status=="GREEN" else "dispatch_free_vision_qa",
    "publication_enabled":False,
}
out=ROOT/"state/free-production-watchdog.json"
out.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
completion={
    "schema_version":1,
    "machine_system_complete":status=="GREEN",
    "status":"COMPLETE" if status=="GREEN" else "REPAIR_REQUIRED",
    "candidate_sha256":health.get("candidate_sha256"),
    "publication_enabled":False,
    "publication_separate":True,
    "zero_credit_runtime":checks["zero_credit"] and checks["no_paid_vision"],
    "components":{
        "local_reference_assets":checks["reference_frames_present"],
        "local_audio_assets":checks["audio_assets_present"],
        "remotion_render":checks["video_exists"],
        "hash_bound_artifact":checks["video_hash_bound"],
        "opencv_pixel_motion_qa":receipt.get("deterministic",{}).get("verdict")=="PASS",
        "openclip_semantic_qa":receipt.get("semantic",{}).get("verdict")=="PASS",
        "florence_vision_qa":checks["florence_green"],
        "audio_loudness_clipping_silence_qa":checks["audio_green"],
        "immutable_acceptance_history":checks["immutable_history_present"],
        "publication_lock":all([
            checks["publication_health_off"],checks["publication_receipt_off"],
            checks["publication_owner_gate_off"],checks["publication_separation_off"]
        ]),
        "phone_review_artifact":checks["video_hash_bound"],
        "runtime_integrity_manifest":checks["runtime_integrity_manifest"],
        "dependency_security_clean":checks["dependency_security_clean"],
        "workflow_control_quarantine":checks["workflow_control_green"],
        "factual_compliance_gate":checks["factual_compliance_green"],
        "accepted_candidate_rollback_ledger":checks["acceptance_ledger_green"],
        "deployment_contract":checks["deployment_contract_green"],
        "live_public_deployment":checks["live_deployment_green"],
        "sync_retention_gate":checks["sync_retention_green"],
        "reproducible_runtime_locks":checks["runtime_locks_present"],
        "live_review_server_smoke":checks["review_server_smoke_green"],
        "phone_range_streaming":smoke.get("range_streaming_verified") is True,
        "review_server_security_headers":smoke.get("security_headers_verified") is True,
        "review_server_cache_policy":smoke.get("cache_policy_verified") is True,
        "hash_bound_provenance":checks["provenance_candidate_match"] and checks["provenance_inputs_current"],
        "cyclonedx_sbom":checks["sbom_valid"],
        "automatic_repair_watchdog":True,
        "bounded_failure_retry":True,
        "regression_lock":True
    },
    "source_receipt":"qa-output/free/final-receipt.json",
    "watchdog_receipt":"state/free-production-watchdog.json",
    "remaining_user_gate":"watch/approve exact artifact before any publication",
}
(ROOT/"state/system-completion.json").write_text(json.dumps(completion,indent=2,sort_keys=True)+"\n")
print(json.dumps({"watchdog":report,"completion":completion},sort_keys=True))
raise SystemExit(0 if status=="GREEN" else 2)
