"""
Unit tests for REGRAVA SecurityAnalyzer.
Validates detection and evidence generation for:
- Secrets & Credentials (with redaction verification)
- SQL Injection & Command Injection
- XSS & Dynamic Execution
- Missing Resource Ownership checks
- Path Traversal & SSRF
- Insecure CORS policies
"""

from app.analyzer.security_analyzer import SecurityAnalyzer
from app.models.finding import FindingCategory, Severity


def test_secret_scanning_and_redaction():
    analyzer = SecurityAnalyzer()
    code = """
AWS_SECRET = "AKIA1234567890ABCDEF"
GITHUB_TOKEN = "ghp_1234567890abcdefghijklmnopqrstuvwx"
STRIPE_KEY = "sk-live-1234567890abcdef1234567890abcdef"
"""
    findings = analyzer.analyze_file("backend/config.py", code)
    assert len(findings) >= 3

    categories = [f.category for f in findings]
    assert all(c == FindingCategory.SECRETS for c in categories)

    # Check secret redaction - full secret should never appear in evidence or symbol
    for f in findings:
        assert f.severity == Severity.HIGH
        assert "AKIA1234567890ABCDEF" not in f.changed_file.symbol
        assert "ghp_1234567890abcdefghijklmnopqrstuvwx" not in f.changed_file.symbol
        assert "****" in f.changed_file.symbol


def test_sql_injection_detection():
    analyzer = SecurityAnalyzer()
    code = """
def get_user(cursor, user_id):
    query = f"SELECT * FROM users WHERE id = '{user_id}'"
    cursor.execute(query)
"""
    findings = analyzer.analyze_file("backend/db.py", code)
    sqli = [f for f in findings if f.category == FindingCategory.INJECTION and "SQL" in f.title]
    assert len(sqli) == 1
    assert sqli[0].severity == Severity.HIGH
    assert sqli[0].changed_file.line == 3
    assert "f-string" in sqli[0].evidence[0] or "interpolation" in sqli[0].evidence[0]


def test_command_injection_detection():
    analyzer = SecurityAnalyzer()
    code = """
import subprocess

def run_backup(path):
    subprocess.run(f"tar -czf backup.tar.gz {path}", shell=True)
"""
    findings = analyzer.analyze_file("backend/tasks.py", code)
    cmd = [f for f in findings if f.category == FindingCategory.INJECTION and "Command" in f.title]
    assert len(cmd) == 1
    assert cmd[0].severity == Severity.HIGH
    assert cmd[0].changed_file.line == 5


def test_xss_detection():
    analyzer = SecurityAnalyzer()
    code = """
import React from 'react';

export const CommentView = ({ htmlContent }: { htmlContent: string }) => {
  return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};
"""
    findings = analyzer.analyze_file("frontend/src/CommentView.tsx", code)
    xss = [f for f in findings if f.category == FindingCategory.INJECTION and "Cross-Site Scripting" in f.title]
    assert len(xss) == 1
    assert xss[0].severity == Severity.HIGH


def test_missing_resource_ownership_check():
    analyzer = SecurityAnalyzer()
    code = """
from fastapi import FastAPI
app = FastAPI()

@app.get("/api/users/{user_id}/profile")
def get_profile(user_id: int):
    # Missing ownership validation
    return {"profile_id": user_id, "email": "test@example.com"}
"""
    findings = analyzer.analyze_file("backend/routes.py", code)
    auth_findings = [f for f in findings if f.category == FindingCategory.AUTHENTICATION]
    assert len(auth_findings) == 1
    assert "user_id" in auth_findings[0].title
    assert auth_findings[0].severity == Severity.HIGH


def test_path_traversal_detection():
    analyzer = SecurityAnalyzer()
    code = """
def get_file(filename: str):
    with open(f"/app/uploads/{filename}", "r") as f:
        return f.read()
"""
    findings = analyzer.analyze_file("backend/files.py", code)
    traversal = [f for f in findings if f.category == FindingCategory.INPUT_VALIDATION and "Path Traversal" in f.title]
    assert len(traversal) == 1
    assert traversal[0].severity == Severity.HIGH


def test_ssrf_detection():
    analyzer = SecurityAnalyzer()
    code = """
import httpx

async def fetch_remote(user_url: str):
    async with httpx.AsyncClient() as client:
        return await client.get(user_url)
"""
    findings = analyzer.analyze_file("backend/proxy.py", code)
    ssrf = [f for f in findings if f.category == FindingCategory.INPUT_VALIDATION and "SSRF" in f.title]
    assert len(ssrf) == 1


def test_insecure_cors_detection():
    analyzer = SecurityAnalyzer()
    code = """
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
)
"""
    findings = analyzer.analyze_file("backend/main.py", code)
    cors = [f for f in findings if f.category == FindingCategory.CONFIGURATION and "CORS" in f.title]
    assert len(cors) == 1
    assert cors[0].severity == Severity.HIGH
