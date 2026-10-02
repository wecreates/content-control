import json
from pathlib import Path
import config

def require_configuration():
    missing = [k for k, v in {
        "GEMINI_API_KEY": config.GEMINI_API_KEY,
        "PEXELS_API_KEY": config.PEXELS_API_KEY,
    }.items() if not v]
    if missing:
        raise RuntimeError("Missing required configuration: " + ", ".join(missing))
    if config.PUBLICATION_ENABLED:
        raise RuntimeError("Publication must remain disabled for automated cloud runs")

def run():
    require_configuration()
    out = Path(config.OUTPUT_DIR)
    out.mkdir(parents=True, exist_ok=True)
    (out / "pipeline_contract.json").write_text(json.dumps({
        "channel": config.CHANNEL_NAME,
        "publication": False,
        "youtubePrivacy": config.VIDEO_PRIVACY,
        "stages": ["research", "script", "assets", "voice", "render", "qa", "review"],
        "handoff": "Content Control QA",
    }, indent=2))
    print("Agentic Studio cloud contract initialized.")
    print("Publication disabled; output is routed to Content Control QA.")

if __name__ == "__main__":
    run()
