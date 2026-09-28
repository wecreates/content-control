#!/usr/bin/env python3
import argparse,hashlib,json
from pathlib import Path
def h(p):
    q=Path(p);d=hashlib.sha256(q.read_bytes()).hexdigest();return d
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--lock",default="control/character-board-lock-v1.json");ap.add_argument("--out",default="state/character-board-lock-health.json");a=ap.parse_args()
    lock=json.loads(Path(a.lock).read_text())
    board=Path(lock["canonical_board"]);system=Path(lock["character_system"]);comp=Path(lock["renderer_backed_board_component"])
    ct=comp.read_text() if comp.is_file() else ""
    checks={
      "board_present":board.is_file(),
      "character_system_present":system.is_file(),
      "board_component_present":comp.is_file(),
      "board_component_uses_character_system":'from "./CharacterSystem"' in ct and all(x in ct for x in ["<Dave ","<PointsMonk ","<CashbackGoblin "]),
      "publication_disabled":lock.get("publication_enabled") is False
    }
    failed=[k for k,v in checks.items() if not v]
    r={"schema_version":1,"status":"PASS" if not failed else "FAIL","checks":checks,"failed_checks":failed,"board_sha256":h(board) if board.is_file() else None,"character_system_sha256":h(system) if system.is_file() else None,"board_component_sha256":h(comp) if comp.is_file() else None,"publication_enabled":False}
    Path(a.out).write_text(json.dumps(r,indent=2,sort_keys=True)+"\n");print(json.dumps(r,sort_keys=True));raise SystemExit(0 if r["status"]=="PASS" else 2)
if __name__=="__main__":main()
