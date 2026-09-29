#!/usr/bin/env python3
import argparse,hashlib,json
from pathlib import Path
def sha(p):
 h=hashlib.sha256();h.update(Path(p).read_bytes());return h.hexdigest()
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--ledger",required=True);ap.add_argument("--scene-id",required=True);ap.add_argument("--artifact",required=True);ap.add_argument("--score",type=float,required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
 try:d=json.loads(Path(a.ledger).read_text())
 except:d={"schema_version":1,"scenes":{},"publication_enabled":False}
 old=d["scenes"].get(a.scene_id);candidate={"score":a.score,"sha256":sha(a.artifact),"artifact":a.artifact}
 if old is None or a.score>float(old.get("score",0)):d["scenes"][a.scene_id]=candidate;accepted=True
 else:accepted=False
 d["last_update"]={"scene_id":a.scene_id,"accepted":accepted,"candidate_score":a.score};Path(a.out).write_text(json.dumps(d,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","accepted":accepted}))
if __name__=="__main__":main()
