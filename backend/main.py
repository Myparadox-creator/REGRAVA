"""
Main FastAPI entrypoint for Vercel Services deployment.
"""
import sys
from pathlib import Path

# Ensure both backend directory and current directory are in sys.path
_current_dir = Path(__file__).resolve().parent
if str(_current_dir) not in sys.path:
    sys.path.insert(0, str(_current_dir))

if (_current_dir / "backend").exists() and str(_current_dir / "backend") not in sys.path:
    sys.path.insert(0, str(_current_dir / "backend"))

try:
    from app.main import app
except ImportError:
    from backend.app.main import app

__all__ = ["app"]


