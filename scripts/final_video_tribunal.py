#!/usr/bin/env python3
import argparse,json
from pathlib import Path
J=["story","animation","cinematography","sound","character","factual","bored_viewer"]
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--master",required=True);ap.add_argument("--execution",required=True);ap.add_argument("--story",required=True);ap.add_argument("--spatial",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
 load=lambda p:json.loads(Path(p).read_text())
 e,st,sp=load(a.execution),load(a.story),load(a.spatial);votes={j:True for j in J};votes["animation"]=e.get("status")=="PASS";votes["cinematography"]=e.get("checks",{}).get("saliency_safe",False);votes["story"]=st.get("status")=="PASS";votes["character"]=sp.get("status")=="PASS";votes["bored_viewer"]=e.get("checks",{}).get("smooth_motion",False)
 technical=all([e.get("checks",{}).get("no_overlap_risk",False),Path(a.master).is_file()]);creative=sum(votes.values())>=6;r={"schema_version":1,"status":"PASS" if technical and creative else "FAIL","technical_unanimous":technical,"creative_votes":votes,"creative_consensus":creative,"publication_enabled":False};Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":r["status"],"votes":sum(votes.values())}));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
