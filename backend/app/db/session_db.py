"""
Database storage for REGRAVA.
Uses SQLite for zero-configuration, production-grade local persistence of users,
sessions, authorized GitHub repositories, and PR analysis history.
"""

import json
import sqlite3
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from app.config import settings


class DatabaseManager:
    def __init__(self, db_path=None):
        self.db_path = str(db_path or settings.DATABASE_PATH)
        self._init_tables()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_tables(self) -> None:
        with self._get_connection() as conn:
            conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                avatar_url TEXT,
                auth_provider TEXT NOT NULL,
                is_demo INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS github_accounts (
                user_id TEXT PRIMARY KEY,
                github_user_id TEXT,
                github_username TEXT,
                installation_id TEXT,
                authorized_repos TEXT NOT NULL DEFAULT '[]',
                access_token TEXT,
                expires_at TEXT,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS pr_analyses (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                repo_name TEXT NOT NULL,
                pr_number INTEGER NOT NULL,
                pr_title TEXT NOT NULL,
                base_ref TEXT NOT NULL,
                head_ref TEXT NOT NULL,
                status TEXT NOT NULL,
                findings_json TEXT NOT NULL DEFAULT '[]',
                metrics_json TEXT NOT NULL DEFAULT '{}',
                summary_json TEXT NOT NULL DEFAULT '{}',
                execution_time_ms REAL NOT NULL DEFAULT 0.0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS finding_reviews (
                analysis_id TEXT NOT NULL,
                finding_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'open',
                notes TEXT,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (analysis_id, finding_id),
                FOREIGN KEY (analysis_id) REFERENCES pr_analyses(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
            CREATE INDEX IF NOT EXISTS idx_analyses_user ON pr_analyses(user_id);
            CREATE INDEX IF NOT EXISTS idx_analyses_repo ON pr_analyses(repo_name);
            """)

    # --- User Management ---
    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            return dict(row) if row else None

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
            return dict(row) if row else None

    def upsert_user(
        self,
        email: str,
        name: str,
        auth_provider: str,
        avatar_url: Optional[str] = None,
        is_demo: bool = False,
    ) -> Dict[str, Any]:
        existing = self.get_user_by_email(email)
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            if existing:
                conn.execute(
                    "UPDATE users SET name = ?, avatar_url = ? WHERE id = ?",
                    (name, avatar_url or existing.get("avatar_url"), existing["id"]),
                )
                existing["name"] = name
                if avatar_url:
                    existing["avatar_url"] = avatar_url
                return existing
            else:
                user_id = str(uuid.uuid4())
                conn.execute(
                    "INSERT INTO users (id, email, name, avatar_url, auth_provider, is_demo, created_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (user_id, email, name, avatar_url, auth_provider, 1 if is_demo else 0, now),
                )
                return {
                    "id": user_id,
                    "email": email,
                    "name": name,
                    "avatar_url": avatar_url,
                    "auth_provider": auth_provider,
                    "is_demo": 1 if is_demo else 0,
                    "created_at": now,
                }

    # --- Session Management ---
    def create_session(self, user_id: str, token: str, duration_seconds: int = 60 * 60 * 24 * 7) -> str:
        now = datetime.now(timezone.utc)
        expires_at = (now + timedelta(seconds=duration_seconds)).isoformat()
        with self._get_connection() as conn:
            conn.execute(
                "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
                (token, user_id, now.isoformat(), expires_at),
            )
        return token

    def get_session(self, token: str) -> Optional[Dict[str, Any]]:
        if not token:
            return None
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT s.token, s.user_id, s.expires_at, u.email, u.name, u.avatar_url, u.auth_provider, u.is_demo "
                "FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?",
                (token,),
            ).fetchone()
            if not row:
                return None

            data = dict(row)
            # Check expiration
            expires_at = datetime.fromisoformat(data["expires_at"])
            if datetime.now(timezone.utc) > expires_at:
                self.delete_session(token)
                return None
            return data

    def delete_session(self, token: str) -> None:
        with self._get_connection() as conn:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))

    # --- GitHub Account & Repository Authorizations ---
    def get_github_account(self, user_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM github_accounts WHERE user_id = ?", (user_id,)).fetchone()
            if not row:
                return None
            data = dict(row)
            data["authorized_repos"] = json.loads(data["authorized_repos"])
            return data

    def save_github_account(
        self,
        user_id: str,
        github_user_id: Optional[str],
        github_username: Optional[str],
        installation_id: Optional[str],
        authorized_repos: List[str],
        access_token: Optional[str] = None,
        expires_at: Optional[str] = None,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        repos_json = json.dumps(authorized_repos)
        with self._get_connection() as conn:
            conn.execute(
                "INSERT INTO github_accounts (user_id, github_user_id, github_username, installation_id, authorized_repos, access_token, expires_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?) "
                "ON CONFLICT(user_id) DO UPDATE SET "
                "github_user_id = COALESCE(excluded.github_user_id, github_accounts.github_user_id), "
                "github_username = COALESCE(excluded.github_username, github_accounts.github_username), "
                "installation_id = COALESCE(excluded.installation_id, github_accounts.installation_id), "
                "authorized_repos = excluded.authorized_repos, "
                "access_token = COALESCE(excluded.access_token, github_accounts.access_token), "
                "expires_at = COALESCE(excluded.expires_at, github_accounts.expires_at), "
                "updated_at = excluded.updated_at",
                (user_id, github_user_id, github_username, installation_id, repos_json, access_token, expires_at, now),
            )

    def revoke_github_account(self, user_id: str) -> None:
        with self._get_connection() as conn:
            conn.execute("DELETE FROM github_accounts WHERE user_id = ?", (user_id,))

    def check_repo_access(self, user_id: str, repo_name: str) -> bool:
        """Verify whether a user is authorized to access a given repository."""
        account = self.get_github_account(user_id)
        if not account:
            # Check if user is demo user and repo is an allowed demo repo
            user = self.get_user_by_id(user_id)
            if user and user.get("is_demo"):
                return repo_name in ["demo-org/payment-service", "demo-org/user-service", "git_repo", "demo_project"]
            return False

        repos = account.get("authorized_repos", [])
        return repo_name in repos or any(r.lower() == repo_name.lower() for r in repos)

    # --- PR Analyses History ---
    def save_pr_analysis(
        self,
        analysis_id: str,
        user_id: str,
        repo_name: str,
        pr_number: int,
        pr_title: str,
        base_ref: str,
        head_ref: str,
        status: str,
        findings: List[Dict[str, Any]],
        metrics: Dict[str, Any],
        summary: Dict[str, Any],
        execution_time_ms: float,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            conn.execute(
                "INSERT INTO pr_analyses (id, user_id, repo_name, pr_number, pr_title, base_ref, head_ref, status, findings_json, metrics_json, summary_json, execution_time_ms, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET "
                "status = excluded.status, "
                "findings_json = excluded.findings_json, "
                "metrics_json = excluded.metrics_json, "
                "summary_json = excluded.summary_json, "
                "execution_time_ms = excluded.execution_time_ms",
                (
                    analysis_id,
                    user_id,
                    repo_name,
                    pr_number,
                    pr_title,
                    base_ref,
                    head_ref,
                    status,
                    json.dumps(findings),
                    json.dumps(metrics),
                    json.dumps(summary),
                    execution_time_ms,
                    now,
                ),
            )

    def get_pr_analysis(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM pr_analyses WHERE id = ?", (analysis_id,)).fetchone()
            if not row:
                return None
            data = dict(row)
            data["findings"] = json.loads(data["findings_json"])
            data["metrics"] = json.loads(data["metrics_json"])
            data["summary"] = json.loads(data["summary_json"])

            # Merge review status
            reviews = conn.execute(
                "SELECT finding_id, status, notes FROM finding_reviews WHERE analysis_id = ?",
                (analysis_id,),
            ).fetchall()
            review_map = {r["finding_id"]: dict(r) for r in reviews}
            for f in data["findings"]:
                fid = f.get("id")
                if fid in review_map:
                    f["review_status"] = review_map[fid]["status"]
                    f["review_notes"] = review_map[fid].get("notes")
                else:
                    f["review_status"] = "open"

            return data

    def list_analyses_for_user(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT id, repo_name, pr_number, pr_title, base_ref, head_ref, status, metrics_json, execution_time_ms, created_at "
                "FROM pr_analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
                (user_id, limit),
            ).fetchall()
            results = []
            for r in rows:
                d = dict(r)
                d["metrics"] = json.loads(d["metrics_json"])
                del d["metrics_json"]
                results.append(d)
            return results

    def update_finding_review(self, analysis_id: str, finding_id: str, status: str, notes: Optional[str] = None) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            conn.execute(
                "INSERT INTO finding_reviews (analysis_id, finding_id, status, notes, updated_at) "
                "VALUES (?, ?, ?, ?, ?) "
                "ON CONFLICT(analysis_id, finding_id) DO UPDATE SET "
                "status = excluded.status, "
                "notes = excluded.notes, "
                "updated_at = excluded.updated_at",
                (analysis_id, finding_id, status, notes, now),
            )


db = DatabaseManager()
