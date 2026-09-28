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
    checks["episode3_layout_gate_connected"]=all([
        (root/"scripts/verify_episode3_layout.py").is_file(),
        "verify_episode3_layout.py" in episode3_text,
        "Verify Episode 3 layout safe zones" in episode3_text,
    ])
    checks["episode3_failed_diagnostics_persist"]=all(x in episode3_text for x in [
        "state/episode3-transcription-health.json",
        "qa-output/episode3/semantic.json",
        "qa-output/episode3/deterministic.json",
        "qa-output/episode3/audio.json",
    ])
    checks["episode3_transcription_acceptance_bound"]=all(x in episode3_text for x in [
        'transcription=json.load(open("state/episode3-transcription-health.json"))',
        'transcription["status"]=="PASS"',
        '"transcription":transcription'
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

    checks["chat_drop_clone_system_connected"]=all((root/p).is_file() for p in [
        "control/chat-drop-clone-contract.json",
        "scripts/reference_clone_compiler.py",
        "scripts/validate_reference_clone.py",
        "tests/test_reference_clone_compiler.py",
        "tests/test_reference_clone_validation.py",
    ]) and "chat_drop_clone_director" in ids
    clone_wf=root/".github/workflows/reference-clone-compile.yml"
    clone_wf_text=clone_wf.read_text() if clone_wf.is_file() else ""
    checks["reference_clone_workflow_connected"]=all(x in clone_wf_text for x in [
        "production/reference-clones/**/reference.json",
        "reference_clone_compiler.py",
        "validate_reference_clone.py",
        "clone-blueprint.json"
    ]) and ".github/workflows/reference-clone-compile.yml" in reg_allowed
    checks["chat_drop_clone_tests_exposed"]="test:clone" in scripts and "test_reference_clone_compiler.py" in scripts.get("test:clone","")
    clone_capability_files=[
        "scripts/ingest_reference_video.py",
        "scripts/decompose_reference_video.py",
        "scripts/reference_clone_compiler.py",
        "scripts/generate_clone_scene_plan.py",
        "remotion/ReferenceCloneComposition.jsx",
        "remotion/reference-clone-index.jsx",
        "scripts/reference_style_parity_qa.py",
        "scripts/character_identity_qa.py",
        "scripts/verify_character_board_lock.py",
        "scripts/voice_lock_qa.py",
        "scripts/style_memory.py",
        "scripts/select_reference_candidate.py",
        "scripts/generate_concept_selection.py",
        "scripts/generate_repair_plan.py",
        "scripts/longform_clone_architect.py",
        "control/voice-lock-v1.json",
        "control/character-board-lock-v1.json",
        "control/concept-selection-contract.json",
        "control/longform-clone-contract.json",
        "reference/characters/content-control-character-board.svg",
        "remotion/CharacterBoardComposition.jsx",
    ]
    checks["clone_capability_files_complete"]=all((root/p).is_file() for p in clone_capability_files)
    checks["clone_ingest_pipeline_connected"]=all((root/p).is_file() for p in [
        "scripts/ingest_reference_video.py","scripts/decompose_reference_video.py","scripts/validate_reference_clone.py"
    ])
    checks["clone_universal_renderer_connected"]=all((root/p).is_file() for p in [
        "remotion/ReferenceCloneComposition.jsx","remotion/reference-clone-index.jsx","scripts/generate_clone_scene_plan.py"
    ])
    checks["character_board_lock_connected"]=all((root/p).is_file() for p in [
        "reference/characters/content-control-character-board.svg","remotion/CharacterBoardComposition.jsx",
        "control/character-board-lock-v1.json","scripts/verify_character_board_lock.py"
    ])
    checks["voice_lock_connected"]=(root/"control/voice-lock-v1.json").is_file() and (root/"scripts/voice_lock_qa.py").is_file()
    checks["concept_selection_enforced"]=all(x in clone_wf_text for x in ["generate_concept_selection.py","concept-selection.json"])
    checks["style_memory_connected"]=all(x in clone_wf_text for x in ["style_memory.py","state/style-memory.json","select_reference_candidate.py"])
    checks["longform_clone_connected"]=(root/"scripts/longform_clone_architect.py").is_file() and "longform_clone_architect.py" in clone_wf_text
    clone_render=root/".github/workflows/reference-clone-render.yml"
    clone_render_text=clone_render.read_text() if clone_render.is_file() else ""
    checks["clone_render_qa_connected"]=all(x in clone_render_text for x in [
        "ReferenceClone","reference_style_parity_qa.py","character_identity_qa.py",
        "free_audio_qa.py","free_mobile_compat_qa.py","free_vision_qa.py","free_semantic_qa.py",
        "state/reference-clone-health.json"
    ]) and ".github/workflows/reference-clone-render.yml" in reg_allowed
    clone_live=root/".github/workflows/reference-clone-live-smoke.yml"
    clone_live_text=clone_live.read_text() if clone_live.is_file() else ""
    checks["clone_live_review_connected"]=all(x in server_text for x in [
        "/clone/health","/clone/media","/clone/watch","referenceCloneAcceptance"
    ]) and all(x in clone_live_text for x in ["/clone/health","/clone/watch","Range: bytes=0-1023"]) and ".github/workflows/reference-clone-live-smoke.yml" in reg_allowed
    clone_repair=root/".github/workflows/reference-clone-repair.yml"
    checks["clone_targeted_repair_connected"]=clone_repair.is_file() and (root/"scripts/generate_repair_plan.py").is_file() and ".github/workflows/reference-clone-repair.yml" in reg_allowed
    checks["renderer_backed_character_memory"]=all(x in (root/"remotion/CharacterBoardComposition.jsx").read_text() for x in [
        'from "./CharacterSystem"','<Dave ','<PointsMonk ','<CashbackGoblin '
    ]) if (root/"remotion/CharacterBoardComposition.jsx").is_file() else False
    checks["clone_generation_routing_locked"]=(root/"control/generation-routing.json").is_file() and _read_json(root/"control/generation-routing.json").get("primary_video_path")=="reference_clone_remotion" and _read_json(root/"control/generation-routing.json").get("generic_text_to_video",{}).get("enabled") is False
    checks["clone_voice_assignments_enforced"]=all(x in clone_wf_text for x in ["generate_voice_assignments.py","voice_lock_qa.py","voice-lock-health.json"])
    checks["clone_concept_receipt_enforced"]=all(x in clone_wf_text for x in ["generate_concept_selection.py","concept-selection.json"])
    checks["clone_renderer_backed_board_hash_enforced"]=all(x in clone_render_text for x in ["verify_character_board_lock.py","character-board-lock-health.json","character_board_lock"])
    checks["clone_actual_render_parity_enforced"]=all(x in clone_render_text for x in ["candidate-measured.json","decompose_reference_video.py","reference_style_parity_qa.py"])
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
