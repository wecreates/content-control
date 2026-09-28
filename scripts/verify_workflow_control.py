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

allowed=set(reg["allowed_automatic"])
manual=set(reg["manual_only"])
workflow_dir=root/".github/workflows"
for p in sorted(workflow_dir.glob("*.yml")):
    rel=p.as_posix()
    txt=p.read_text()
    has_push=bool(re.search(r"(?m)^\s{2}push\s*:",txt))
    has_schedule=bool(re.search(r"(?m)^\s{2}schedule\s*:",txt))
    has_workflow_run=bool(re.search(r"(?m)^\s{2}workflow_run\s*:",txt))
    automatic=has_push or has_schedule or has_workflow_run
    if automatic and rel not in allowed:
        violations.append({
            "path":rel,
            "reason":"unlisted_automatic_workflow",
            "push":has_push,
            "schedule":has_schedule,
            "workflow_run":has_workflow_run
        })
    if rel in manual and automatic:
        violations.append({
            "path":rel,
            "reason":"manual_workflow_has_automatic_trigger",
            "push":has_push,
            "schedule":has_schedule,
            "workflow_run":has_workflow_run
        })
checks["deny_unlisted_automatic_workflows"]=not any(v.get("reason")=="unlisted_automatic_workflow" for v in violations)

canonical=root/reg["canonical_generation_workflow"]
checks["canonical_generation_exists"]=canonical.is_file()
checks["publication_disabled"]=reg.get("publication_enabled") is False
status="PASS" if all(checks.values()) and not violations else "FAIL"
report={"schema_version":1,"status":status,"checks":checks,"violations":violations,"publication_enabled":False}
(root/"state/workflow-control-health.json").write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
print(json.dumps(report,sort_keys=True))
raise SystemExit(0 if status=="PASS" else 2)
