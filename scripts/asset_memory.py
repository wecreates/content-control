#!/usr/bin/env python3
import argparse,json
from collections import Counter
from pathlib import Path
def build_asset_index(assets):
    counts=Counter(x.get("type","unknown") for x in assets)
    by_type={}
    for a in assets: by_type.setdefault(a.get("type","unknown"),[]).append(a)
    return {"schema_version":1,"assets":assets,"by_type":by_type,"counts":dict(counts),"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--input",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();obj=json.loads(Path(a.input).read_text());assets=obj if isinstance(obj,list) else obj.get("assets",[]);r=build_asset_index(assets);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","assets":len(assets)}))
if __name__=="__main__":main()
