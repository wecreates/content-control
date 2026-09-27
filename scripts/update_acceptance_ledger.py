#!/usr/bin/env python3
import hashlib,json,subprocess,sys
from pathlib import Path

receipt_path=Path(sys.argv[1] if len(sys.argv)>1 else "qa-output/free/final-receipt.json")
media_path=Path(sys.argv[2] if len(sys.argv)>2 else "public-review/episode1-v10-free.mp4")
ledger_path=Path(sys.argv[3] if len(sys.argv)>3 else "state/accepted-candidate-ledger.json")
health_path=Path("state/content-control-health.json")

def sha256(p):
    h=hashlib.sha256()
    with open(p,"rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""):
            h.update(chunk)
    return h.hexdigest()

receipt=json.loads(receipt_path.read_text())
assert receipt.get("status")=="FREE_QA_GREEN"
assert receipt.get("publication_enabled") is False
assert receipt.get("candidate_sha256")==sha256(media_path)

commit=subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip()
blob=subprocess.check_output(["git","hash-object",str(media_path)],text=True).strip()

entry={
    "candidate_sha256":receipt["candidate_sha256"],
    "git_blob_sha1":blob,
    "repository_commit":commit,
    "media_path":str(media_path),
    "qa_receipt_sha256":sha256(receipt_path),
    "health_sha256":sha256(health_path),
    "accepted":True,
    "publication_enabled":False,
}

if ledger_path.exists():
    ledger=json.loads(ledger_path.read_text())
else:
    ledger={"schema_version":1,"entries":[],"publication_enabled":False}

entries=ledger.get("entries",[])
entries=[e for e in entries if e.get("candidate_sha256")!=entry["candidate_sha256"]]
entries.append(entry)
entries=entries[-20:]
previous=entries[-2]["candidate_sha256"] if len(entries)>1 else None
out={
    "schema_version":1,
    "publication_enabled":False,
    "current_candidate_sha256":entry["candidate_sha256"],
    "rollback_candidate_sha256":previous,
    "max_entries":20,
    "entries":entries,
}
ledger_path.parent.mkdir(parents=True,exist_ok=True)
ledger_path.write_text(json.dumps(out,indent=2,sort_keys=True)+"\n")
print(json.dumps({
    "current_candidate_sha256":entry["candidate_sha256"],
    "rollback_candidate_sha256":previous,
    "git_blob_sha1":blob,
    "repository_commit":commit,
},sort_keys=True))
