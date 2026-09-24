#!/usr/bin/env python3
import argparse, json, pathlib

SHORT_LIMITS={
  "aspect":"9:16",
  "max_hook_sec":1.0,
  "max_promise_sec":4.0,
  "max_visual_change_sec":1.8,
  "max_static_hold_sec":2.0,
  "max_retention_reset_sec":10.0,
  "min_physical_action_ratio":0.65,
  "min_visual_jokes":3,
  "min_callbacks":1,
  "loop_end_required":True,
}
LONG_LIMITS={
  "aspect":"16:9",
  "max_hook_sec":3.0,
  "max_promise_sec":15.0,
  "max_visual_change_sec":2.2,
  "max_static_hold_sec":2.5,
  "max_retention_reset_sec":28.0,
  "min_physical_action_ratio":0.55,
  "min_visual_jokes":8,
  "min_callbacks":3,
  "loop_end_required":False,
}

def evaluate_spec(spec):
    fmt=spec.get("format")
    if fmt not in ("short","long"):
        return {"pass":False,"hard_failures":["invalid_format"],"faults":[{"dimension":"format","severity":"critical"}]}
    limits=SHORT_LIMITS if fmt=="short" else LONG_LIMITS
    hard=[]
    faults=[]
    def fail(name,detail,severity="major",hard_fail=True):
        faults.append({"dimension":name,"severity":severity,"detail":detail})
        if hard_fail:
            hard.append(name)
    if spec.get("publication_enabled") is not False:
        fail("publication_lock","publication_enabled must be false","critical")
    if spec.get("slideshow") is True:
        fail("slideshow","slide/card-deck grammar is forbidden","critical")
    if spec.get("lecture") is True:
        fail("lecture","lecture structure is forbidden","critical")
    if spec.get("continuous_motion") is not True:
        fail("continuous_motion","continuous or motivated motion is required")
    if spec.get("aspect") != limits["aspect"]:
        fail("aspect",f"expected {limits['aspect']}, got {spec.get('aspect')}")
    checks=[
      ("hook_sec","max_hook_sec","hook"),
      ("promise_sec","max_promise_sec","promise"),
      ("meaningful_visual_change_sec","max_visual_change_sec","visual_change_frequency"),
      ("max_static_hold_sec","max_static_hold_sec","dead_air"),
      ("retention_reset_sec","max_retention_reset_sec","retention_resets"),
    ]
    for field,limit_key,name in checks:
        try:
            value=float(spec[field])
        except Exception:
            fail(name,f"{field} missing or invalid")
            continue
        if value>limits[limit_key]:
            fail(name,f"{field}={value} exceeds {limits[limit_key]}")
    try:
        ratio=float(spec.get("physical_action_ratio",0))
    except Exception:
        ratio=0
    if ratio<limits["min_physical_action_ratio"]:
        fail("physical_action",f"physical_action_ratio={ratio} below {limits['min_physical_action_ratio']}")
    try:
        jokes=int(spec.get("visual_jokes",0))
    except Exception:
        jokes=0
    if jokes<limits["min_visual_jokes"]:
        fail("visual_humor",f"visual_jokes={jokes} below {limits['min_visual_jokes']}",hard_fail=False)
    try:
        callbacks=int(spec.get("callbacks",0))
    except Exception:
        callbacks=0
    if callbacks<limits["min_callbacks"]:
        fail("callbacks",f"callbacks={callbacks} below {limits['min_callbacks']}",hard_fail=False)
    if spec.get("sound_sync") is not True:
        fail("sound_design","impact/reveal/punchline sound sync is required")
    if limits["loop_end_required"] and spec.get("loop_end") is not True:
        fail("loop_end","short-form ending must loop or strongly re-open curiosity")
    severe=sum(1 for f in faults if f["severity"] in ("critical","major"))
    return {
      "pass":not hard and severe==0,
      "format":fmt,
      "limits":limits,
      "hard_failures":sorted(set(hard)),
      "faults":faults,
      "publication_enabled":False,
    }

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("spec")
    ap.add_argument("--out")
    args=ap.parse_args()
    spec=json.load(open(args.spec))
    result=evaluate_spec(spec)
    if args.out:
        pathlib.Path(args.out).write_text(json.dumps(result,indent=2,sort_keys=True)+"\n")
    print(json.dumps(result,sort_keys=True))
    if not result["pass"]:
        raise SystemExit(2)

if __name__=="__main__":
    main()
