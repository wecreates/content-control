#!/usr/bin/env python3
import json
from pathlib import Path

ROOTS=[".github/workflows","control","scripts","remotion","production"]
FORBIDDEN={
  "aidocmaker.com":"legacy AI Voice Generator endpoint",
  "mcp-preview":"legacy preview voice asset",
  "content_control_zero_credit":"zero-credit voice fallback",
  "verified_local_voice_assets":"pinned legacy voice fallback",
  "READY_NO_CREDENTIALS":"voice pipeline allowed to continue without required provider",
}
EXCLUDE={
  "scripts/verify_no_legacy_voice.py",
  "scripts/audit_system_wiring.py",
  ".github/workflows/premium-voice-runtime-smoke.yml",
}
TEXT_SUFFIXES={".py",".yml",".yaml",".json",".jsx",".js",".ts",".tsx"}

def scan(root="."):
    root=Path(root)
    hits=[]
    for base in ROOTS:
        d=root/base
        if not d.exists():
            continue
        for p in d.rglob("*"):
            rel=str(p.relative_to(root))
            if not p.is_file() or p.suffix.lower() not in TEXT_SUFFIXES or rel in EXCLUDE:
                continue
            try:
                text=p.read_text(errors="ignore")
            except Exception:
                continue
            for needle,reason in FORBIDDEN.items():
                if needle in text:
                    hits.append({"path":rel,"marker":needle,"reason":reason})
    return {
      "schema_version":1,
      "status":"PASS" if not hits else "FAIL",
      "forbidden_hits":hits,
      "required_provider":"cartesia",
      "required_model":"sonic-3.6",
      "publication_enabled":False,
    }

def main():
    report=scan(".")
    out=Path("state/no-legacy-voice-health.json")
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    print(json.dumps(report,sort_keys=True))
    raise SystemExit(0 if report["status"]=="PASS" else 2)

if __name__=="__main__":
    main()
