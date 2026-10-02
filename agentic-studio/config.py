import os

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")

CHANNEL_NAME = os.getenv("CHANNEL_NAME", "ViralForge Studio")
CHANNEL_DESCRIPTION = os.getenv("CHANNEL_DESCRIPTION", """
An entertainment-first personal-finance and credit-card channel.
Topics include credit cards, rewards, points, credit scores, fees, consumer finance,
and high-interest financial stories. Scripts must be factual, understandable,
fast-paced, and entertaining without presenting individualized financial advice.
""").strip()

VOICE_ID = os.getenv("VOICE_ID", "en-US-AndrewNeural")
VOICE_RATE = os.getenv("VOICE_RATE", "-5%")
VOICE_PITCH = os.getenv("VOICE_PITCH", "-3Hz")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

VIDEO_WIDTH, VIDEO_HEIGHT, VIDEO_FPS = 1920, 1080, 24
SHORTS_WIDTH, SHORTS_HEIGHT, SHORTS_FPS = 1080, 1920, 30
KB_ZOOM_START, KB_ZOOM_END = 1.00, 1.10
CROSSFADE_DURATION = 0.7
BROLL_INTERVAL, BROLL_XFADE_DUR = 10.0, 1.2
RENDER_PRESET = os.getenv("RENDER_PRESET", "ultrafast")
OVERLAY_OPACITY = 0.62
COLORS = {"background":(10,10,20),"overlay":(0,0,0),"primary":(99,102,241),"accent":(167,139,250),"highlight":(251,191,36),"white":(255,255,255),"light":(199,210,254),"success":(52,211,153),"red":(239,68,68)}
FONT_PATHS = {"bold":["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"],"regular":["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"],"light":["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]}
REVIEW_PORT = int(os.getenv("REVIEW_PORT", "5050"))
PUBLICATION_ENABLED = os.getenv("PUBLICATION_ENABLED", "false").lower() == "true"
YOUTUBE_CLIENT_SECRET = os.getenv("YOUTUBE_CLIENT_SECRET", "")
YOUTUBE_SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
VIDEO_CATEGORY_ID = "27"
VIDEO_PRIVACY = "private"
MUSIC_ENABLED = os.getenv("MUSIC_ENABLED", "true").lower() == "true"
MUSIC_VOLUME = 0.12
MUSIC_LIBRARY_DIR = os.path.join(os.path.dirname(__file__), "music library")
OUTPUT_DIR = os.getenv("AGENTIC_OUTPUT_DIR", "output/agentic-studio")
IMAGES_DIR = os.path.join(OUTPUT_DIR, "images")
