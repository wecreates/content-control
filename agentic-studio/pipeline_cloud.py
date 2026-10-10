import json
from pathlib import Path
import config
from agents.researcher import research_topic
from agents.scriptwriter import write_script
from qa_contract import validate_handoff

try:
    from audio_engine import synthesize_sections
except ImportError:
    from voice_engine import synthesize_sections

try:
    from video_renderer import render
except ImportError:
    from renderer import render

def require_configuration():
    missing = [k for k, v in {"GEMINI_API_KEY": config.GEMINI_API_KEY}.items() if not v]
    if missing:
        raise RuntimeError("Missing required configuration: " + ", ".join(missing))
    if config.PUBLICATION_ENABLED:
        raise RuntimeError("Publication must remain disabled for automated cloud runs")
    if config.VIDEO_PRIVACY != "private":
        raise RuntimeError("Video privacy must remain private for automated cloud runs")
    return []

def _write(path, data):
    Path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

def run(topic_override="", video_type="shorts", output_dir=None):
    require_configuration()
    out = Path(output_dir or config.OUTPUT_DIR)
    out.mkdir(parents=True, exist_ok=True)

    research = research_topic(config.CHANNEL_DESCRIPTION, topic_override)
    _write(out / "research.json", research)

    script = write_script(research, video_type=video_type)
    _write(out / "script.json", script)

    audio_paths = synthesize_sections(script["sections"], out)
    _write(out / "audio_manifest.json", {"files": [str(p) for p in audio_paths]})

    video = render(script, audio_paths, out)
    handoff = {
        "video": str(video),
        "publication": False,
        "youtubePrivacy": "private",
        "channel": config.CHANNEL_NAME,
        "topic": research.get("topic"),
    }
    _write(out / "handoff.json", handoff)

    qa = validate_handoff(out)
    _write(out / "qa.json", qa)
    if not qa["ok"]:
        raise RuntimeError("ViralForge QA failed: " + "; ".join(qa.get("errors", [])))
    return qa

if __name__ == "__main__":
    run()
