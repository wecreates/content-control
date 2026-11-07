import importlib.util
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
STUDIO = ROOT / "agentic-studio"
APP = STUDIO / "cloud_app.py"

def load_app(env):
    old_path = list(sys.path)
    try:
        sys.path.insert(0, str(STUDIO))
        sys.modules.pop("config", None)
        with patch.dict(os.environ, env, clear=True):
            spec = importlib.util.spec_from_file_location("viralforge_runtime_app", APP)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            return module
    finally:
        sys.path[:] = old_path

class ViralForgeRuntimeTests(unittest.TestCase):
    def base(self):
        return {"PUBLICATION_ENABLED":"false","VIDEO_PRIVACY":"private","VIRALFORGE_CONTROL_TOKEN":"test-token"}

    def test_live_without_provider_keys(self):
        module = load_app(self.base())
        response = module.app.test_client().get("/live")
        self.assertEqual(response.status_code, 200)

    def test_health_fail_closed_without_provider_keys(self):
        module = load_app(self.base())
        response = module.app.test_client().get("/health")
        self.assertEqual(response.status_code, 503)

    def test_run_rejects_missing_control_token(self):
        module = load_app(self.base())
        response = module.app.test_client().post("/run")
        self.assertEqual(response.status_code, 401)

    def test_publish_stays_disabled(self):
        module = load_app(self.base())
        response = module.app.test_client().post("/publish", headers={"X-ViralForge-Token":"test-token"})
        self.assertEqual(response.status_code, 403)

    def test_headers(self):
        module = load_app(self.base())
        response = module.app.test_client().get("/")
        self.assertEqual(response.headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(response.headers.get("X-Frame-Options"), "DENY")
        self.assertIn("no-store", response.headers.get("Cache-Control", ""))

if __name__ == "__main__":
    unittest.main()
