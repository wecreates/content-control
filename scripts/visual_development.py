#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def build(topic):
    return {"schema_version":1,"topic":topic,"style_bible":{"background":"#FFFFFF","line":"#111111","accents":["#11A7A7","#EF3E36","#F4C542"],"typography":"bold sans","negative_space":"high"},"environments":[{"id":"white_stage"},{"id":"bank_counter"},{"id":"airport_lounge"},{"id":"retail_store"},{"id":"apartment"},{"id":"finance_metaphor_world"}],"props":[{"id":"wallet"},{"id":"card"},{"id":"calculator"},{"id":"phone"},{"id":"receipt"},{"id":"calendar"},{"id":"price_tag"},{"id":"coin"}],"publication_enabled":False}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--topic",required=True);ap.add_argument("--out",required=True);a=ap.parse_args();r=build(a.topic);Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","environments":len(r["environments"]),"props":len(r["props"])}))
if __name__=="__main__":main()
