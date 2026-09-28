#!/usr/bin/env python3
import argparse,hashlib,json,re
from pathlib import Path
def sha(p):
    h=hashlib.sha256();h.update(Path(p).read_bytes());return h.hexdigest()
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--visual-source",required=True);ap.add_argument("--character-system",required=True);ap.add_argument("--board",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    src=Path(a.visual_source).read_text(); cs=Path(a.character_system).read_text(); board=Path(a.board)
    checks={
      "board_present":board.is_file() and board.stat().st_size>500,
      "locked_renderer_imported":'from "./CharacterSystem"' in src,
      "dave_present":"<Dave " in src and "export const Dave" in cs,
      "points_monk_present":"<PointsMonk " in src and "export const PointsMonk" in cs,
      "cashback_goblin_present":"<CashbackGoblin " in src and "export const CashbackGoblin" in cs,
      "publication_disabled":True
    }
    failed=[k for k,v in checks.items() if not v]
    r={"schema_version":1,"status":"PASS" if not failed else "FAIL","checks":checks,"failed_checks":failed,"character_system_sha256":sha(a.character_system),"board_sha256":sha(a.board) if board.is_file() else None,"publication_enabled":False}
    Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r,sort_keys=True));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
