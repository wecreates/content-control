#!/usr/bin/env python3
"""End-to-end reference-clone acceptance contract.

This module does not claim a clone is complete because intermediate files exist.
It verifies the exact artifact lineage needed for acceptance:
reference AV -> blueprint -> scene plan -> render -> technical QA -> creative/parity QA
-> originality boundary -> browser-playable review URL.

Publication stays disabled. Transferable mechanics may be adapted; creator-specific
characters, dialogue, logos, traced frames, and signature creative expression are excluded.
"""
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path
from urllib.parse import urlparse

REQUIRED_STAGES = (
    "reference_av",
    "reference_analysis",
    "clone_blueprint",
    "scene_plan",
    "render",
    "technical_qa",
    "creative_qa",
    "parity_qa",
    "originality_qa",
    "review_hosting",
)

def sha256(path):
    h=hashlib.sha256()
    with open(path,"rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""): h.update(chunk)
    return h.hexdigest()

def valid_http_url(value):
    try:
        p=urlparse(value or "")
        return p.scheme=="https" and bool(p.netloc)
    except Exception:
        return False

def verify(manifest, root="."):
    root=Path(root)
    faults=[]; receipts={}
    stages=manifest.get("stages") or {}
    for name in REQUIRED_STAGES:
        row=stages.get(name)
        if not row or row.get("status")!="PASS":
            faults.append({"stage":name,"reason":"missing_or_not_pass"})
            continue
        evidence=row.get("evidence") or []
        if not evidence:
            faults.append({"stage":name,"reason":"no_evidence"})
        receipts[name]=row
    av=stages.get("reference_av",{})
    contract=av.get("contract") or {}
    for key in ("visual_access","audio_access","complete_end_to_end","timestamped_evidence"):
        if contract.get(key) is not True: faults.append({"stage":"reference_av","reason":f"{key}_required"})
    originality=stages.get("originality_qa",{})
    if originality.get("mechanics_only") is not True: faults.append({"stage":"originality_qa","reason":"mechanics_only_required"})
    if originality.get("creator_specific_copy") is not False: faults.append({"stage":"originality_qa","reason":"creator_specific_copy_forbidden"})
    render=stages.get("render",{})
    artifact=render.get("artifact")
    expected=render.get("sha256")
    if not artifact:
        faults.append({"stage":"render","reason":"artifact_required"})
    else:
        p=root/artifact
        if not p.is_file(): faults.append({"stage":"render","reason":"artifact_missing"})
        elif expected and sha256(p)!=expected: faults.append({"stage":"render","reason":"artifact_hash_mismatch"})
    for name in ("technical_qa","creative_qa","parity_qa"):
        bound=(stages.get(name,{}) or {}).get("artifact_sha256")
        if expected and bound!=expected: faults.append({"stage":name,"reason":"qa_not_bound_to_exact_render"})
    hosting=stages.get("review_hosting",{})
    if not valid_http_url(hosting.get("url")): faults.append({"stage":"review_hosting","reason":"https_review_url_required"})
    if hosting.get("browser_playback_verified") is not True: faults.append({"stage":"review_hosting","reason":"browser_playback_not_verified"})
    if manifest.get("publication_enabled") is not False: faults.append({"stage":"policy","reason":"publication_must_remain_disabled"})
    return {
      "schema_version":1,
      "status":"PASS" if not faults else "REJECT",
      "approval_allowed":not faults,
      "faults":faults,
      "accepted_artifact_sha256":expected if not faults else None,
      "review_url":hosting.get("url") if not faults else None,
      "publication_enabled":False,
    }

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--manifest",required=True);ap.add_argument("--root",default=".");ap.add_argument("--out")
    a=ap.parse_args();m=json.loads(Path(a.manifest).read_text());r=verify(m,a.root)
    if a.out: Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n")
    print(json.dumps(r,sort_keys=True))
    if not r["approval_allowed"]: raise SystemExit(2)
if __name__=="__main__":main()
