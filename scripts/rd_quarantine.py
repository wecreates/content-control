#!/usr/bin/env python3
import argparse,json
from pathlib import Path
THRESH={"quality":.82,"character_consistency":.9,"latency_ratio_max":1.5,"cost_ratio_max":1.0}
def evaluate(candidate,baseline):
    checks={"quality":candidate.get("quality",0)>=max(THRESH["quality"],baseline.get("quality",0)),"character_consistency":candidate.get("character_consistency",0)>=THRESH["character_consistency"],"latency":candidate.get("latency_ms",1)<=baseline.get("latency_ms",1)*THRESH["latency_ratio_max"],"cost":candidate.get("cost",1)<=baseline.get("cost",0)*THRESH["cost_ratio_max"] if baseline.get("cost",0)>0 else candidate.get("cost",0)==0}
    passed=all(checks.values())
    return {"schema_version":1,"status":"PROMOTE" if passed else "QUARANTINE","checks":checks,"production_allowed":passed,"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--candidate",required=True);ap.add_argument("--baseline",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=evaluate(json.loads(Path(a.candidate).read_text()),json.loads(Path(a.baseline).read_text()));Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r,sort_keys=True))
if __name__=="__main__":main()
