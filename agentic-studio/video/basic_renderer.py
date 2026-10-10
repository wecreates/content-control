from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from moviepy.editor import AudioFileClip, ImageClip, concatenate_videoclips
import config

def _font(size):
    for path in config.FONT_PATHS["bold"]:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()

def _card(text, width, height):
    image = Image.new("RGB", (width, height), config.COLORS["background"])
    draw = ImageDraw.Draw(image)
    font = _font(max(30, width // 18))
    words = str(text).split()
    lines = []
    line = ""
    for word in words:
        candidate = (line + " " + word).strip()
        if draw.textbbox((0, 0), candidate, font=font)[2] < int(width * 0.82):
            line = candidate
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    y = int(height * 0.28)
    for item in lines[:5]:
        box = draw.textbbox((0, 0), item, font=font)
        x = (width - (box[2] - box[0])) // 2
        draw.text((x, y), item, font=font, fill=config.COLORS["white"])
        y += int(font.size * 1.3)
    return image

def render(script, audio_paths, output_path):
    vertical = script.get("video_type", "shorts") == "shorts"
    width, height = (config.SHORTS_WIDTH, config.SHORTS_HEIGHT) if vertical else (config.VIDEO_WIDTH, config.VIDEO_HEIGHT)
    fps = config.SHORTS_FPS if vertical else config.VIDEO_FPS
    clips = []
    audios = []
    try:
        for section, audio_path in zip(script.get("sections", []), audio_paths):
            audio = AudioFileClip(audio_path)
            audios.append(audio)
            image = _card(section.get("on_screen_text") or section.get("title") or "", width, height)
            clip = ImageClip(image).set_duration(audio.duration).set_audio(audio).set_fps(fps)
            clips.append(clip)
        if not clips:
            raise ValueError("no video sections")
        final = concatenate_videoclips(clips, method="compose")
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        final.write_videofile(str(output_path), fps=fps, codec="libx264", audio_codec="aac", preset=config.RENDER_PRESET, logger=None)
        final.close()
        return str(output_path)
    finally:
        for clip in clips:
            try: clip.close()
            except Exception: pass
        for audio in audios:
            try: audio.close()
            except Exception: pass
