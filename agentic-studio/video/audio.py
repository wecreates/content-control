import asyncio
from pathlib import Path
import edge_tts
import config

async def _save(text, path):
    voice = edge_tts.Communicate(
        text=text,
        voice=config.VOICE_ID,
        rate=config.VOICE_RATE,
        pitch=config.VOICE_PITCH,
    )
    await voice.save(str(path))

def synthesize_sections(script, output_dir):
    audio_dir = Path(output_dir) / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for number, section in enumerate(script.get("sections", []), start=1):
        text = str(section.get("narration", "")).strip()
        if not text:
            raise ValueError(f"section {number} has no narration")
        path = audio_dir / f"section_{number:02d}.mp3"
        asyncio.run(_save(text, path))
        paths.append(str(path))
    return paths
