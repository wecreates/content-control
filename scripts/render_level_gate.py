#!/usr/bin/env python3
import argparse,json
from pathlib import Path
ORDER=["blocking","preview","polish","final"]
def gate(current,checks):
    cur=current.get("level","blocking")
    idx=ORDER.index(cur) if cur in ORDER else 0
    passed=all(bool(v) for v in checks.get("checks",{}).values())
    nxt=ORDER[min(idx+1,len(ORDER)-1)] if passed else cur
    return {"schema_version":1,"level":nxt,"previous":cur,"promoted":nxt!=cur,"all_checks_passed":passed,"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--state",required=True);ap.add_argument("--checks",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    s=json.loads(Path(a.state).read_text()) if Path(a.state).exists() else {"level":"blocking"};c=json.loads(Path(a.checks).read_text());r=gate(s,c);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r,sort_keys=True))
if __name__=="__main__":main()
