#!/usr/bin/env python3
import argparse, json, pathlib, statistics

ROOT = pathlib.Path(__file__).resolve().parents[1]
RUBRIC = ROOT / "control" / "creator-parity-ruthless-gate.json"

def load(path):
    return json.loads(pathlib.Path(path).read_text())

def safe_num(v, default=None):
    try:
        return float(v)
    except Exception:
        return default

def collect_competitor_signals(reports):
    signals = {
        "visual_change_sec": [],
        "intro_length_sec": [],
        "retention_reset_counts": [],
        "full_av_count": 0,
        "creators": set(),
        "transferable_mechanics": [],
        "slideshow_failure_modes": [],
        "lecture_failure_modes": [],
    }
    for r in reports:
        access = r.get("source_av_access", {})
        if access.get("visual") and access.get("audio") and access.get("complete_end_to_end"):
            signals["full_av_count"] += 1
        creator = r.get("creator")
        if creator:
            signals["creators"].add(creator)
        opening = r.get("opening", {})
        n = safe_num(opening.get("intro_length_est_sec"))
        if n is not None:
            signals["intro_length_sec"].append(n)
        motion = r.get("motion_language", {})
        n = safe_num(motion.get("meaningful_visual_change_est_sec"))
        if n is not None and n > 0:
            signals["visual_change_sec"].append(n)
        sr = r.get("story_and_retention", {})
        resets = sr.get("retention_resets") or []
        signals["retention_reset_counts"].append(len(resets))
        signals["transferable_mechanics"].extend(r.get("transferable_mechanics") or [])
        signals["slideshow_failure_modes"].extend(r.get("slideshow_failure_modes") or [])
        signals["lecture_failure_modes"].extend(r.get("lecture_failure_modes") or [])
    def median(xs):
        return statistics.median(xs) if xs else None
    return {
        "full_av_count": signals["full_av_count"],
        "creator_count": len(signals["creators"]),
        "creator_names": sorted(signals["creators"]),
        "median_visual_change_sec": median(signals["visual_change_sec"]),
        "median_intro_length_sec": median(signals["intro_length_sec"]),
        "median_retention_resets": median(signals["retention_reset_counts"]),
        "transferable_mechanics": signals["transferable_mechanics"],
        "slideshow_failure_modes": signals["slideshow_failure_modes"],
        "lecture_failure_modes": signals["lecture_failure_modes"],
    }

def candidate_bool(candidate, key):
    v = candidate.get(key)
    return bool(v) if isinstance(v, bool) else None

def compare(candidate, competitor_reports, rubric):
    benchmark = collect_competitor_signals(competitor_reports)
    faults = []
    repairs = []

    def fault(dimension, severity, evidence, repair):
        faults.append({
            "dimension": dimension,
            "severity": severity,
            "evidence": evidence,
            "repair": repair,
        })
        repairs.append({"dimension": dimension, "priority": severity, "action": repair})

    access = candidate.get("source_av_access", {})
    if not (access.get("visual") and access.get("audio") and access.get("complete_end_to_end")):
        fault("candidate_av_review","critical","Candidate lacks validated full visual+audio end-to-end review.","Run full AV review before parity evaluation.")

    if benchmark["full_av_count"] < rubric["pass_contract"].get("minimum_competitor_full_av_videos", 0):
        fault("competitor_benchmark","critical",
              f"Only {benchmark['full_av_count']} competitor videos have validated full AV evidence.",
              "Complete required competitor full-AV benchmark before approval.")

    opening = candidate.get("opening", {})
    first3 = (opening.get("first_3_seconds") or "").strip()
    first15 = (opening.get("first_15_seconds") or "").strip()
    if len(first3) < 25:
        fault("first_3_seconds","major","Opening evidence is too weak or underspecified.","Rebuild first 3 seconds around physical conflict/reversal/surprise.")
    if len(first15) < 50:
        fault("first_15_seconds","major","First-15-second promise/stakes are weak or underspecified.","Clarify stakes and entertainment promise by 15 seconds.")

    motion = candidate.get("motion_language", {})
    cand_change = safe_num(motion.get("meaningful_visual_change_est_sec"))
    bench_change = benchmark.get("median_visual_change_sec")
    if cand_change is None:
        fault("visual_change_frequency","major","Candidate visual-change cadence is unmeasured.","Measure meaningful visual-change cadence.")
    elif bench_change and cand_change > bench_change * 1.35:
        fault("visual_change_frequency","major",
              f"Candidate changes meaningfully every ~{cand_change:.2f}s vs competitor median ~{bench_change:.2f}s.",
              "Increase meaningful motion/cuts/reversals; do not add decorative movement.")

    why_not_lecture = (candidate.get("story_and_retention",{}).get("why_it_does_not_feel_like_a_lecture") or "").strip()
    if len(why_not_lecture) < 60:
        fault("lecture_risk","major","Candidate lacks strong evidence that explanation is carried by action/story rather than narration.","Convert explanatory beats into physical cause/effect and conflict.")

    if candidate.get("slideshow_detected") is True:
        fault("slideshow","critical","Candidate contains slideshow/card-deck grammar.","Replace cards with continuous world/action; no launch.")
    if candidate.get("lecture_detected") is True:
        fault("lecture","critical","Candidate is lecture-like.","Rewrite story around conflict, reversals, jokes, physical action, and chapter energy changes.")

    static_holds = []
    for row in candidate.get("ten_second_intervals") or []:
        if row.get("static_hold"):
            est = safe_num(row.get("static_hold_est_sec"),0) or 0
            if est > 2.5:
                static_holds.append({"start":row.get("start_sec"),"end":row.get("end_sec"),"est":est})
    if static_holds:
        fault("dead_air","major",f"Long static holds detected: {static_holds[:8]}","Animate character/world meaningfully or make stillness an intentional joke/tension beat.")

    story = candidate.get("story_and_retention", {})
    resets = story.get("retention_resets") or []
    bench_resets = benchmark.get("median_retention_resets")
    if bench_resets and len(resets) < max(2, bench_resets * 0.7):
        fault("retention_resets","major",
              f"Candidate has {len(resets)} resets vs competitor median {bench_resets}.",
              "Add real reveals, reversals, new problems, visual gags, and mini-payoffs.")

    callbacks = story.get("callbacks") or []
    if len(callbacks) < 2:
        fault("callbacks","medium","Too few callbacks for strong cohesion/rewatchability.","Seed recurring props/jokes early and pay them off later.")
    ending = (story.get("ending_payoff") or "").strip()
    if len(ending) < 40:
        fault("ending_payoff","major","Ending payoff is weak or underspecified.","End on a strong callback/reversal/final visual joke before teaser.")

    humor = candidate.get("humor", {})
    if len(humor.get("mechanisms") or []) < 3:
        fault("humor_density","medium","Humor system appears too narrow.","Mix visual undercut, deadpan, escalation, callback, reaction, and reversal.")

    sound = candidate.get("sound", {})
    if not (sound.get("sfx_density") and sound.get("sfx_sync")):
        fault("sound_design","major","Sound design lacks evidence of dense, synchronized storytelling support.","Time SFX to contact, reveals, failures, transitions, and punchlines; vary music energy.")

    if len(candidate.get("credit_card_adaptations") or []) < 3:
        fault("finance_clarity","medium","Candidate adaptation does not show enough finance-specific visual mechanisms.","Translate APR, points, fees, bonuses, and promo deadlines into physical visual metaphors.")

    distinctive = candidate.get("distinctive_elements_not_to_copy") or []
    if not distinctive:
        fault("originality","critical","No explicit originality boundary found.","Document creator-specific elements that must not be copied and keep only transferable mechanics.")

    severity_rank={"critical":0,"major":1,"medium":2,"minor":3}
    faults.sort(key=lambda x:(severity_rank.get(x["severity"],9),x["dimension"]))
    repairs.sort(key=lambda x:(severity_rank.get(x["priority"],9),x["dimension"]))
    critical=sum(1 for f in faults if f["severity"]=="critical")
    major=sum(1 for f in faults if f["severity"]=="major")
    medium=sum(1 for f in faults if f["severity"]=="medium")

    hard_fail_dimensions={d["id"] for d in rubric["dimensions"] if d.get("hard_fail")}
    unresolved_hard=[f["dimension"] for f in faults if f["dimension"] in hard_fail_dimensions or f["severity"]=="critical"]
    passed = critical==0 and major==0 and medium<=rubric["pass_contract"].get("maximum_unresolved_medium_faults",2) and not unresolved_hard

    return {
        "schema_version":1,
        "status":"PASS" if passed else "REJECT",
        "publication_enabled":False,
        "benchmark":benchmark,
        "fault_counts":{"critical":critical,"major":major,"medium":medium},
        "faults":faults,
        "prioritized_repairs":repairs,
        "unresolved_hard_fail_dimensions":sorted(set(unresolved_hard)),
        "approval_allowed":passed,
    }

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--candidate",required=True)
    ap.add_argument("--competitor",action="append",required=True)
    ap.add_argument("--out",required=True)
    args=ap.parse_args()
    rubric=load(RUBRIC)
    candidate=load(args.candidate)
    reports=[load(p) for p in args.competitor]
    result=compare(candidate,reports,rubric)
    pathlib.Path(args.out).write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"status":result["status"],"fault_counts":result["fault_counts"],"approval_allowed":result["approval_allowed"]},sort_keys=True))
    if not result["approval_allowed"]:
        raise SystemExit(2)

if __name__=="__main__":
    main()
