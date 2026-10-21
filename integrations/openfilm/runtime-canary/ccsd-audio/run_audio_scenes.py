"""Runs only this task's reviewed synthetic harness; never mounts source/user homes."""
from pathlib import Path
import hashlib, json, os, subprocess, sys, uuid

base = Path(__file__).resolve().parent
out = base / "candidate-output"
out.mkdir(exist_ok=True)
(base / "docker-config").mkdir(exist_ok=True)
(base / "docker-config" / "config.json").write_text("{}",encoding="utf-8")
env = {k:v for k,v in os.environ.items() if k.upper() in
       {"SYSTEMROOT","WINDIR","COMSPEC","PATHEXT","TEMP","TMP","PATH"}}
docker = [r"C:\Program Files\Docker\Docker\resources\bin\docker.exe",
          "--config", str(base / "docker-config"),
          "--host", "npipe:////./pipe/dockerDesktopLinuxEngine"]
def call(args, timeout=30, check=True):
    return subprocess.run(docker+args, env=env, text=True, encoding="utf-8",
                          errors="replace", capture_output=True, timeout=timeout, check=check)

image = json.loads(call(["image","inspect","cyzor-openfilm-synthetic:local"]).stdout)[0]
assert image["Id"] == "sha256:e2938261a328145e48bc6cb4dffdfa03fb3d2eb4bb68af4a18916ebad522806d"
receipt = {"image_id":image["Id"],"image_created":image["Created"],"runs":[]}
receipt["fixture_sha256"] = {name:hashlib.sha256((base/name).read_bytes()).hexdigest()
                            for name in ["harness.mjs","scene-fixture.mjs","verify-output.mjs","render-candidate.mjs","audio-mix-compat.mjs","audio-process.mjs","audio-source-contract.mjs","format-matrix.mjs","ccsd-audio.mjs","storyboard-adapter.mjs","mapped-fixture.mjs"]}
for mode in sys.argv[1:] or ["success","missing-audio","cancel","mapped","cancel-mix","cancel-mux"]:
    assert mode in {"success","missing-audio","cancel","mapped","cancel-mix","cancel-mux","formats"}
    name = "cyzor-openfilm-" + mode + "-" + uuid.uuid4().hex[:8]
    row = {"mode":mode,"container_name":name}
    create_attempted = False
    try:
        args = ["create","--name",name,"--label",f"cyzor.synthetic.owner={name}","--pull","never","--network","none","--read-only",
                "--cap-drop","ALL","--security-opt","no-new-privileges","--pids-limit","256",
                "--memory","2g","--cpus","2","--shm-size","256m","--init","--user","1000:1000",
                "--tmpfs","/tmp:rw,nosuid,nodev,size=512m",
                "--mount",f"type=bind,source={out},target=/out",
                "--mount",f"type=bind,source={base},target=/fixtures,readonly",
                "--entrypoint","node",image["Id"],"/fixtures/format-matrix.mjs" if mode == "formats" else "/fixtures/harness.mjs",mode]
        create_attempted = True
        row["container_id"] = call(args).stdout.strip()
        cfg = json.loads(call(["inspect",name]).stdout)[0]
        host = cfg["HostConfig"]
        assert host["NetworkMode"] == "none"
        assert host["ReadonlyRootfs"] is True
        assert host["CapDrop"] == ["ALL"]
        assert "no-new-privileges" in host["SecurityOpt"]
        assert not host["Privileged"] and not host["PortBindings"]
        assert cfg["Config"]["User"] == "1000:1000"
        mounts = {m["Destination"]:m for m in cfg["Mounts"]}
        assert set(mounts) == {"/out","/fixtures"}
        assert mounts["/fixtures"]["RW"] is False
        assert Path(mounts["/out"]["Source"]).name == "candidate-output"
        allowed = {"PATH","NODE_VERSION","YARN_VERSION","OPENFILM_HOME","HOME"}
        assert {v.split("=",1)[0] for v in cfg["Config"]["Env"]} <= allowed
        row["isolation"] = {k:host[k] for k in ["NetworkMode","ReadonlyRootfs","CapDrop",
                              "SecurityOpt","Privileged","PortBindings","PidsLimit","Memory","NanoCpus","Tmpfs"]}
        row["user"] = cfg["Config"]["User"]
        row["environment_names"] = sorted(v.split("=",1)[0] for v in cfg["Config"]["Env"])
        result = call(["start","--attach",name],timeout=120,check=False)
        (out/f"{mode}-runtime.log").write_text(result.stdout+result.stderr,encoding="utf-8")
        state = json.loads(call(["inspect",name]).stdout)[0]["State"]
        row["exit_code"] = state["ExitCode"]
        row["oom_killed"] = state["OOMKilled"]
        assert not state["Running"] and state["ExitCode"] == 0 and not state["OOMKilled"], result.stdout+result.stderr
        report = json.loads((out/f"{mode}-report.json").read_text())
        assert report["passed"] is True
        row["passed"] = True
    except Exception as exc:
        row["passed"] = False
        row["error"] = str(exc)
    finally:
        try:
            if create_attempted:
                existing = call(["inspect",name],check=False)
                if existing.returncode == 0:
                    owned = json.loads(existing.stdout)[0]
                    assert owned["Config"]["Labels"].get("cyzor.synthetic.owner") == name
                    call(["rm","--force",name])
                else:
                    assert "No such object" in existing.stderr, existing.stderr
                gone = call(["inspect",name],check=False)
                row["container_removed"] = gone.returncode != 0 and "No such object" in gone.stderr
                assert row["container_removed"], gone.stderr
        except Exception as exc:
            row["passed"] = False
            row["container_removed"] = False
            row["cleanup_error"] = str(exc)
        finally:
            receipt["runs"].append(row)
            (out/"container-evidence.json").write_text(json.dumps(receipt,indent=2),encoding="utf-8")
            print(json.dumps(row),flush=True)
sys.exit(0 if all(row["passed"] for row in receipt["runs"]) else 1)
