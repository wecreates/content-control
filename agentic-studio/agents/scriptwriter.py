import json
import re
from agents.gemini_client import generate

def _parse(text):
    cleaned = re.sub(r"^\s*```(?:json)?", "", text.strip(), flags=re.I)
    cleaned = re.sub(r"```\s*$", "", cleaned)
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if not match:
        raise ValueError("scriptwriter returned no JSON object")
    data = json.loads(match.group())
    sections = data.get("sections") or []
    if len(sections) < 3:
        raise ValueError("script requires at least three sections")
    return data

def write_script(research, video_type="shorts"):
    if video_type == "shorts":
        structure = """
Create a 48-58 second vertical script with exactly 6 sections.
Each section is 7-10 seconds, 1-3 short sentences, and one clear visual action.
Use fast pattern interrupts and an ending that loops naturally to the opening.
"""
    else:
        structure = """
Create an 8-9 minute script with 9 sections.
Use a new pattern interrupt or visual beat every 3-5 seconds.
Open with the result/stakes, re-hook around 90 seconds and 3 minutes,
and end with a concise recap plus a specific comment question.
"""
    prompt = f"""You are ViralForge Studio's retention-focused scriptwriter.

Research:
{json.dumps(research, ensure_ascii=False)}

{structure}

Rules:
- Active voice.
- Short spoken sentences.
- No unsupported claims.
- Keep facts consistent with the research object.
- No generic welcome intro.
- Every section needs a concrete visual directive that can be animated with
  text, simple icons, charts, cards, or stick figures.
- Return only JSON.

Schema:
{{
  "title":"final title",
  "description":"two sentence description",
  "tags":["tag1","tag2"],
  "video_type":"{video_type}",
  "sections":[
    {{
      "id":1,
      "title":"internal beat title",
      "narration":"spoken narration",
      "visual_action":"specific motion-graphics direction",
      "on_screen_text":"short text, max 7 words",
      "duration_seconds":8
    }}
  ]
}}"""
    data = _parse(generate(prompt, temperature=0.65))
    data["video_type"] = video_type
    return data
