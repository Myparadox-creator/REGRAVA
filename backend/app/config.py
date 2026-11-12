"""
REGRAVA configuration.
Handles application settings, authentication keys, GitHub App configuration,
security scanner limits, and environment options.
"""

import os
import tempfile
from pathlib import Path
from typing import List, Optional
from dotenv import load_dotenv
from pydantic import BaseModel

_current_file = Path(__file__).resolve()
# Support both local monorepo (reposentinel/backend/app/config.py)
# and isolated serverless deployment (backend/app/config.py where backend is root)
if (_current_file.parent.parent.parent / "backend").exists():
    _project_root = _current_file.parent.parent.parent
elif (_current_file.parent.parent / "app").exists():
    _project_root = _current_file.parent.parent
else:
    _project_root = _current_file.parent.parent.parent

load_dotenv(_project_root / ".env")
if (_project_root / "backend").exists():
    load_dotenv(_project_root / "backend" / ".env")


def _resolve_default_db_path() -> str:
    env_path = os.getenv("REGRAVA_DATABASE_PATH")
    if env_path:
        return env_path

    is_serverless = any(
        k in os.environ
        for k in [
            "VERCEL",
            "VERCEL_ENV",
            "VERCEL_URL",
            "VERCEL_REGION",
            "AWS_LAMBDA_FUNCTION_NAME",
            "LAMBDA_TASK_ROOT",
            "NOW_REGION",
        ]
    )
    if is_serverless:
        return str(Path(tempfile.gettempdir()) / "regrava.db")

    local_backend = _project_root / "backend" if (_project_root / "backend").exists() else _project_root
    local_db = local_backend / "regrava.db"
    try:
        local_db.parent.mkdir(parents=True, exist_ok=True)
        test_file = local_db.parent / ".regrava_write_test"
        test_file.touch()
        test_file.unlink()
        return str(local_db)
    except Exception:
        return str(Path(tempfile.gettempdir()) / "regrava.db")


class Settings(BaseModel):
    APP_NAME: str = "REGRAVA"
    APP_TAGLINE: str = "Catch what your diff could break."
    APP_VERSION: str = "2.0.0"

    PROJECT_ROOT: Path = _project_root
    WORKSPACES_DIR: Path = PROJECT_ROOT / "workspaces"
    EXAMPLES_DIR: Path = PROJECT_ROOT / "examples" / "demo_project"
    ANALYZER_TS_DIR: Path = PROJECT_ROOT / "analyzer_ts"
    DATABASE_PATH: Path = Path(_resolve_default_db_path())

    # Scanner limits
    MAX_FILE_SIZE_BYTES: int = 1_048_576  # 1 MB
    MAX_DIFF_FILES: int = 500
    COMMAND_TIMEOUT_SECONDS: int = 20

    # Networking & CORS
    HOST: str = os.getenv("REGRAVA_HOST", "127.0.0.1")
    PORT: int = int(os.getenv("REGRAVA_PORT", "8000"))
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ] + [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "").split(",")
        if origin.strip()
    ]

    # Session & Security
    SECRET_KEY: str = os.getenv("REGRAVA_SECRET_KEY", "regrava-dev-secret-key-change-in-production-32bytes-min")
    SESSION_COOKIE_NAME: str = "regrava_session"
    SESSION_MAX_AGE_SECONDS: int = 60 * 60 * 24 * 7  # 7 days
    COOKIE_SECURE: bool = (
        os.getenv("REGRAVA_COOKIE_SECURE", "true" if os.getenv("VERCEL") else "false").lower()
        == "true"
    )
    COOKIE_SAMESITE: str = "lax"

    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: Optional[str] = os.getenv("GOOGLE_CLIENT_SECRET")
    GOOGLE_REDIRECT_URI: str = os.getenv(
        "GOOGLE_REDIRECT_URI",
        "http://127.0.0.1:8000/api/auth/google/callback",
    )

    # GitHub App Integration
    ANALYZER_VERSION: str = "2.1.0"
    REVIEW_CONFIDENCE_THRESHOLD: str = os.getenv("REGRAVA_REVIEW_CONFIDENCE_THRESHOLD", "medium")
    GITHUB_APP_ID: Optional[str] = os.getenv("GITHUB_APP_ID")
    GITHUB_APP_PRIVATE_KEY: Optional[str] = os.getenv("GITHUB_APP_PRIVATE_KEY")
    GITHUB_PRIVATE_KEY_PATH: Optional[str] = os.getenv("GITHUB_PRIVATE_KEY_PATH")
    GITHUB_WEBHOOK_SECRET: Optional[str] = os.getenv("GITHUB_WEBHOOK_SECRET")
    GITHUB_CLIENT_ID: Optional[str] = os.getenv("GITHUB_CLIENT_ID")
    GITHUB_CLIENT_SECRET: Optional[str] = os.getenv("GITHUB_CLIENT_SECRET")
    GITHUB_APP_NAME: str = os.getenv("GITHUB_APP_NAME", "regrava-scanner")
    GITHUB_REDIRECT_URI: str = os.getenv("GITHUB_REDIRECT_URI", "http://127.0.0.1:8000/api/auth/github/callback")
    GITHUB_FRONTEND_URL: str = os.getenv("GITHUB_FRONTEND_URL", "http://localhost:5173")
    GITHUB_TOKEN: Optional[str] = os.getenv("GITHUB_TOKEN") or os.getenv("GITHUB_PERSONAL_ACCESS_TOKEN")

    # Optional AI Provider
    ANTHROPIC_API_KEY: Optional[str] = os.getenv("ANTHROPIC_API_KEY")
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")

    def get_google_client_id(self) -> Optional[str]:
        try:
            from app.db.session_db import db
            val = db.get_config("GOOGLE_CLIENT_ID")
            if val:
                return val
        except Exception:
            pass
        return self.GOOGLE_CLIENT_ID

    def get_google_client_secret(self) -> Optional[str]:
        try:
            from app.db.session_db import db
            val = db.get_config("GOOGLE_CLIENT_SECRET")
            if val:
                return val
        except Exception:
            pass
        return self.GOOGLE_CLIENT_SECRET

    def get_github_client_id(self) -> Optional[str]:
        try:
            from app.db.session_db import db
            val = db.get_config("GITHUB_CLIENT_ID")
            if val:
                return val
        except Exception:
            pass
        return self.GITHUB_CLIENT_ID

    def get_github_client_secret(self) -> Optional[str]:
        try:
            from app.db.session_db import db
            val = db.get_config("GITHUB_CLIENT_SECRET")
            if val:
                return val
        except Exception:
            pass
        return self.GITHUB_CLIENT_SECRET

    def get_github_app_id(self) -> Optional[str]:
        val = (self.GITHUB_APP_ID or "").strip()
        if not val or val.startswith("test_") or "your_" in val.lower():
            return val if val and not val.startswith("test_") else None
        return val

    def get_github_app_private_key(self) -> Optional[str]:
        raw = (self.GITHUB_APP_PRIVATE_KEY or "").strip()
        if raw:
            normalized = raw.replace("\\n", "\n")
            if "BEGIN" in normalized and "PRIVATE KEY" in normalized:
                return normalized
        key_path = (self.GITHUB_PRIVATE_KEY_PATH or "").strip()
        if key_path:
            p = Path(key_path)
            if not p.is_absolute():
                p = self.PROJECT_ROOT / p
            if p.exists() and p.is_file():
                try:
                    content = p.read_text(encoding="utf-8").strip()
                    if "BEGIN" in content and "PRIVATE KEY" in content:
                        return content
                except Exception:
                    pass
        return None

    def get_github_webhook_secret(self) -> Optional[str]:
        val = (self.GITHUB_WEBHOOK_SECRET or "").strip()
        return val if val else None

    @property
    def is_github_app_configured(self) -> bool:
        return bool(self.get_github_app_id() and self.get_github_app_private_key())

    @property
    def is_webhook_configured(self) -> bool:
        return bool(self.get_github_webhook_secret())

    @property
    def is_google_configured(self) -> bool:
        cid = self.get_google_client_id()
        csec = self.get_google_client_secret()
        if not cid or not csec:
            return False
        clean_cid = cid.strip()
        clean_csec = csec.strip()
        if not clean_cid or not clean_csec:
            return False
        if clean_cid.startswith("test_") or "your_" in clean_cid.lower():
            return False
        return True

    @property
    def is_github_configured(self) -> bool:
        return bool(self.is_github_oauth_configured or self.GITHUB_TOKEN)

    @property
    def is_github_oauth_configured(self) -> bool:
        cid = self.get_github_client_id()
        csec = self.get_github_client_secret()
        if not cid or not csec:
            return False
        clean_cid = cid.strip()
        clean_csec = csec.strip()
        if not clean_cid or not clean_csec:
            return False
        if clean_cid.startswith("test_") or "your_" in clean_cid.lower():
            return False
        return True


settings = Settings()
