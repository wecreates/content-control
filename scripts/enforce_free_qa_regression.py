#!/usr/bin/env python3
import json, sys
from pathlib import Path

receipt_path=Path(sys.argv[1] if len(sys.argv)>1 else "qa-output/free/final-receipt.json")
health_path=Path(sys.argv[2] if len(sys.argv)>2 else "state/content-control-health.json")
r=json.loads(receipt_path.read_text())
prev=json.loads(health_path.read_text()) if health_path.exists() else {}

assert r.get("status")=="FREE_QA_GREEN", r.get("status")
assert r.get("publication_enabled") is False
assert r.get("paid_vision_dependency") is False
assert r.get("credit_cost")==0
assert r["semantic"]["checks"].get("florence_completed") is True

m={
  "duration_seconds": float(r["duration_seconds"]),
  "edge_density_ratio": float(r["deterministic"]["edge_density_ratio"]),
  "motion_active_fraction": float(r["deterministic"]["motion_active_fraction"]),
  "openclip_global_similarity": float(r["semantic"]["global_similarity"]),
  "openclip_mean_best_similarity": float(r["semantic"]["mean_best_frame_similarity"]),
}
policy=prev.get("regression_policy",{
  "max_relative_similarity_drop":0.15,
  "max_motion_drop":0.20,
  "min_duration_seconds":29.5,
  "max_duration_seconds":30.5,
  "require_florence_pass":True,
  "require_publication_disabled":True,
})
assert policy["min_duration_seconds"] <= m["duration_seconds"] <= policy["max_duration_seconds"]

pm=prev.get("metrics",{})
if pm:
  floor=1.0-float(policy["max_relative_similarity_drop"])
  assert m["openclip_global_similarity"] >= float(pm["openclip_global_similarity"])*floor, (m,pm)
  assert m["openclip_mean_best_similarity"] >= float(pm["openclip_mean_best_similarity"])*floor, (m,pm)
  assert m["motion_active_fraction"] >= float(pm["motion_active_fraction"])-float(policy["max_motion_drop"]), (m,pm)

health={
  "schema_version":1,
  "status":"GREEN",
  "candidate_sha256":r["candidate_sha256"],
  "source_of_truth":"qa-output/free/final-receipt.json",
  "publication_enabled":False,
  "paid_vision_dependency":False,
  "credit_cost":0,
  "gates":{**r["deterministic"]["checks"],**r["semantic"]["checks"]},
  "metrics":m,
  "regression_policy":policy,
}
health_path.parent.mkdir(parents=True,exist_ok=True)
health_path.write_text(json.dumps(health,indent=2,sort_keys=True)+"\n")
history=Path("qa-output/free/history")/(r["candidate_sha256"]+".json")
history.parent.mkdir(parents=True,exist_ok=True)
history.write_text(json.dumps({
  "schema_version":1,
  "candidate_sha256":r["candidate_sha256"],
  "accepted":True,
  "receipt_path":"qa-output/free/final-receipt.json",
  "metrics":m,
  "publication_enabled":False,
  "credit_cost":0,
},indent=2,sort_keys=True)+"\n")
print(json.dumps({"status":"GREEN","candidate_sha256":r["candidate_sha256"],"metrics":m},sort_keys=True))
