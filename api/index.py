"""
Vercel Serverless Function entrypoint for REGRAVA FastAPI application.
"""
import sys
from pathlib import Path

# Add backend directory to Python sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app
