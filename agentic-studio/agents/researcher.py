import json
import re
from datetime import datetime, timezone
from agents.gemini_client import generate_grounded

def _parse(text):
    cleaned = re.sub(r"^\s*```(?:json)?", "", text.strip(), flags=re.I)
    cleaned = re.sub(r"```\s*$", "", cleaned)
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if not match:
        raise ValueError("researcher returned no JSON object")
    data = json.loads(match.group())
    for key in ("topic","video_title","hook_question","key_points","tags"):
        if key not in data:
            raise ValueError(f"research JSON missing {key}")
    return data

def research_topic(channel_description, topic_override=""):
    today = datetime.now(timezone.utc).date().isoformat()
    scope = topic_override.strip() or "Select the strongest timely topic for this channel."
    prompt = f"""You are ViralForge Studio's trend researcher.
Current date: {today}
Channel description:
{channel_description}

Assignment:
{scope}

Use Google Search grounding and favor current primary sources.
Do not invent facts, dates, product terms, or quotations.

Return ONLY JSON:
{{
  "topic":"specific topic",
  "why_now":"why this is timely",
  "video_title":"curiosity-driven title under 70 characters",
  "hook_question":"one sharp opening question",
  "key_points":["point 1","point 2","point 3","point 4","point 5"],
  "tags":["tag1","tag2","tag3","tag4","tag5"],
  "source_notes":[{{"claim":"fact to verify","source":"source name","date":"date or unknown"}}],
  "risk_notes":["claims that need qualification"]
}}"""
    return _parse(generate_grounded(prompt))
