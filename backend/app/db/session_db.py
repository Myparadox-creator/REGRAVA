"""
Database storage for REGRAVA.
Uses SQLite for zero-configuration, production-grade local persistence of users,
sessions, authorized GitHub repositories, and PR analysis history.
"""

import json
import os
import sqlite3
import tempfile
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
from app.config import settings


class DatabaseManager:
    def __init__(self, db_path=None):
        self.db_path = str(db_path or settings.DATABASE_PATH)
        self._ensure_writable_db()
        self._init_tables()

    def _fallback_db_path(self) -> str:
        try:
            temp_db = Path(tempfile.gettempdir()) / "regrava.db"
            temp_db.parent.mkdir(parents=True, exist_ok=True)
            return str(temp_db)
        except Exception:
            return ":memory:"

    def _ensure_writable_db(self) -> None:
        try:
            if self.db_path != ":memory:":
                Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        except Exception:
            self.db_path = self._fallback_db_path()

    def _get_connection(self) -> sqlite3.Connection:
        try:
            conn = sqlite3.connect(self.db_path, timeout=10.0)
            conn.row_factory = sqlite3.Row
            return conn
        except (sqlite3.OperationalError, OSError, PermissionError):
            self.db_path = self._fallback_db_path()
            conn = sqlite3.connect(self.db_path, timeout=10.0)
            conn.row_factory = sqlite3.Row
            return conn

    def _init_tables(self) -> None:
        table_sql = """
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

            CREATE TABLE IF NOT EXISTS app_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS revoked_sessions (
                token TEXT PRIMARY KEY,
                revoked_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS github_installations (
                installation_id TEXT PRIMARY KEY,
                account_login TEXT,
                account_type TEXT,
                repositories_json TEXT NOT NULL DEFAULT '[]',
                repository_selection TEXT NOT NULL DEFAULT 'selected',
                suspended INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS repo_settings (
                repo_full_name TEXT PRIMARY KEY,
                repo_id TEXT,
                installation_id TEXT,
                auto_review_enabled INTEGER NOT NULL DEFAULT 0,
                confidence_threshold TEXT NOT NULL DEFAULT 'medium',
                updated_by TEXT,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS review_jobs (
                job_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                repo_full_name TEXT NOT NULL,
                repo_id TEXT,
                pr_number INTEGER NOT NULL,
                head_sha TEXT,
                state TEXT NOT NULL,
                steps_json TEXT NOT NULL DEFAULT '[]',
                analysis_id TEXT,
                review_record_id TEXT,
                error_message TEXT,
                dry_run INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS github_reviews (
                id TEXT PRIMARY KEY,
                repo_full_name TEXT NOT NULL,
                repo_id TEXT,
                pr_number INTEGER NOT NULL,
                head_sha TEXT NOT NULL,
                analyzer_version TEXT NOT NULL,
                dedup_key TEXT NOT NULL,
                analysis_id TEXT,
                github_review_id TEXT,
                github_review_url TEXT,
                summary_body TEXT NOT NULL,
                inline_comments_json TEXT NOT NULL DEFAULT '[]',
                published_fingerprints_json TEXT NOT NULL DEFAULT '[]',
                publication_status TEXT NOT NULL,
                error_detail TEXT,
                mode TEXT NOT NULL DEFAULT 'manual',
                triggered_by TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS finding_lifecycle (
                id TEXT PRIMARY KEY,
                finding_id TEXT NOT NULL,
                fingerprint TEXT NOT NULL,
                repo_full_name TEXT NOT NULL,
                repo_id TEXT,
                pr_number INTEGER NOT NULL,
                original_head_sha TEXT NOT NULL,
                current_head_sha TEXT NOT NULL,
                category TEXT NOT NULL,
                severity TEXT NOT NULL,
                confidence TEXT NOT NULL,
                title TEXT NOT NULL,
                file_path TEXT,
                line_number INTEGER,
                evidence_json TEXT NOT NULL DEFAULT '[]',
                published_review_id TEXT,
                published_comment_id TEXT,
                published_to_github INTEGER NOT NULL DEFAULT 0,
                previous_status TEXT,
                current_status TEXT NOT NULL DEFAULT 'Open',
                resolution_notes TEXT,
                verification_evidence TEXT,
                first_seen_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS webhook_deliveries (
                delivery_id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                repo_full_name TEXT,
                payload_summary TEXT,
                processed_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
            CREATE INDEX IF NOT EXISTS idx_analyses_user ON pr_analyses(user_id);
            CREATE INDEX IF NOT EXISTS idx_analyses_repo ON pr_analyses(repo_name);
            CREATE INDEX IF NOT EXISTS idx_reviews_repo_pr ON github_reviews(repo_full_name, pr_number);
            CREATE INDEX IF NOT EXISTS idx_reviews_dedup ON github_reviews(dedup_key);
            CREATE INDEX IF NOT EXISTS idx_lifecycle_repo_pr ON finding_lifecycle(repo_full_name, pr_number);
            CREATE INDEX IF NOT EXISTS idx_lifecycle_fp ON finding_lifecycle(repo_full_name, pr_number, fingerprint);
        """
        try:
            with self._get_connection() as conn:
                conn.executescript(table_sql)
        except Exception:
            self.db_path = self._fallback_db_path()
            with self._get_connection() as conn:
                conn.executescript(table_sql)

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
                "INSERT OR REPLACE INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
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
        if not token:
            return
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.execute("INSERT OR REPLACE INTO revoked_sessions (token, revoked_at) VALUES (?, ?)", (token, now))

    def is_token_revoked(self, token: str) -> bool:
        if not token:
            return True
        with self._get_connection() as conn:
            row = conn.execute("SELECT 1 FROM revoked_sessions WHERE token = ?", (token,)).fetchone()
            return row is not None

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
                "SELECT id, repo_name, pr_number, pr_title, base_ref, head_ref, status, metrics_json, summary_json, execution_time_ms, created_at "
                "FROM pr_analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
                (user_id, limit),
            ).fetchall()
            rev_rows = conn.execute(
                "SELECT analysis_id, head_sha, publication_status, github_review_url, github_review_id "
                "FROM github_reviews WHERE analysis_id IS NOT NULL ORDER BY created_at DESC"
            ).fetchall()
            rev_by_analysis = {}
            for rr in rev_rows:
                aid = rr["analysis_id"]
                if aid not in rev_by_analysis:
                    rev_by_analysis[aid] = dict(rr)

            results = []
            for r in rows:
                d = dict(r)
                d["metrics"] = json.loads(d["metrics_json"])
                summary = json.loads(d.get("summary_json") or "{}")
                del d["metrics_json"]
                if "summary_json" in d:
                    del d["summary_json"]
                rev_meta = rev_by_analysis.get(d["id"])
                d["head_sha"] = (rev_meta or {}).get("head_sha") or summary.get("head_sha")
                d["publication_status"] = (rev_meta or {}).get("publication_status") or "local_only"
                d["github_review_url"] = (rev_meta or {}).get("github_review_url")
                d["github_review_id"] = (rev_meta or {}).get("github_review_id")
                results.append(d)
            return results

    def list_full_analyses_for_user(self, user_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT id, repo_name, pr_number, pr_title, base_ref, head_ref, status, findings_json, metrics_json, summary_json, execution_time_ms, created_at "
                "FROM pr_analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
                (user_id, limit),
            ).fetchall()
            results = []
            for r in rows:
                d = dict(r)
                d["findings"] = json.loads(d["findings_json"])
                d["metrics"] = json.loads(d["metrics_json"])
                d["summary"] = json.loads(d["summary_json"])
                del d["findings_json"]
                del d["metrics_json"]
                del d["summary_json"]
                results.append(d)

            # Merge review status for all findings
            if results:
                reviews = conn.execute(
                    "SELECT analysis_id, finding_id, status, notes FROM finding_reviews"
                ).fetchall()
                review_map = {(r["analysis_id"], r["finding_id"]): dict(r) for r in reviews}
                for res in results:
                    for f in res.get("findings", []):
                        key = (res["id"], f.get("id"))
                        if key in review_map:
                            f["review_status"] = review_map[key]["status"]
                            f["review_notes"] = review_map[key].get("notes")
                        else:
                            f["review_status"] = "open"

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

    # --- Persistent Application Configuration (e.g. GitHub OAuth credentials) ---
    def get_config(self, key: str) -> Optional[str]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT value FROM app_config WHERE key = ?", (key,)).fetchone()
            return row["value"] if row else None

    def set_config(self, key: str, value: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            conn.execute(
                "INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                (key, value, now),
            )

    # --- GitHub App Installations ---
    def upsert_installation(
        self,
        installation_id: str,
        account_login: Optional[str] = None,
        account_type: Optional[str] = None,
        repositories: Optional[List[str]] = None,
        repository_selection: str = "selected",
        suspended: bool = False,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        repos_json = json.dumps(repositories or [])
        with self._get_connection() as conn:
            conn.execute(
                "INSERT INTO github_installations "
                "(installation_id, account_login, account_type, repositories_json, repository_selection, suspended, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?) "
                "ON CONFLICT(installation_id) DO UPDATE SET "
                "account_login = COALESCE(excluded.account_login, github_installations.account_login), "
                "account_type = COALESCE(excluded.account_type, github_installations.account_type), "
                "repositories_json = excluded.repositories_json, "
                "repository_selection = excluded.repository_selection, "
                "suspended = excluded.suspended, "
                "updated_at = excluded.updated_at",
                (str(installation_id), account_login, account_type, repos_json, repository_selection, 1 if suspended else 0, now, now),
            )

    def delete_installation(self, installation_id: str) -> None:
        with self._get_connection() as conn:
            conn.execute("DELETE FROM github_installations WHERE installation_id = ?", (str(installation_id),))

    def get_installation(self, installation_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM github_installations WHERE installation_id = ?", (str(installation_id),)
            ).fetchone()
            if not row:
                return None
            data = dict(row)
            data["repositories"] = json.loads(data.get("repositories_json") or "[]")
            data["suspended"] = bool(data.get("suspended", 0))
            return data

    def find_installation_for_repo(self, repo_full_name: str) -> Optional[Dict[str, Any]]:
        target = repo_full_name.lower()
        with self._get_connection() as conn:
            rows = conn.execute("SELECT * FROM github_installations WHERE suspended = 0").fetchall()
            for r in rows:
                data = dict(r)
                repos = json.loads(data.get("repositories_json") or "[]")
                if any(rep.lower() == target for rep in repos):
                    data["repositories"] = repos
                    data["suspended"] = bool(data.get("suspended", 0))
                    return data
        return None

    def update_installation_repos(
        self, installation_id: str, added: List[str], removed: List[str]
    ) -> None:
        inst = self.get_installation(installation_id)
        if not inst:
            self.upsert_installation(installation_id, repositories=added)
            return
        current = set(inst.get("repositories", []))
        current.update(added)
        removed_lower = {r.lower() for r in removed}
        updated = sorted(r for r in current if r.lower() not in removed_lower)
        self.upsert_installation(
            installation_id=installation_id,
            account_login=inst.get("account_login"),
            account_type=inst.get("account_type"),
            repositories=updated,
            repository_selection=inst.get("repository_selection", "selected"),
            suspended=inst.get("suspended", False),
        )

    # --- Per-Repository Review Settings ---
    def get_repo_settings(self, repo_full_name: str) -> Dict[str, Any]:
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM repo_settings WHERE LOWER(repo_full_name) = LOWER(?)", (repo_full_name,)
            ).fetchone()
            if not row:
                return {
                    "repo_full_name": repo_full_name,
                    "repo_id": None,
                    "installation_id": None,
                    "auto_review_enabled": False,
                    "confidence_threshold": settings.REVIEW_CONFIDENCE_THRESHOLD,
                    "updated_by": None,
                    "updated_at": None,
                }
            data = dict(row)
            data["auto_review_enabled"] = bool(data.get("auto_review_enabled", 0))
            return data

    def upsert_repo_settings(
        self,
        repo_full_name: str,
        auto_review_enabled: bool,
        confidence_threshold: str = "medium",
        repo_id: Optional[str] = None,
        installation_id: Optional[str] = None,
        updated_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            conn.execute(
                "INSERT INTO repo_settings "
                "(repo_full_name, repo_id, installation_id, auto_review_enabled, confidence_threshold, updated_by, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?) "
                "ON CONFLICT(repo_full_name) DO UPDATE SET "
                "repo_id = COALESCE(excluded.repo_id, repo_settings.repo_id), "
                "installation_id = COALESCE(excluded.installation_id, repo_settings.installation_id), "
                "auto_review_enabled = excluded.auto_review_enabled, "
                "confidence_threshold = excluded.confidence_threshold, "
                "updated_by = COALESCE(excluded.updated_by, repo_settings.updated_by), "
                "updated_at = excluded.updated_at",
                (repo_full_name, repo_id, installation_id, 1 if auto_review_enabled else 0, confidence_threshold, updated_by, now),
            )
        return self.get_repo_settings(repo_full_name)

    # --- Asynchronous Review Jobs ---
    def create_review_job(
        self,
        job_id: str,
        user_id: str,
        repo_full_name: str,
        pr_number: int,
        state: str = "in_progress",
        head_sha: Optional[str] = None,
        repo_id: Optional[str] = None,
        dry_run: bool = False,
        steps: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            conn.execute(
                "INSERT INTO review_jobs "
                "(job_id, user_id, repo_full_name, repo_id, pr_number, head_sha, state, steps_json, dry_run, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (job_id, user_id, repo_full_name, repo_id, pr_number, head_sha, state, json.dumps(steps or []), 1 if dry_run else 0, now, now),
            )
        return self.get_review_job(job_id)

    def update_review_job(
        self,
        job_id: str,
        state: Optional[str] = None,
        head_sha: Optional[str] = None,
        repo_id: Optional[str] = None,
        steps: Optional[List[Dict[str, Any]]] = None,
        analysis_id: Optional[str] = None,
        review_record_id: Optional[str] = None,
        error_message: Optional[str] = None,
        dry_run: Optional[bool] = None,
    ) -> Optional[Dict[str, Any]]:
        existing = self.get_review_job(job_id)
        if not existing:
            return None
        now = datetime.now(timezone.utc).isoformat()
        new_state = state if state is not None else existing["state"]
        new_head = head_sha if head_sha is not None else existing.get("head_sha")
        new_repo_id = repo_id if repo_id is not None else existing.get("repo_id")
        new_steps = steps if steps is not None else existing.get("steps", [])
        new_analysis_id = analysis_id if analysis_id is not None else existing.get("analysis_id")
        new_review_id = review_record_id if review_record_id is not None else existing.get("review_record_id")
        new_err = error_message if error_message is not None else existing.get("error_message")
        new_dry = (1 if dry_run else 0) if dry_run is not None else (1 if existing.get("dry_run") else 0)
        with self._get_connection() as conn:
            conn.execute(
                "UPDATE review_jobs SET state = ?, head_sha = ?, repo_id = ?, steps_json = ?, "
                "analysis_id = ?, review_record_id = ?, error_message = ?, dry_run = ?, updated_at = ? "
                "WHERE job_id = ?",
                (new_state, new_head, new_repo_id, json.dumps(new_steps), new_analysis_id, new_review_id, new_err, new_dry, now, job_id),
            )
        return self.get_review_job(job_id)

    def get_review_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM review_jobs WHERE job_id = ?", (job_id,)).fetchone()
            if not row:
                return None
            d = dict(row)
            d["steps"] = json.loads(d.pop("steps_json", "[]") or "[]")
            d["dry_run"] = bool(d.get("dry_run", 0))
            return d

    def get_latest_review_job(self, repo_full_name: str, pr_number: int) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM review_jobs WHERE LOWER(repo_full_name) = LOWER(?) AND pr_number = ? "
                "ORDER BY created_at DESC LIMIT 1",
                (repo_full_name, pr_number),
            ).fetchone()
            if not row:
                return None
            d = dict(row)
            d["steps"] = json.loads(d.pop("steps_json", "[]") or "[]")
            d["dry_run"] = bool(d.get("dry_run", 0))
            return d

    # --- Published GitHub Reviews & Deduplication ---
    def save_github_review(
        self,
        review_record_id: str,
        repo_full_name: str,
        pr_number: int,
        head_sha: str,
        analyzer_version: str,
        dedup_key: str,
        summary_body: str,
        inline_comments: List[Dict[str, Any]],
        published_fingerprints: List[str],
        publication_status: str,
        repo_id: Optional[str] = None,
        analysis_id: Optional[str] = None,
        github_review_id: Optional[str] = None,
        github_review_url: Optional[str] = None,
        error_detail: Optional[str] = None,
        mode: str = "manual",
        triggered_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            conn.execute(
                "INSERT INTO github_reviews "
                "(id, repo_full_name, repo_id, pr_number, head_sha, analyzer_version, dedup_key, analysis_id, "
                "github_review_id, github_review_url, summary_body, inline_comments_json, published_fingerprints_json, "
                "publication_status, error_detail, mode, triggered_by, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET "
                "github_review_id = COALESCE(excluded.github_review_id, github_reviews.github_review_id), "
                "github_review_url = COALESCE(excluded.github_review_url, github_reviews.github_review_url), "
                "summary_body = excluded.summary_body, "
                "inline_comments_json = excluded.inline_comments_json, "
                "published_fingerprints_json = excluded.published_fingerprints_json, "
                "publication_status = excluded.publication_status, "
                "error_detail = excluded.error_detail, "
                "updated_at = excluded.updated_at",
                (
                    review_record_id,
                    repo_full_name,
                    repo_id,
                    pr_number,
                    head_sha,
                    analyzer_version,
                    dedup_key,
                    analysis_id,
                    github_review_id,
                    github_review_url,
                    summary_body,
                    json.dumps(inline_comments),
                    json.dumps(published_fingerprints),
                    publication_status,
                    error_detail,
                    mode,
                    triggered_by,
                    now,
                    now,
                ),
            )
        return self.get_github_review(review_record_id)

    def _hydrate_review(self, row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        d["inline_comments"] = json.loads(d.pop("inline_comments_json", "[]") or "[]")
        d["published_fingerprints"] = json.loads(d.pop("published_fingerprints_json", "[]") or "[]")
        return d

    def get_github_review(self, review_record_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM github_reviews WHERE id = ?", (review_record_id,)).fetchone()
            return self._hydrate_review(row) if row else None

    def find_published_reviews_for_pr(
        self, repo_full_name: str, pr_number: int, head_sha: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            if head_sha:
                rows = conn.execute(
                    "SELECT * FROM github_reviews WHERE LOWER(repo_full_name) = LOWER(?) AND pr_number = ? AND head_sha = ? "
                    "ORDER BY created_at DESC",
                    (repo_full_name, pr_number, head_sha),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM github_reviews WHERE LOWER(repo_full_name) = LOWER(?) AND pr_number = ? "
                    "ORDER BY created_at DESC",
                    (repo_full_name, pr_number),
                ).fetchall()
            return [self._hydrate_review(r) for r in rows]

    def list_github_reviews(
        self, repo_full_name: Optional[str] = None, pr_number: Optional[int] = None, limit: int = 50
    ) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            if repo_full_name and pr_number is not None:
                rows = conn.execute(
                    "SELECT * FROM github_reviews WHERE LOWER(repo_full_name) = LOWER(?) AND pr_number = ? "
                    "ORDER BY created_at DESC LIMIT ?",
                    (repo_full_name, pr_number, limit),
                ).fetchall()
            elif repo_full_name:
                rows = conn.execute(
                    "SELECT * FROM github_reviews WHERE LOWER(repo_full_name) = LOWER(?) "
                    "ORDER BY created_at DESC LIMIT ?",
                    (repo_full_name, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM github_reviews ORDER BY created_at DESC LIMIT ?", (limit,)
                ).fetchall()
            return [self._hydrate_review(r) for r in rows]

    # --- Finding Lifecycle Tracking Across Commits ---
    def upsert_finding_lifecycle(self, record: Dict[str, Any]) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            conn.execute(
                "INSERT INTO finding_lifecycle "
                "(id, finding_id, fingerprint, repo_full_name, repo_id, pr_number, original_head_sha, current_head_sha, "
                "category, severity, confidence, title, file_path, line_number, evidence_json, "
                "published_review_id, published_comment_id, published_to_github, previous_status, current_status, "
                "resolution_notes, verification_evidence, first_seen_at, last_seen_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET "
                "current_head_sha = excluded.current_head_sha, "
                "line_number = COALESCE(excluded.line_number, finding_lifecycle.line_number), "
                "evidence_json = excluded.evidence_json, "
                "published_review_id = COALESCE(excluded.published_review_id, finding_lifecycle.published_review_id), "
                "published_comment_id = COALESCE(excluded.published_comment_id, finding_lifecycle.published_comment_id), "
                "published_to_github = MAX(finding_lifecycle.published_to_github, excluded.published_to_github), "
                "previous_status = excluded.previous_status, "
                "current_status = excluded.current_status, "
                "resolution_notes = COALESCE(excluded.resolution_notes, finding_lifecycle.resolution_notes), "
                "verification_evidence = COALESCE(excluded.verification_evidence, finding_lifecycle.verification_evidence), "
                "last_seen_at = excluded.last_seen_at, "
                "updated_at = excluded.updated_at",
                (
                    record["id"],
                    record["finding_id"],
                    record["fingerprint"],
                    record["repo_full_name"],
                    record.get("repo_id"),
                    record["pr_number"],
                    record["original_head_sha"],
                    record["current_head_sha"],
                    record["category"],
                    record["severity"],
                    record["confidence"],
                    record["title"],
                    record.get("file_path"),
                    record.get("line_number"),
                    json.dumps(record.get("evidence", [])),
                    record.get("published_review_id"),
                    record.get("published_comment_id"),
                    1 if record.get("published_to_github") else 0,
                    record.get("previous_status"),
                    record.get("current_status", "Open"),
                    record.get("resolution_notes"),
                    record.get("verification_evidence"),
                    record.get("first_seen_at", now),
                    record.get("last_seen_at", now),
                    now,
                ),
            )
        return self.get_finding_lifecycle_by_id(record["id"])

    def _hydrate_lifecycle(self, row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        d["evidence"] = json.loads(d.pop("evidence_json", "[]") or "[]")
        d["published_to_github"] = bool(d.get("published_to_github", 0))
        return d

    def get_finding_lifecycle_by_id(self, record_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM finding_lifecycle WHERE id = ?", (record_id,)).fetchone()
            return self._hydrate_lifecycle(row) if row else None

    def list_finding_lifecycle_for_pr(self, repo_full_name: str, pr_number: int) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM finding_lifecycle WHERE LOWER(repo_full_name) = LOWER(?) AND pr_number = ? "
                "ORDER BY last_seen_at DESC",
                (repo_full_name, pr_number),
            ).fetchall()
            return [self._hydrate_lifecycle(r) for r in rows]

    def update_finding_lifecycle_status(
        self,
        record_id: str,
        new_status: str,
        notes: Optional[str] = None,
        verification_evidence: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        existing = self.get_finding_lifecycle_by_id(record_id)
        if not existing:
            return None
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            conn.execute(
                "UPDATE finding_lifecycle SET previous_status = current_status, current_status = ?, "
                "resolution_notes = COALESCE(?, resolution_notes), "
                "verification_evidence = COALESCE(?, verification_evidence), updated_at = ? WHERE id = ?",
                (new_status, notes, verification_evidence, now, record_id),
            )
        return self.get_finding_lifecycle_by_id(record_id)

    # --- Webhook Idempotency Tracking ---
    def record_webhook_delivery(
        self, delivery_id: str, event_type: str, repo_full_name: Optional[str] = None, summary: Optional[str] = None
    ) -> bool:
        """
        Atomically record a webhook delivery ID.
        Returns True if this is a NEW delivery, False if it was ALREADY processed (duplicate).
        """
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            try:
                conn.execute(
                    "INSERT INTO webhook_deliveries (delivery_id, event_type, repo_full_name, payload_summary, processed_at) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (delivery_id, event_type, repo_full_name, summary, now),
                )
                return True
            except sqlite3.IntegrityError:
                return False


db = DatabaseManager()
