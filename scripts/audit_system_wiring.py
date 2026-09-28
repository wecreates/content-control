#!/usr/bin/env python3
import json,re,sys
from pathlib import Path

AUTO_RE=re.compile(r"(?m)^  (push|schedule|workflow_run):")

def _read_json(path, default=None):
    try:
        return json.loads(path.read_text())
    except Exception:
        return {} if default is None else default

def audit_root(root: Path):
    checks={}
    details={}
    swarm=_read_json(root/"control/agent-swarm.json")
    registry=_read_json(root/"state/canonical-workflow-registry.json")
    vce=_read_json(root/"control/autonomous-viral-content-engine.json")
    cco=_read_json(root/"control/cco-production-contract.json")

    creative_paths=(swarm.get("creative_contracts") or {})
    checks["creative_contract_paths_exist"]=bool(creative_paths) and all((root/p).is_file() for p in creative_paths.values())
    details["creative_contract_paths"]=creative_paths

    ids={a.get("id") for a in swarm.get("agents",[]) if isinstance(a,dict)}
    required=set(cco.get("required_agents",[]))
    checks["cco_agents_connected"]=bool(required) and required <= ids
    details["missing_cco_agents"]=sorted(required-ids)

    char_renderer=(vce.get("character_system") or {}).get("renderer")
    char_bible=(vce.get("character_system") or {}).get("bible")
    checks["vce_character_renderer_connected"]=bool(char_renderer and char_bible and (root/char_renderer).is_file() and (root/char_bible).is_file())
    checks["vce_director_style_reference_connected"]=all((root/p).is_file() for p in [
        vce.get("creative_director",""),
        vce.get("style_dna",""),
        vce.get("reference_decomposition_contract","")
    ] if p) and all(bool(vce.get(k)) for k in ["creative_director","style_dna","reference_decomposition_contract"])

    episode3_workflow=root/".github/workflows/episode3-cashback-casino.yml"
    episode3_text=episode3_workflow.read_text() if episode3_workflow.is_file() else ""
    checks["episode3_pre_render_creative_gate"]=all(x in episode3_text for x in [
        "validate_creative_blueprint.py","production/episode3/creative-blueprint.json","Local hash-bound review smoke"
    ])
    checks["episode3_chain_connected"]=all(x in episode3_text for x in [
        "Trigger live verification","gh workflow run episode3-live-smoke.yml"
    ])
    checks["episode3_caption_pipeline"]=all(x in episode3_text for x in [
        "episode3-cashback-casino.vtt","caption_sha256","Build verified captions",
        "episode3-transcription-health.json","free_transcription_qa.py","caption_cues"
    ])

    server=root/"server-lowmem.js"
    server_text=server.read_text() if server.is_file() else ""
    checks["review_server_nonblank_shell"]=all(x in server_text for x in [
        'app.get("/",','app.get("/latest"',"color-scheme:light","loadingCard"
    ])
    checks["review_server_status_safe"]=('logs:[]' in server_text or 'logs: []' in server_text) and "renderState.logs.slice" in server_text
    checks["episode3_hash_bound_captions"]=all(x in server_text for x in [
        "episode3CaptionsPath","captionReady","/episode3/captions",'src="/episode3/captions"'
    ])

    visual=root/"remotion/CashbackCasinoVisual.jsx"
    visual_text=visual.read_text() if visual.is_file() else ""
    checks["episode3_character_system_connected"]=all(x in visual_text for x in [
        'from "./CharacterSystem"','<Dave ','<PointsMonk ','<CashbackGoblin '
    ])

    reg_allowed=set(registry.get("allowed_automatic",[]))
    reg_manual=set(registry.get("manual_only",[]))
    duplicates=reg_allowed & reg_manual
    checks["workflow_registry_disjoint"]=not duplicates
    details["workflow_registry_duplicates"]=sorted(duplicates)

    violations=[]
    wfdir=root/".github/workflows"
    if wfdir.is_dir():
        for p in sorted(wfdir.glob("*.yml")):
            rel=p.relative_to(root).as_posix()
            txt=p.read_text()
            automatic=bool(AUTO_RE.search(txt))
            if automatic and rel not in reg_allowed:
                violations.append({"path":rel,"reason":"automatic_not_registered"})
            if rel in reg_manual and automatic:
                violations.append({"path":rel,"reason":"manual_has_automatic_trigger"})
    checks["workflow_registry_covers_automatic"]=not violations
    details["workflow_violations"]=violations

    canonical=registry.get("canonical_generation_workflow","")
    checks["canonical_generation_exists"]=bool(canonical) and (root/canonical).is_file()

    publication_values=[
        swarm.get("publication_enabled"),
        registry.get("publication_enabled"),
        vce.get("publication_enabled"),
        cco.get("publication_enabled"),
    ]
    checks["publication_locked"]=all(v is False for v in publication_values)

    render=_read_json(root/"control/publication-owner-gate.json")
    sep=_read_json(root/"control/publication-separation.json")
    checks["publication_owner_separation_locked"]=render.get("publication_enabled") is False and sep.get("publication_enabled") is False

    render_yaml=(root/"render.yaml").read_text() if (root/"render.yaml").is_file() else ""
    checks["render_autodeploy_and_publication_lock"]="autoDeploy: true" in render_yaml and 'PUBLICATION_ENABLED' in render_yaml and 'value: "false"' in render_yaml

    pkg=_read_json(root/"package.json")
    scripts=pkg.get("scripts",{})
    checks["creative_tests_exposed"]="test:creative" in scripts and "test_creative_blueprint.py" in scripts.get("test:creative","")

    bp=root/"production/episode3/creative-blueprint.json"
    checks["episode3_blueprint_present"]=bp.is_file()

    live=root/".github/workflows/episode3-live-smoke.yml"
    live_text=live.read_text() if live.is_file() else ""
    checks["episode3_live_smoke_connected"]=all(x in live_text for x in [
        "state/episode3-health.json","public-review/episode3-cashback-casino.mp4",
        "/episode3/health","/episode3/captions","Range: bytes=0-1023","Candidate preflight"
    ]) and ".github/workflows/episode3-live-smoke.yml" in reg_allowed

    latest_health=_read_json(root/"state/episode3-health.json",{"status":"MISSING"})
    latest_live=_read_json(root/"state/episode3-live-health.json",{"status":"MISSING"})
    latest_video=root/"public-review/episode3-cashback-casino.mp4"
    latest_captions=root/"public-review/episode3-cashback-casino.vtt"
    checks["latest_candidate_accepted"]=all([
        latest_health.get("status")=="GREEN",
        latest_health.get("publication_enabled") is False,
        bool(latest_health.get("candidate_sha256")),
        bool(latest_health.get("caption_sha256")),
        latest_video.is_file(),
        latest_captions.is_file(),
    ])
    checks["latest_candidate_live_verified"]=all([
        latest_live.get("status")=="PASS",
        latest_live.get("publication_enabled") is False,
        latest_live.get("candidate_sha256")==latest_health.get("candidate_sha256"),
        latest_live.get("caption_sha256")==latest_health.get("caption_sha256"),
    ])
    checks["latest_path_end_to_end"]=checks["latest_candidate_accepted"] and checks["latest_candidate_live_verified"]

    failed=[k for k,v in checks.items() if not v]
    return {
        "schema_version":1,
        "status":"PASS" if not failed else "FAIL",
        "checks":checks,
        "failed_checks":failed,
        "details":details,
        "publication_enabled":False,
    }

def main():
    root=Path(".")
    report=audit_root(root)
    out=root/"state/system-wiring-health.json"
    out.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    print(json.dumps(report,sort_keys=True))
    return 0 if report["status"]=="PASS" else 2

if __name__=="__main__":
    raise SystemExit(main())
