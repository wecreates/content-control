from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from moviepy.editor import AudioFileClip, ImageClip, concatenate_audioclips, concatenate_videoclips
import config

def _font(size, bold=False):
    candidates = config.FONT_PATHS["bold" if bold else "regular"]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()

def _frame(section, size):
    w, h = size
    image = Image.new("RGB", size, config.COLORS["background"])
    draw = ImageDraw.Draw(image)
    title = str(section.get("on_screen_text") or section.get("title") or "ViralForge")
    action = str(section.get("visual_action") or "")
    margin = int(w * 0.08)
    draw.rounded_rectangle((margin, int(h*.12), w-margin, int(h*.88)), radius=36, fill=(20,20,34), outline=config.COLORS["primary"], width=5)
    draw.text((margin*1.35, int(h*.18)), "VIRALFORGE", font=_font(max(28,int(w*.045)), True), fill=config.COLORS["accent"])
    draw.multiline_text((margin*1.35, int(h*.34)), title, font=_font(max(42,int(w*.075)), True), fill=config.COLORS["white"], spacing=12)
    if action:
        draw.multiline_text((margin*1.35, int(h*.70)), action[:140], font=_font(max(22,int(w*.032))), fill=config.COLORS["light"], spacing=8)
    return np.asarray(image)

def render(script, audio_paths, output_dir):
    root = Path(output_dir)
    root.mkdir(parents=True, exist_ok=True)
    sections = script.get("sections") or []
    if not sections:
        raise ValueError("script has no sections")
    if len(audio_paths) != len(sections):
        raise ValueError("audio/section count mismatch")
    vertical = script.get("video_type", "shorts") == "shorts"
    size = (config.SHORTS_WIDTH, config.SHORTS_HEIGHT) if vertical else (config.VIDEO_WIDTH, config.VIDEO_HEIGHT)
    fps = config.SHORTS_FPS if vertical else config.VIDEO_FPS
    clips, audios = [], []
    try:
        for section, audio_path in zip(sections, audio_paths):
            audio = AudioFileClip(str(audio_path))
            audios.append(audio)
            clip = ImageClip(_frame(section, size)).set_duration(audio.duration).set_audio(audio)
            clips.append(clip)
        video = concatenate_videoclips(clips, method="compose")
        output = root / "viralforge-candidate.mp4"
        video.write_videofile(str(output), fps=fps, codec="libx264", audio_codec="aac", preset=config.RENDER_PRESET, threads=1, logger=None)
        video.close()
        if not output.exists() or output.stat().st_size < 1024:
            raise RuntimeError("render output missing or empty")
        return str(output)
    finally:
        for clip in clips:
            try: clip.close()
            except Exception: pass
        for audio in audios:
            try: audio.close()
            except Exception: pass
