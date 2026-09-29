#!/usr/bin/env python3
import argparse,json
from pathlib import Path
GROUPS={"renderer":20,"measurement":20,"shot_production":10,"audio":20,"learning":15,"longform":15,"reliability":15,"acceptance":15}
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--out",required=True);a=ap.parse_args();r={"schema_version":1,"batch":6,"requested_total":130,"groups":GROUPS,"evidence_policy":"rendered_or_tested_behavior_required","publication_enabled":False,"status":"INSTALLED_FOR_REALIZATION","note":"Individual capabilities remain unproven until their renderer/media/test evidence passes."};Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps({"status":"PASS","total":sum(GROUPS.values())}))
if __name__=="__main__":main()
