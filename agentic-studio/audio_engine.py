import asyncio
from pathlib import Path
import edge_tts
import config

async def _save(text, path):
    communicate = edge_tts.Communicate(
        text=text,
        voice=config.VOICE_ID,
        rate=config.VOICE_RATE,
        pitch=config.VOICE_PITCH,
    )
    await communicate.save(str(path))

def synthesize_sections(sections, output_dir):
    root = Path(output_dir)
    audio_dir = root / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for index, section in enumerate(sections, start=1):
        text = str(section.get("narration", "")).strip()
        if not text:
            raise ValueError(f"section {index} has no narration")
        path = audio_dir / f"section-{index:02d}.mp3"
        asyncio.run(_save(text, path))
        if not path.exists() or path.stat().st_size == 0:
            raise RuntimeError(f"voice generation failed for section {index}")
        paths.append(str(path))
    return paths
