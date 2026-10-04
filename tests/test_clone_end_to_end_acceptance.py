import hashlib,json,tempfile,unittest
from pathlib import Path
from scripts.clone_end_to_end_acceptance import verify

def write_artifact(root):
    p=root/"candidate.mp4";p.write_bytes(b"real-render-bytes")
    return p,hashlib.sha256(p.read_bytes()).hexdigest()

def manifest(sha):
    stages={}
    for name in ("reference_av","reference_analysis","clone_blueprint","scene_plan","render","technical_qa","creative_qa","parity_qa","originality_qa","review_hosting"):
        stages[name]={"status":"PASS","evidence":[f"{name}.json"]}
    stages["reference_av"]["contract"]={"visual_access":True,"audio_access":True,"complete_end_to_end":True,"timestamped_evidence":True}
    stages["render"].update({"artifact":"candidate.mp4","sha256":sha})
    for name in ("technical_qa","creative_qa","parity_qa"): stages[name]["artifact_sha256"]=sha
    stages["originality_qa"].update({"mechanics_only":True,"creator_specific_copy":False})
    stages["review_hosting"].update({"url":"https://example.test/watch/abc","browser_playback_verified":True})
    return {"publication_enabled":False,"stages":stages}

class CloneEndToEndAcceptanceTests(unittest.TestCase):
    def test_accepts_only_complete_exact_artifact_chain(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);_,sha=write_artifact(root);r=verify(manifest(sha),root)
            self.assertEqual(r["status"],"PASS");self.assertEqual(r["accepted_artifact_sha256"],sha)
    def test_rejects_qa_bound_to_different_render(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);_,sha=write_artifact(root);m=manifest(sha);m["stages"]["creative_qa"]["artifact_sha256"]="wrong"
            self.assertEqual(verify(m,root)["status"],"REJECT")
    def test_rejects_metadata_only_reference(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);_,sha=write_artifact(root);m=manifest(sha);m["stages"]["reference_av"]["contract"]["audio_access"]=False
            self.assertEqual(verify(m,root)["status"],"REJECT")
    def test_rejects_creator_specific_copy(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);_,sha=write_artifact(root);m=manifest(sha);m["stages"]["originality_qa"]["creator_specific_copy"]=True
            self.assertEqual(verify(m,root)["status"],"REJECT")
    def test_rejects_unverified_review_host(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);_,sha=write_artifact(root);m=manifest(sha);m["stages"]["review_hosting"]["browser_playback_verified"]=False
            self.assertEqual(verify(m,root)["status"],"REJECT")
if __name__=="__main__":unittest.main()
