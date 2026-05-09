import os
from dotenv import load_dotenv

load_dotenv()

# Load keys from .env (comma-separated)
_keys_raw = os.getenv("GEMINI_API_KEYS") or os.getenv("GEMINI_API_KEY")
GEMINI_API_KEYS = [k.strip() for k in _keys_raw.split(",") if k.strip()] if _keys_raw else []
GEMINI_API_KEY = GEMINI_API_KEYS[0] if GEMINI_API_KEYS else None
FLASK_PORT = int(os.getenv("FLASK_PORT", 5000))
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", 10))
MAX_CONTENT_LENGTH = MAX_FILE_SIZE_MB * 1024 * 1024  # bytes

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {"pdf", "txt"}
