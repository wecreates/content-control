import time
from google import genai
from google.genai import types
import config

MODEL_CHAIN = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
]

_client = None

def _get_client():
    global _client
    if _client is None:
        if not config.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        _client = genai.Client(api_key=config.GEMINI_API_KEY)
    return _client

def build_chain(starting_model=None):
    preferred = (starting_model or config.GEMINI_MODEL or "").strip()
    if preferred in MODEL_CHAIN:
        i = MODEL_CHAIN.index(preferred)
        return MODEL_CHAIN[i:] + MODEL_CHAIN[:i]
    return list(MODEL_CHAIN)

def generate(prompt, starting_model=None, temperature=0.7):
    client = _get_client()
    last = None
    for model in build_chain(starting_model):
        for attempt in range(2):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(temperature=temperature),
                )
                text = (response.text or "").strip()
                if text:
                    return text
                raise RuntimeError("empty model response")
            except Exception as exc:
                last = exc
                message = str(exc).lower()
                transient = any(x in message for x in ("429","500","503","quota","rate","unavailable","overload"))
                if not transient:
                    raise
                if attempt == 0:
                    time.sleep(2)
    raise RuntimeError(f"all configured Gemini models failed: {type(last).__name__}")
