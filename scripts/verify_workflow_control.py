#!/usr/bin/env python3
import json,re
from pathlib import Path

root=Path(".")
reg=json.loads((root/"state/canonical-workflow-registry.json").read_text())
checks={}
violations=[]

for rel in reg["manual_only"]:
    p=root/rel
    ok=p.is_file()
    txt=p.read_text() if ok else ""
    has_push=bool(re.search(r"(?m)^\s{2}push\s*:",txt))
    has_schedule=bool(re.search(r"(?m)^\s{2}schedule\s*:",txt))
    has_workflow_run=bool(re.search(r"(?m)^\s{2}workflow_run\s*:",txt))
    allowed=ok and not has_push and not has_schedule and not has_workflow_run
    checks[rel]=allowed
    if not allowed:
        violations.append({"path":rel,"exists":ok,"push":has_push,"schedule":has_schedule,"workflow_run":has_workflow_run})

for rel in reg["allowed_automatic"]:
    p=root/rel
    ok=p.is_file()
    checks[rel]=ok
    if not ok:
        violations.append({"path":rel,"exists":False})

canonical=root/reg["canonical_generation_workflow"]
checks["canonical_generation_exists"]=canonical.is_file()
checks["publication_disabled"]=reg.get("publication_enabled") is False
status="PASS" if all(checks.values()) and not violations else "FAIL"
report={"schema_version":1,"status":status,"checks":checks,"violations":violations,"publication_enabled":False}
(root/"state/workflow-control-health.json").write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
print(json.dumps(report,sort_keys=True))
raise SystemExit(0 if status=="PASS" else 2)
