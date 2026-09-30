#!/usr/bin/env python3
import json
from pathlib import Path
def main():
 o=json.loads(Path("control/canonical-orchestrator.json").read_text());s=json.loads(Path("control/studio-pipeline-v1.json").read_text());r=json.loads(Path("state/canonical-workflow-registry.json").read_text())
 required=[o["primary"],o["generation_gate"],o["render_farm"],o["validation"],o["repair_router"],o["review_gate"]]
 checks={"one_scene_graph":s.get("canonical_scene_format")=="CCSD","primary_registered":o["primary"] in r["allowed_automatic"],"all_stages_registered":all(x in r["allowed_automatic"] for x in required),"publication_locked":o.get("publication_enabled") is False and s.get("publication_enabled") is False and r.get("publication_enabled") is False,"legacy_primary_removed":o["primary"] not in r.get("manual_only",[])}
 failed=[k for k,v in checks.items() if not v];print(json.dumps({"status":"PASS" if not failed else "FAIL","checks":checks,"failed":failed,"stages":required}));raise SystemExit(0 if not failed else 2)
if __name__=="__main__":main()
