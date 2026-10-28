# REGRAVA

> **Catch what your diff could break.**
> *Deterministic Pull-Request Security and API Regression Analysis for Full-Stack Applications*

[![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.14-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-3178c6.svg)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6.4-646CFF.svg)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 1. Product Vision

**REGRAVA** is an evidence-based developer reliability and security platform that inspects repository changes before they are merged into production.

Modern pull requests frequently introduce two distinct classes of defects that escape linters and static unit tests:
1. **Security Vulnerabilities:** Hardcoded API secrets, unparameterized SQL queries, unvalidated user redirects/SSRF, path traversal in file handlers, and insecure wildcard CORS policies.
2. **Contract Regressions:** Breaking schema changes in backend endpoints (such as renaming or deleting a Pydantic model field like `user_id` &rarr; `id`) that silently break frontend React/TSX consumers expecting the previous payload shape.

REGRAVA combines deterministic AST parsing, git diff inspection, credential scanning with automated redaction, and TypeScript cross-file reference tracking into an actionable, beautiful developer dashboard.

---

## 2. Core Security & Regression Inspection Categories

REGRAVA evaluates diffs across seven deterministic categories:

| Category | Description | Primary Engine |
| :--- | :--- | :--- |
| **Category A: Secrets & Credentials** | Detects API keys, AWS tokens, Stripe live keys, GitHub PATs, private keys. Automatic redaction prevents credential leaking in reports. | High-entropy Regex & Prefix Matching |
| **Category B: Injection** | Identifies SQL queries built via string concatenation/f-strings, OS command execution without arguments list, and unsafe DOM insertion (`dangerouslySetInnerHTML`). | Python AST Call / JoinedStr & TSX AST |
| **Category C: Authentication & Authorization** | Detects database updates/deletes lacking user tenancy/ownership filtering (IDOR vulnerabilities). | AST Query Inspection |
| **Category D: Input Validation & File Access** | Identifies directory traversal in `open()` / `os.path.join()` without sandboxing, and SSRF in outgoing HTTP clients (`httpx`, `requests`). | AST Call & Variable Origin Tracing |
| **Category E: Security Configuration** | Detects insecure CORS (`allow_origins=["*"]` combined with `allow_credentials=True`), and dangerous GitHub Actions triggers (`pull_request_target`). | YAML & Python AST Config Parsers |
| **Category F: Dependency Security** | Identifies pinned dependencies matching known vulnerable version specifications. | Direct Version Constraint Matching |
| **Category G: API Contract & Regression** | Compares base and head Pydantic models in FastAPI endpoints and traces references in React/TSX components to highlight breaking contract deltas. | Python AST + TypeScript Compiler API |

---

## 3. Architecture & Privacy Guarantees

```
┌────────────────────────────────────────────────────────┐
│                   REGRAVA Dashboard                    │
│   (React + TypeScript + Vite + Tailwind CSS + Lucide)   │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP API + Secure Cookies
┌───────────────────────────▼────────────────────────────┐
│                    FastAPI Backend                     │
│               (backend/app/main.py)                    │
│                                                        │
│  ┌──────────────────┐  ┌─────────────────────────────┐ │
│  │   Auth Service   │  │    GitHub App Integration   │ │
│  │ Google / GitHub  │  │  Fine-grained Installation  │ │
│  │ HMAC Session DB  │  │  Read-Only PR Diff Ingest   │ │
│  └──────────────────┘  └─────────────────────────────┘ │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │          Deterministic Analysis Engine           │  │
│  │  - Security Analyzer (7 Categories)              │  │
│  │  - Contract Comparator (Base vs Head AST)        │  │
│  │  - TS Frontend Scanner (AST Compiler API)       │  │
│  │  - Test Evidence Matcher (pytest / Vitest)       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │           SQLite Persistence (regrava.db)        │  │
│  │   Users, Authorized Repos, PR Analyses, Reviews  │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Zero-Retention Guarantee
- **Never Executes Analyzed Code:** Target source code is parsed exclusively as abstract syntax trees; it is never imported, compiled, or executed.
- **In-Memory & Ephemeral:** Source diffs are analyzed in-memory. Code is never stored permanently or uploaded to 3rd-party LLM training pools.
- **Fine-Grained Permissions:** Integrates via GitHub App with read-only access to select repositories. No personal access tokens (PATs) with account-wide scope are requested.

---

## 4. Quick Start

### Prerequisites
- Python 3.10+ (tested through Python 3.14)
- Node.js 18+ and npm
- Git

### 1. Backend Setup
```bash
# Clone the repository
cd backend

# Create and activate virtual environment
python -m venv ../.venv
# On Windows:
..\.venv\Scripts\activate
# On Linux/macOS:
source ../.venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run backend test suite
pytest -v

# Start FastAPI backend server (Port 8000)
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Run frontend tests
npm test -- --run

# Build production assets
npm run build

# Start development server (Port 5173 with proxy to 8000)
npm run dev
```

### 3. Open Application
Navigate to `http://localhost:5173` (or `http://localhost:8000` for API documentation at `/docs`).

Click **"Explore Demo Sandbox (1-Click)"** to instantly enter the platform without entering any external API keys or credentials.

---

## 5. Developer Dashboard Experience

The dashboard answers four key questions immediately:
1. **Which repositories are connected?** View authorized repositories (e.g. `demo-org/payment-service`) with sync status and PR counts.
2. **Which pull requests need attention?** Active list of open PRs with real-time risk indicators (e.g. PR #42 with 4 changed files).
3. **What security findings have been identified?** Triage view categorized by severity (High, Medium, Low) and category (Secrets, Injection, Input Validation, Contract Regressions).
4. **What should the developer do next?** Direct remediation steps (e.g., rotate credentials, use parameterized SQL, update TSX frontend consumer).

### Finding Triage & Review Status
Developers can inspect individual findings in the **Finding Detail Modal** to view:
- Plain-language summary
- Exact file path and line number
- Attack scenario & exploitation mechanics
- Step-by-step remediation guidance
- Expandable AST evidence & conditions
- **Triage Actions:** Mark as **Reviewed** or **Dismissed** with review notes.

---

## 6. Running Tests

### Backend Test Suite (38 Tests Passing)
```bash
cd backend
python -m pytest -v
```
Test categories include:
- `test_api_endpoints.py`: Health checks, demo scenarios, repository lists.
- `test_auth_and_sessions.py`: HMAC state verification, session persistence, protected endpoints.
- `test_security_analyzer.py`: Secret scanning/redaction, SQLi, command injection, XSS, IDOR, path traversal, SSRF, CORS.
- `test_pr_analysis.py`: End-to-end pull request analysis workflow.
- `test_contract_comparator.py`: Pydantic model delta detection.
- `test_python_parser.py`: Python AST extraction.
- `test_typescript_parser.py`: TS/TSX client property access detection.
- `test_git_reader.py`: Git branch diffing and path traversal safeguards.

### Frontend Test Suite
```bash
cd frontend
npm test -- --run
```

---

## 7. License

MIT License. See [LICENSE](LICENSE) for details.
