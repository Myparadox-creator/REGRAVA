"""
REGRAVA configuration.
Handles application settings, authentication keys, GitHub App configuration,
security scanner limits, and environment options.
"""

import os
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel


class Settings(BaseModel):
    APP_NAME: str = "REGRAVA"
    APP_TAGLINE: str = "Catch what your diff could break."
    APP_VERSION: str = "2.0.0"

    PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent.parent
    WORKSPACES_DIR: Path = PROJECT_ROOT / "workspaces"
    EXAMPLES_DIR: Path = PROJECT_ROOT / "examples" / "demo_project"
    ANALYZER_TS_DIR: Path = PROJECT_ROOT / "analyzer_ts"
    DATABASE_PATH: Path = PROJECT_ROOT / "backend" / "regrava.db"

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
    ]

    # Session & Security
    SECRET_KEY: str = os.getenv("REGRAVA_SECRET_KEY", "regrava-dev-secret-key-change-in-production-32bytes-min")
    SESSION_COOKIE_NAME: str = "regrava_session"
    SESSION_MAX_AGE_SECONDS: int = 60 * 60 * 24 * 7  # 7 days
    COOKIE_SECURE: bool = os.getenv("REGRAVA_COOKIE_SECURE", "false").lower() == "true"
    COOKIE_SAMESITE: str = "lax"

    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: Optional[str] = os.getenv("GOOGLE_CLIENT_SECRET")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:5173/auth/google/callback")

    # GitHub App Integration
    GITHUB_APP_ID: Optional[str] = os.getenv("GITHUB_APP_ID")
    GITHUB_APP_PRIVATE_KEY: Optional[str] = os.getenv("GITHUB_APP_PRIVATE_KEY")
    GITHUB_CLIENT_ID: Optional[str] = os.getenv("GITHUB_CLIENT_ID")
    GITHUB_CLIENT_SECRET: Optional[str] = os.getenv("GITHUB_CLIENT_SECRET")
    GITHUB_APP_NAME: str = os.getenv("GITHUB_APP_NAME", "regrava-security")
    GITHUB_REDIRECT_URI: str = os.getenv("GITHUB_REDIRECT_URI", "http://127.0.0.1:8000/api/auth/github/callback")
    GITHUB_FRONTEND_URL: str = os.getenv("GITHUB_FRONTEND_URL", "http://localhost:5173")
    GITHUB_TOKEN: Optional[str] = os.getenv("GITHUB_TOKEN") or os.getenv("GITHUB_PERSONAL_ACCESS_TOKEN")

    # Optional AI Provider
    ANTHROPIC_API_KEY: Optional[str] = os.getenv("ANTHROPIC_API_KEY")
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")

    @property
    def is_google_configured(self) -> bool:
        return bool(self.GOOGLE_CLIENT_ID and self.GOOGLE_CLIENT_SECRET)

    @property
    def is_github_configured(self) -> bool:
        return bool((self.GITHUB_CLIENT_ID and self.GITHUB_CLIENT_SECRET) or self.GITHUB_TOKEN)


settings = Settings()
