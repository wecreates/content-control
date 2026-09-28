#!/usr/bin/env python3
import json,re
from pathlib import Path

root=Path(".")
manifest=(root/"render.yaml").read_text()
contract=json.loads((root/"state/deployment-contract.json").read_text())
pkg=json.loads((root/"package.json").read_text())

checks={
  "manifest_exists":(root/"render.yaml").is_file(),
  "service_name":f"name: {contract['service_name']}" in manifest,
  "runtime_node":re.search(r"(?m)^\s*runtime:\s*node\s*$",manifest) is not None,
  "build_command":contract["build_command"] in manifest,
  "start_command":contract["start_command"] in manifest,
  "health_check":f"healthCheckPath: {contract['health_check_path']}" in manifest,
  "publication_lock":'PUBLICATION_ENABLED' in manifest and 'value: "false"' in manifest,
  "package_start_canonical":pkg.get("scripts",{}).get("start")=="node server-lowmem.js",
  "canonical_server_exists":(root/contract["canonical_server"]).is_file(),
  "canonical_media_exists":(root/contract["canonical_media"]).is_file(),
}
status="PASS" if all(checks.values()) else "FAIL"
report={
  "schema_version":1,
  "status":status,
  "provider":"render",
  "checks":checks,
  "failed_checks":[k for k,v in checks.items() if not v],
  "publication_enabled":False,
}
(root/"state/deployment-health.json").write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
print(json.dumps(report,sort_keys=True))
raise SystemExit(0 if status=="PASS" else 2)
