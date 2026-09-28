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
        "remotion/ReferenceCloneLongComposition.jsx",
        "remotion/reference-clone-long-index.jsx",
        "scripts/longform_media_qa.py",
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
    long_wf=root/".github/workflows/reference-clone-long-render.yml"
    long_wf_text=long_wf.read_text() if long_wf.is_file() else ""
    checks["longform_clone_connected"]=all((root/p).is_file() for p in [
        "scripts/longform_clone_architect.py","remotion/ReferenceCloneLongComposition.jsx",
        "remotion/reference-clone-long-index.jsx","scripts/longform_media_qa.py"
    ]) and "longform_clone_architect.py" in clone_wf_text and all(x in long_wf_text for x in [
        "ReferenceCloneLong","longform_media_qa.py","state/reference-clone-long-health.json"
    ]) and ".github/workflows/reference-clone-long-render.yml" in reg_allowed
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
    studio_files=[
        "control/studio-scene-schema-v1.json","control/studio-pipeline-v1.json",
        "control/dailies-contract-v1.json","control/asset-catalog-v1.json",
        "control/render-levels-v1.json","control/voice-performance-v1.json",
        "control/analytics-learning-v1.json","control/rd-quarantine-v1.json",
        "scripts/ccsd_validate.py","scripts/ccsd_from_scene_plan.py","scripts/ccsd_to_scene_plan.py",
        "scripts/story_room.py","scripts/storyboard_generator.py","scripts/animatic_plan.py",
        "scripts/dailies_review.py","scripts/visual_development.py","scripts/color_script.py",
        "scripts/cinematography_pass.py","scripts/rig_motion_pass.py","scripts/simulation_fx_pass.py",
        "scripts/crowd_pass.py","scripts/lighting_pass.py","scripts/editorial_pass.py",
        "scripts/sound_design_pass.py","scripts/music_score_pass.py","scripts/dialogue_direction.py",
        "scripts/facial_performance_pass.py","scripts/finishing_pass.py","scripts/asset_memory.py",
        "scripts/continuity_memory.py","scripts/production_tracker.py","scripts/shot_approval.py",
        "scripts/render_level_gate.py","scripts/shot_render_plan.py","scripts/audience_panel.py",
        "scripts/ab_development.py","scripts/accessibility_pass.py","scripts/localization_plan.py",
        "scripts/analytics_feedback.py","scripts/version_lineage.py","scripts/rd_quarantine.py",
        "remotion/MotionLibrary.jsx","tests/test_studio_stack.py",
    ]
    checks["studio_capability_files_complete"]=all((root/p).is_file() for p in studio_files)
    studio_wf=root/".github/workflows/studio-pipeline.yml"
    studio_text=studio_wf.read_text() if studio_wf.is_file() else ""
    checks["studio_pipeline_connected"]=all(x in studio_text for x in [
        "ccsd_from_scene_plan.py","storyboard_generator.py","animatic_plan.py","dailies_review.py",
        "visual_development.py","rig_motion_pass.py","simulation_fx_pass.py","lighting_pass.py",
        "editorial_pass.py","sound_design_pass.py","music_score_pass.py","dialogue_direction.py",
        "facial_performance_pass.py","audience_panel.py","accessibility_pass.py","localization_plan.py",
        "production_tracker.py","shot_render_plan.py","ccsd_to_scene_plan.py","shot-render-farm.yml"
    ]) and ".github/workflows/studio-pipeline.yml" in reg_allowed
    checks["clone_compiler_routes_through_studio"]="gh workflow run studio-pipeline.yml" in clone_wf_text
    checks["storyboard_animatic_dailies_connected"]=all((root/p).is_file() for p in [
        "scripts/storyboard_generator.py","scripts/animatic_plan.py","scripts/dailies_review.py"
    ]) and all(x in studio_text for x in ["storyboard-manifest.json","animatic.json","dailies.json"])
    ref_comp=(root/"remotion/ReferenceCloneComposition.jsx").read_text() if (root/"remotion/ReferenceCloneComposition.jsx").is_file() else ""
    checks["rig_motion_library_connected"]=(root/"remotion/MotionLibrary.jsx").is_file() and 'from "./MotionLibrary"' in ref_comp and "rig_motion_pass.py" in studio_text
    checks["progressive_approval_connected"]=all(x in studio_text for x in [
        "shot_approval.py","render_level_gate.py","shot-approval.json","render-level.json","FINAL"
    ])
    farm=root/".github/workflows/shot-render-farm.yml"
    farm_text=farm.read_text() if farm.is_file() else ""
    checks["shot_render_farm_connected"]=all(x in farm_text for x in [
        "strategy:","matrix:","--frames=","actions/upload-artifact@v4","actions/download-artifact@v4",
        "reference-clone-sharded-preview.mp4","shot-render-farm-health.json"
    ]) and ".github/workflows/shot-render-farm.yml" in reg_allowed and "shot-render-farm.yml" in studio_text
    analytics_wf=root/".github/workflows/analytics-feedback.yml"
    analytics_text=analytics_wf.read_text() if analytics_wf.is_file() else ""
    checks["analytics_learning_connected"]=all(x in analytics_text for x in [
        "analytics_feedback.py","analytics-feedback.json","creative-learning-memory.json"
    ]) and ".github/workflows/analytics-feedback.yml" in reg_allowed
    rd_wf=root/".github/workflows/rd-quarantine.yml"
    rd_text=rd_wf.read_text() if rd_wf.is_file() else ""
    checks["rd_quarantine_connected"]=all(x in rd_text for x in [
        "rd_quarantine.py","rd-baseline.json","rd-quarantine-health.json"
    ]) and ".github/workflows/rd-quarantine.yml" in reg_allowed
    checks["asset_continuity_memory_connected"]=all(x in studio_text for x in [
        "asset_memory.py","continuity_memory.py","asset-index.json","continuity-memory.json"
    ])
    checks["ab_audience_accessibility_connected"]=all(x in studio_text for x in [
        "ab_development.py","audience_panel.py","accessibility_pass.py","localization_plan.py"
    ])
    checks["studio_tests_exposed"]="test:studio" in scripts and "test_studio_stack.py" in scripts.get("test:studio","")
    clone_smoke=root/".github/workflows/clone-runtime-smoke.yml"
    clone_smoke_text=clone_smoke.read_text() if clone_smoke.is_file() else ""
    checks["clone_runtime_smoke_connected"]=all(x in clone_smoke_text for x in [
        "character-board-index.jsx","reference-clone-index.jsx","reference-clone-long-index.jsx",
        "state/clone-runtime-smoke.json"
    ]) and ".github/workflows/clone-runtime-smoke.yml" in reg_allowed
    checks["clone_render_props_connected"]=all(x in clone_render_text for x in [
        "Build runtime props","--props=qa-output/reference-clone/props.json"
    ]) and all(x in long_wf_text for x in [
        "Build runtime props","--props=qa-output/reference-clone-long/props.json"
    ])
    dept_map=_read_json(root/"control/studio-department-map-v1.json")
    dept_impls=[d.get("impl","") for d in dept_map.get("departments",[]) if isinstance(d,dict)]
    checks["studio_department_map_connected"]=len(dept_impls)>=25 and all((root/p).is_file() for p in dept_impls) and (root/"scripts/verify_studio_department_map.py").is_file() and "verify_studio_department_map.py" in studio_text
    voice_files=[
        "control/voice-provider-routing-v2.json","control/voice-lock-v1.json",
        "scripts/voice_provider.py","scripts/cartesia_sonic_generate.py","scripts/eleven_v3_generate.py",
        "scripts/voice_candidate_qa.py","scripts/voice_take_selector.py","scripts/ccsd_voice_manifest.py",
        "tests/test_voice_provider.py","tests/test_cartesia_sonic_generate.py","tests/test_eleven_v3_generate.py",
        "tests/test_voice_take_selector.py","tests/test_voice_candidate_qa.py","tests/test_ccsd_voice_manifest.py",
        "tests/test_voice_render_wiring.py",
    ]
    checks["premium_voice_stack_connected"]=all((root/p).is_file() for p in voice_files) and "premium_voice_director" in ids
    voice_contract=_read_json(root/"control/voice-provider-routing-v2.json")
    checks["premium_voice_quality_router"]=all([
        voice_contract.get("primary",{}).get("provider")=="Cartesia",
        voice_contract.get("primary",{}).get("model_id")=="sonic-3.6",
        voice_contract.get("dialogue_specialist",{}).get("provider")=="ElevenLabs",
        voice_contract.get("dialogue_specialist",{}).get("model_id")=="eleven_v3",
        voice_contract.get("fallback",{}).get("enabled") is True,
    ])
    checks["premium_voice_studio_wiring"]=all(x in studio_text for x in [
        "ccsd_voice_manifest.py","cartesia_sonic_generate.py","eleven_v3_generate.py",
        "voice_candidate_qa.py","voice_take_selector.py","reference-clone-voice.mp3"
    ]) and "voiceover_path" in ref_comp
    episode3_voice=episode3_text
    checks["premium_voice_episode3_wiring"]=all(x in episode3_voice for x in [
        "cartesia_sonic_generate.py","eleven_v3_generate.py","voice_candidate_qa.py",
        "voice_take_selector.py","CARTESIA_API_KEY","ELEVENLABS_API_KEY"
    ])
    voice_smoke=root/".github/workflows/premium-voice-runtime-smoke.yml"
    voice_smoke_text=voice_smoke.read_text() if voice_smoke.is_file() else ""
    checks["premium_voice_runtime_smoke_connected"]=all(x in voice_smoke_text for x in [
        "test_voice_provider.py","selected_strategy","sonic-3.6","eleven_v3","voiceover_path"
    ]) and ".github/workflows/premium-voice-runtime-smoke.yml" in reg_allowed
    checks["premium_voice_tests_exposed"]="test:voice" in scripts and "test_voice_provider.py" in scripts.get("test:voice","")
    voice_v3=_read_json(root/"control/voice-engine-v3.json")
    checks["voice_v3_connected"]=all((root/p).is_file() for p in [
        "control/voice-engine-v3.json",
        "requirements-voice.lock.txt",
        "scripts/cartesia_voice_engine.py",
        "scripts/premium_voice_qa.py",
        "scripts/ccsd_voice_manifest.py",
        "scripts/mix_voice_tracks.py"
    ]) and voice_v3.get("production_default",{}).get("model_id")=="sonic-3.6"
    checks["voice_v3_studio_path"]=all(x in studio_text for x in [
        "Build premium voice candidates",
        "cartesia_sonic_generate.py",
        "voice_take_selector.py",
        "reference-clone-voice.mp3",
        "inject_voiceover_path.py"
    ])
    short_comp=ref_comp
    long_comp=(root/"remotion/ReferenceCloneLongComposition.jsx").read_text() if (root/"remotion/ReferenceCloneLongComposition.jsx").is_file() else ""
    checks["voice_v3_render_path"]="voiceover_path" in short_comp and "voiceover_path" in long_comp
    checks["voice_v3_tests"]="test:voice" in scripts
    choreography_files=[
        "control/visual-choreography-v1.json",
        "control/object-behavior-library-v1.json",
        "control/kinetic-text-v1.json",
        "control/overlay-policy-v1.json",
        "control/transition-grammar-v1.json",
        "control/composition-policy-v1.json",
        "scripts/visual_choreography.py",
        "scripts/choreography_qa.py",
        "scripts/composition_director.py",
        "scripts/composition_frame_qa.py",
        "scripts/motion_choreography_qa.py",
        "remotion/ChoreographyRuntime.jsx",
        "remotion/PropSystem.jsx",
        "remotion/EnvironmentSystem.jsx",
        "tests/test_visual_choreography.py",
    ]
    checks["visual_choreography_stack_connected"]=all((root/p).is_file() for p in choreography_files)
    checks["visual_choreography_studio_gate"]=all(x in studio_text for x in [
        "composition_director.py",
        "visual_choreography.py",
        "choreography_qa.py",
        "15-choreography.json",
        "choreography-health.json"
    ])
    short_comp=(root/"remotion/ReferenceCloneComposition.jsx").read_text() if (root/"remotion/ReferenceCloneComposition.jsx").is_file() else ""
    long_comp=(root/"remotion/ReferenceCloneLongComposition.jsx").read_text() if (root/"remotion/ReferenceCloneLongComposition.jsx").is_file() else ""
    checks["visual_choreography_renderer_connected"]=all(x in short_comp for x in [
        "ChoreographyRuntime","EnvironmentSystem","ObjectChoreography","KineticText","OverlayChoreography","MicroGags","ContactCue"
    ]) and all(x in long_comp for x in [
        "ChoreographyRuntime","EnvironmentSystem","ObjectChoreography","KineticText","OverlayChoreography","MicroGags","ContactCue"
    ])
    checks["visual_choreography_render_qa"]=all(x in clone_render_text for x in [
        "composition_frame_qa.py","motion_choreography_qa.py","composition.json","motion.json"
    ]) and all(x in long_wf_text for x in [
        "composition_frame_qa.py","motion_choreography_qa.py","composition.json","motion.json"
    ])
    checks["visual_choreography_tests_exposed"]="test:choreography" in scripts and "test_visual_choreography.py" in scripts.get("test:choreography","")
    quality_depth_files=[
        "control/quality-depth-v1.json",
        "control/acting-depth-v1.json",
        "control/audio-depth-v1.json",
        "control/taste-director-v1.json",
        "scripts/story_room_v2.py",
        "scripts/story_room_critic.py",
        "scripts/apply_story_strategy.py",
        "scripts/storyboard_generator_v2.py",
        "scripts/visual_dailies_v2.py",
        "scripts/semantic_dailies_v2.py",
        "scripts/audience_panel_v2.py",
        "scripts/acting_director.py",
        "scripts/contact_physics_pass.py",
        "scripts/visual_development_v2.py",
        "scripts/longform_visual_director.py",
        "scripts/soundscape_director.py",
        "scripts/adaptive_score_v2.py",
        "scripts/soundscape_render.py",
        "scripts/reference_optical_flow.py",
        "scripts/reference_motion_v2.py",
        "scripts/reference_structure_v2.py",
        "scripts/reference_clone_enrich.py",
        "scripts/analytics_learning_v2.py",
        "scripts/production_scheduler.py",
        "scripts/typography_director.py",
        "scripts/typography_pass.py",
        "scripts/taste_features.py",
        "scripts/taste_director.py",
        "remotion/ArticulatedRig.jsx",
        "remotion/Physics2D.jsx",
        "tests/test_quality_depth.py",
    ]
    checks["quality_depth_stack_connected"]=all((root/p).is_file() for p in quality_depth_files)
    checks["quality_depth_studio_connected"]=all(x in studio_text for x in [
        "story_room_v2.py","story_room_critic.py","apply_story_strategy.py",
        "storyboard_generator_v2.py","visual_dailies_v2.py","semantic_dailies_v2.py","audience_panel_v2.py",
        "acting_director.py","contact_physics_pass.py","visual_development_v2.py",
        "longform_visual_director.py","soundscape_director.py","adaptive_score_v2.py",
        "soundscape_render.py","production_scheduler.py","typography_pass.py","18-master-ccsd.json"
    ])
    ingest=(root/"scripts/ingest_reference_video.py").read_text() if (root/"scripts/ingest_reference_video.py").is_file() else ""
    checks["reference_optical_flow_connected"]=all(x in ingest for x in [
        "reference_optical_flow.py","reference_motion_v2.py","reference_structure_v2.py","reference_clone_enrich.py","optical-flow.json","reference-structure.json"
    ]) and all(x in (root/"scripts/reference_clone_compiler.py").read_text() for x in [
        "reference_flow_direction","reference_flow_speed"
    ])
    char_src=(root/"remotion/CharacterSystem.jsx").read_text() if (root/"remotion/CharacterSystem.jsx").is_file() else ""
    checks["articulated_character_runtime_connected"]=all(x in char_src for x in [
        "elbowPoint","kneePoint","leftHandTarget","rightHandTarget","armBend","legBend","gazeX","blink","browLift"
    ]) and "performanceTargets" in ((root/"remotion/ChoreographyRuntime.jsx").read_text() if (root/"remotion/ChoreographyRuntime.jsx").is_file() else "")
    checks["adaptive_soundscape_connected"]="studio-soundscape.wav" in studio_text and "soundscape_render.py" in studio_text and "inject_soundscape_path.py" in studio_text and "soundscape_path" in short_comp and "soundscape_path" in long_comp
    checks["taste_director_render_gate"]=all(x in clone_render_text for x in [
        "taste_features.py","taste_director.py","taste.json"
    ]) and all(x in long_wf_text for x in [
        "taste_features.py","taste_director.py","taste.json"
    ])
    analytics_wf2=(root/".github/workflows/analytics-feedback.yml").read_text() if (root/".github/workflows/analytics-feedback.yml").is_file() else ""
    checks["analytics_learning_v2_connected"]="analytics_learning_v2.py" in analytics_wf2 and "18-master-ccsd.json" in analytics_wf2 and "creative-learning-memory.json" in analytics_wf2
    checks["quality_depth_tests_exposed"]="test:quality-depth" in scripts and "test_quality_depth.py" in scripts.get("test:quality-depth","")
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
