from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
STUDIO = ROOT / "agentic-studio"
if str(STUDIO) not in sys.path:
    sys.path.insert(0, str(STUDIO))

from agents.gemini_client import build_chain
from agents.researcher import research_topic
from agents.scriptwriter import write_script

assert build_chain("gemini-3.8-flash")[0] == "gemini-3.8-flash"
assert callable(research_topic)
assert callable(write_script)
