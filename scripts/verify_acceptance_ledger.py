#!/usr/bin/env python3
import hashlib,json,subprocess
from pathlib import Path

ROOT=Path(".")
ledger_path=ROOT/"state/accepted-candidate-ledger.json"
health=json.loads((ROOT/"state/content-control-health.json").read_text())
media=ROOT/"public-review/episode1-v10-free.mp4"

def sha256(p):
    h=hashlib.sha256()
    with open(p,"rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""): h.update(chunk)
    return h.hexdigest()

checks={}
if not ledger_path.exists():
    report={"schema_version":1,"status":"MISSING","checks":{"ledger_exists":False},"publication_enabled":False}
    (ROOT/"state/acceptance-ledger-health.json").write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    raise SystemExit(2)

ledger=json.loads(ledger_path.read_text())
entries=ledger.get("entries",[])
current=ledger.get("current_candidate_sha256")
current_entry=next((e for e in entries if e.get("candidate_sha256")==current),None)

checks["ledger_exists"]=True
checks["publication_disabled"]=ledger.get("publication_enabled") is False
checks["entries_unique"]=len({e.get("candidate_sha256") for e in entries})==len(entries)
checks["current_matches_health"]=current==health.get("candidate_sha256")
checks["current_matches_media"]=current==sha256(media)
checks["current_entry_present"]=current_entry is not None

git_blob_actual=subprocess.check_output(["git","hash-object",str(media)],text=True).strip()
checks["current_git_blob_matches"]=bool(current_entry) and current_entry.get("git_blob_sha1")==git_blob_actual

rollback=ledger.get("rollback_candidate_sha256")
if rollback is None:
    checks["rollback_entry_recoverable"]=len(entries)<=1
else:
    previous=next((e for e in entries if e.get("candidate_sha256")==rollback),None)
    recoverable=False
    if previous:
        commit=previous.get("repository_commit")
        path=previous.get("media_path")
        if commit and path:
            p=subprocess.run(["git","cat-file","-e",f"{commit}:{path}"],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
            recoverable=p.returncode==0
    checks["rollback_entry_recoverable"]=recoverable

status="PASS" if all(checks.values()) else "FAIL"
report={
    "schema_version":1,
    "status":status,
    "current_candidate_sha256":current,
    "rollback_candidate_sha256":rollback,
    "entry_count":len(entries),
    "checks":checks,
    "publication_enabled":False,
    "failed_checks":[k for k,v in checks.items() if not v],
}
(ROOT/"state/acceptance-ledger-health.json").write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
print(json.dumps(report,sort_keys=True))
raise SystemExit(0 if status=="PASS" else 2)
