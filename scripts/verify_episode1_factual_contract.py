#!/usr/bin/env python3
import hashlib,json,re
from pathlib import Path

ROOT=Path(".")
c=json.loads((ROOT/"state/episode1-factual-contract.json").read_text())
visual=(ROOT/"remotion/V9ArticulatedVisual.jsx").read_text()
audio=ROOT/c["narration_path"]

def sha256(p):
    h=hashlib.sha256()
    with open(p,"rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""):
            h.update(chunk)
    return h.hexdigest()

checks={}
checks["publication_disabled"]=c.get("publication_enabled") is False
checks["educational_example"]=c.get("educational_example") is True
checks["narration_exists"]=audio.is_file() and audio.stat().st_size>1000
checks["narration_hash_bound"]=checks["narration_exists"] and sha256(audio)==c.get("narration_sha256")

arith=[]
for item in c.get("arithmetic",[]):
    expr=item["expression"]
    if not re.fullmatch(r"[0-9+\-*/(). ]+",expr):
        raise SystemExit("unsafe arithmetic expression")
    value=eval(expr,{"__builtins__":{}},{})
    ok=abs(float(value)-float(item["expected"]))<1e-9
    arith.append({"expression":expr,"computed":value,"expected":item["expected"],"pass":ok})
checks["arithmetic_correct"]=all(x["pass"] for x in arith)

claims=c["claims"]
checks["net_spend_claim_matches"]=claims["spend_example_usd"]-claims["credit_example_usd"]==claims["net_spend_example_usd"]
checks["required_visual_math_present"]=all(tok in visual for tok in c.get("required_visual_tokens",[]))

text=c.get("narration_text","")
lower=text.lower()
checks["no_named_product_claims"]=all(x.lower() not in lower for x in c.get("prohibited_named_products",[]))
checks["no_risky_language"]=all(x.lower() not in lower for x in c.get("prohibited_risky_phrases",[]))
checks["decision_rule_present"]=claims["decision_rule"] in visual

status="PASS" if all(checks.values()) else "FAIL"
report={
    "schema_version":1,
    "status":status,
    "candidate_contract":"state/episode1-factual-contract.json",
    "narration_sha256":sha256(audio) if audio.is_file() else None,
    "checks":checks,
    "arithmetic":arith,
    "publication_enabled":False,
    "failed_checks":[k for k,v in checks.items() if not v],
}
(ROOT/"state/factual-compliance-health.json").write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
print(json.dumps(report,sort_keys=True))
raise SystemExit(0 if status=="PASS" else 2)
