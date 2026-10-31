<div align="center">

# 🛡️ REGRAVA

### **Catch what your diff could break.**
*Deterministic Pull-Request Security, Injection Vulnerability & API Contract Regression Intelligence*

<br/>

[![GitHub Repository](https://img.shields.io/badge/GitHub-REGRAVA-00f2fe?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Myparadox-creator/REGRAVA)
[![Live PR Demo](https://img.shields.io/badge/Live%20PR%20Demo-PR%20%231%20Verified-00c853?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/Myparadox-creator/REGRAVA/pull/1)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18.3-61dafb?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

<br/>

**[⚡ Quickstart](#-quickstart)** • **[🎯 The Problem We Solve](#-the-problem-we-solve)** • **[🛡️ 7-Layer Security Engine](#️-7-layer-security-engine)** • **[🐙 GitHub Integration](#-live-github-integration--dual-auth)** • **[🏗️ Architecture](#️-architecture--data-flow)** • **[🖥️ Dashboard Tour](#️-developer-dashboard-tour)** • **[🔒 Zero-Retention Guarantee](#-zero-retention--privacy-manifesto)**

<br/>

---

</div>

<br/>

## 🌟 Executive Summary

> [!IMPORTANT]
> **REGRAVA is NOT an AI chatbot that hallucinates code reviews.**  
> It is an **evidence-based, deterministic static analysis platform** that inspects Git pull requests to detect **hard security flaws** (secrets, SQLi, command injection, path traversal, SSRF, XSS) and **breaking API contract regressions** before code is merged into production.

Pull requests frequently introduce two distinct classes of silent bugs:
1. **Security Vulnerabilities:** Hardcoded API keys and tokens, unparameterized SQL queries, directory traversal in file handlers, unvalidated SSRF in HTTP clients, and wildcard CORS policies.
2. **Contract Regressions:** Breaking backend schema changes (such as renaming or deleting a Pydantic model field like `payment_token` &rarr; `checkout_id`) that cause frontend React/TSX consumers to receive `undefined` at runtime.

REGRAVA uses **abstract syntax tree (AST) parsing, Git diff analysis, automated secret redaction, and TypeScript cross-file reference tracking** to pinpoint vulnerabilities with mathematical certainty.

<br/>

---

## 🎯 The Problem We Solve

### Scenario A: The Silent API Contract Regression
Consider a FastAPI backend returning a payment model:

```python
# 🔴 BASE REVISION (services/payments/models.py)
class PaymentResponse(BaseModel):
    payment_id: int
    amount: float
    payment_token: str   # Expected by frontend client
```

A React component reads the response:
```tsx
// 🟡 FRONTEND CONSUMER (services/payments/PaymentView.tsx)
const token = payment.payment_token;  // Component relies on payment_token
```

Later, a developer optimizes the response model in a pull request:
```python
# 🔴 HEAD REVISION (services/payments/models.py)
class PaymentResponse(BaseModel):
    payment_id: int
    amount: float
    checkout_id: str     # ⚠️ Renamed payment_token -> checkout_id
```

```
┌────────────────────────────────────────────────────────────────────────┐
│                        REGRAVA DETECTIONS                              │
├────────────────────────────────────────────────────────────────────────┤
│ ❌ [HIGH REGRESSION] Frontend references removed field: payment_token  │
│    Changed File : services/payments/models.py:8                        │
│    Affected File: services/payments/PaymentView.tsx:25                 │
│    Consumer Call: payment.payment_token                                │
│    Test Evidence: ⚠️ No test assertions found for PaymentResponse       │
│    Remediation  : Update TSX consumer or alias field in Pydantic       │
└────────────────────────────────────────────────────────────────────────┘
```
**Result:** The backend responds with HTTP 200 OK, but the frontend silently renders blank or crashes with `TypeError: Cannot read properties of undefined`. **REGRAVA catches this before merge.**

---

### Scenario B: Hardcoded Secret & SQL Injection in PR Diff
A developer writes a quick database lookup:

```python
# ⚠️ Pull Request Diff: services/payments/routes.py
STRIPE_SECRET_KEY = "sk-live-mock-api-key-99999999999999999999"  # High entropy secret!

@app.get("/api/payments/{payment_id}")
def get_payment(payment_id: int):
    # Unparameterized string formatting
    query = f"SELECT * FROM transactions WHERE payment_id = '{payment_id}'"
    cursor.execute(query)  # SQL Injection!
```

```
┌────────────────────────────────────────────────────────────────────────┐
│                        REGRAVA FINDINGS                                │
├────────────────────────────────────────────────────────────────────────┤
│ 🚨 [CRITICAL SECRETS] Hardcoded OpenAI / Anthropic / Stripe API Key     │
│    Redacted Value : sk-live-mock-*********************9999             │
│    Remediation    : Rotate secret immediately; load via os.environ     │
│                                                                        │
│ 🚨 [HIGH INJECTION] SQL Injection via Dynamic String Formatting        │
│    Vulnerable Call: SELECT * FROM transactions WHERE ... '{payment_id}'│
│    Attack Vector  : Tainted parameter concatenated into query string    │
│    Remediation    : Use parameterized queries: cursor.execute(..., (?))│
└────────────────────────────────────────────────────────────────────────┘
```

---

### Scenario C: Live Verified Benchmark in This Repository

We maintain a live pull request in this repository to verify REGRAVA's real-world detection capabilities:

👉 **[Inspect Live Pull Request #1 on GitHub](https://github.com/Myparadox-creator/REGRAVA/pull/1)**

REGRAVA analyzes the live GitHub diff across `services/payments/` and flags:
* 🚨 **XSS**: React `dangerouslySetInnerHTML` rendering unescaped user input
* 🚨 **Secret Exposure**: Hardcoded mock secret key in `routes.py`
* 🚨 **SQL Injection**: Formatted SQL query string in `routes.py`
* 🚨 **Contract Regression**: Frontend accessing removed field `payment_token`
* ℹ️ **Schema Addition**: Non-breaking field `checkout_id` added to `PaymentResponse`

<br/>

---

## 🛡️ 7-Layer Security Engine

REGRAVA evaluates diffs deterministically across seven specialized security and regression layers:

| Layer | Category | What REGRAVA Detects | Primary Technique | Redaction |
| :---: | :--- | :--- | :--- | :---: |
| **01** | `SECRETS` | AWS tokens, Stripe keys, GitHub PATs, private keys, high-entropy tokens | Regex + Entropy Heuristics | **Automatic** |
| **02** | `INJECTION` | SQLi via f-strings/concatenation, command injection (`shell=True`), XSS via `dangerouslySetInnerHTML` | AST Call & JoinedStr Visitor | &mdash; |
| **03** | `AUTH & IDOR` | Missing tenancy/user-ownership filters in database updates or deletes | AST Where-Clause Inspection | &mdash; |
| **04** | `INPUT & PATH` | Path traversal in `open()` / `os.path.join()`, and unvalidated SSRF in `httpx`/`requests` | Variable Origin & Path Confinement | &mdash; |
| **05** | `CONFIG` | Dangerous CORS (`allow_origins=["*"]` + `credentials=True`), risky GHA workflows (`pull_request_target`) | AST Middleware + YAML Parser | &mdash; |
| **06** | `DEPENDENCIES`| Pinned package versions with known vulnerabilities and CVE alerts | Semantic Constraint Matching | &mdash; |
| **07** | `API CONTRACT`| Removed schema fields, altered types, deleted routes, and unhandled frontend consumers | Python AST + TS Compiler API | &mdash; |

<br/>

---

## 🐙 Live GitHub Integration & Dual-Auth

REGRAVA connects seamlessly to real GitHub accounts and repositories via two native authentication modes:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       REGRAVA GITHUB AUTHENTICATION                          │
├──────────────────────────────────────┬───────────────────────────────────────┤
│  ⚡ METHOD 1: PERSONAL ACCESS TOKEN   │  🌐 METHOD 2: GITHUB OAUTH / APP      │
│  • Instant 30-second setup           │  • Full web browser redirect login    │
│  • Paste token directly in UI        │  • GET /api/auth/github/callback      │
│  • No OAuth App registration needed  │  • Automatic secure HTTP-only cookies │
│  • Scopes: repo, read:user           │  • Enterprise SSO / Organization-wide │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

### 1. Instant Personal Access Token (PAT)
* Click **"Or Sign In with GitHub Token"** on the login screen or in **Settings**.
* Use the embedded 1-click generator: [Generate Pre-scoped Token on GitHub](https://github.com/settings/tokens/new?scopes=repo,read:user,user:email&description=REGRAVA%20Security%20Scanner).
* REGRAVA validates the token against `api.github.com/user` and synchronizes all authorized public and private repositories.
* You can also set `GITHUB_TOKEN=ghp_...` in `.env` for zero-click persistent authentication.

### 2. Multi-Commit Base vs Head Diffing
When scanning real pull requests, REGRAVA uses the GitHub Contents API to fetch:
* Exact **`base_content`** via `https://api.github.com/repos/{repo}/contents/{path}?ref={base_sha}` with `Accept: application/vnd.github.v3.raw`.
* Exact **`head_content`** via `https://api.github.com/repos/{repo}/contents/{path}?ref={head_sha}` with `Accept: application/vnd.github.v3.raw`.

This guarantees that multi-commit branches and PRs targeting `main` are compared against their true ancestor commit without base64 corruption.

<br/>

---

## 🏗️ Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Client ["🖥️ REGRAVA Frontend (React 18 + Vite)"]
        UI[Overview & PR Dashboard]
        Modal[Finding Detail & Triage Modal]
        AuthUI[PAT & OAuth Login Flow]
    end

    subgraph Backend ["⚙️ REGRAVA Backend (FastAPI + Python 3.10+)"]
        API[FastAPI Endpoints]
        AuthService[Auth & Token Service]
        GHService[GitHub Contents & PR Service]
        
        subgraph Engine ["Deterministic Analysis Pipeline"]
            SecScan[SecurityAnalyzer\n7 Categories]
            Contract[ContractComparator\nBase vs Head AST]
            TSParser[TypeScriptParser\nCompiler AST API]
            TestMatcher[TestEvidenceMatcher\npytest + Vitest]
        end
        
        DB[(SQLite Persistence\nregrava.db)]
    end

    subgraph GitHub ["🐙 GitHub Cloud"]
        GH_API[GitHub REST API\n/pulls & /contents]
    end

    UI -->|REST + HttpOnly Cookies| API
    API --> AuthService
    API --> GHService
    GHService -->|Live Base/Head Fetch| GH_API
    API --> Engine
    Engine --> DB
    Modal -->|PATCH Review Status| API
```

<br/>

---

## 🖥️ Developer Dashboard Tour

The REGRAVA dashboard is organized around **four immediate questions**:

```
┌───────────────────────────────────┬───────────────────────────────────┐
│ 1. CONNECTED REPOSITORIES         │ 2. PULL REQUESTS NEEDING ATTENTION│
│ • Myparadox-creator/REGRAVA       │ • PR #1: Upgrade payment flow     │
│ • demo-org/payment-service (Demo) │ • 3 Files changed (+18 / -10)     │
│ [ Manage GitHub Permissions ]     │ [ Inspect Diff & Run Scan ]       │
├───────────────────────────────────┼───────────────────────────────────┤
│ 3. SECURITY & CONTRACT FINDINGS   │ 4. ACTIONABLE REMEDIATION STEPS   │
│ 🚨 3 High Security   🟡 1 Medium  │ ⚠️ Rotate exposed Stripe key      │
│ 🔷 1 Contract Delta  ⚪ 1 Info    │ ⚠️ Use parameterized SQL query     │
│ [ Explore Findings Explorer ]     │ ⚠️ Update PaymentView.tsx         │
└───────────────────────────────────┴───────────────────────────────────┘
```

### Finding Detail & Triage Modal
Clicking any finding opens the comprehensive inspection view:
- **Plain-language summary** upfront for fast triage.
- **Source code reference** with exact line numbers and affected symbols.
- **Attack scenario & exploitation mechanics** explaining how an attacker could exploit the vulnerability.
- **Step-by-step remediation guide** with secure code patterns.
- **Technical AST evidence drawer** showing AST node names, parent calls, and conditions.
- **Triage Actions:** One-click **"Mark as Reviewed"** or **"Dismiss"** with persistent reviewer audit notes.

<br/>

---

## 🚀 Quickstart

### Prerequisites
- **Python 3.10+** (Tested on Python 3.10, 3.11, 3.12, 3.14)
- **Node.js 18+** & npm
- **Git**

```bash
# 1. Clone the repository
git clone https://github.com/Myparadox-creator/REGRAVA.git
cd REGRAVA
```

### Launch the Application

#### Terminal 1: Backend Server (FastAPI)
```bash
cd backend
python -m venv ../.venv

# Windows
..\.venv\Scripts\activate
# Linux / macOS
source ../.venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000 --reload
```
*Backend is live at `http://127.0.0.1:8000` (API Docs at `http://127.0.0.1:8000/docs`)*

#### Terminal 2: Frontend Server (Vite)
```bash
cd frontend
npm install
npm run dev
```
*Frontend is live at `http://localhost:5173`*

👉 **Open `http://localhost:5173`:**
* To test instantly without any credentials, click **"Explore Demo Sandbox (1-Click)"**.
* To test with your real repositories, click **"Or Sign In with GitHub Token (PAT)"**, paste your token, and scan your pull requests immediately!

<br/>

---

## ⚙️ Configuration & Environment Variables

Copy `.env.example` to `.env` to configure your environment:

```ini
# Server Network Settings
REGRAVA_HOST=127.0.0.1
REGRAVA_PORT=8000

# Session & Security
REGRAVA_SECRET_KEY=regrava-dev-secret-key-change-in-production-32bytes

# GitHub Personal Access Token (Fastest setup for real repositories)
# Scopes needed: repo, read:user, user:email
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional: GitHub OAuth App (For full browser redirect flow)
GITHUB_APP_NAME=regrava-scanner
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=http://127.0.0.1:8000/api/auth/github/callback
GITHUB_FRONTEND_URL=http://localhost:5173
```

<br/>

---

## 🧪 Automated Test Suite

REGRAVA includes an automated test suite covering all AST parsers, contract diffing, security analyzers, and API endpoints:

```bash
# Run 38 Backend Pytest Tests
cd backend
python -m pytest -v
```

```
tests/test_api_endpoints.py::test_health_endpoint                     PASSED [  2%]
tests/test_auth_and_sessions.py::test_demo_login_and_session_cookie   PASSED [ 18%]
tests/test_security_analyzer.py::test_secret_scanning_and_redaction   PASSED [ 76%]
tests/test_security_analyzer.py::test_sql_injection_detection         PASSED [ 78%]
tests/test_security_analyzer.py::test_command_injection_detection     PASSED [ 81%]
tests/test_security_analyzer.py::test_xss_detection                   PASSED [ 84%]
tests/test_security_analyzer.py::test_missing_resource_ownership_check PASSED [ 86%]
tests/test_security_analyzer.py::test_path_traversal_detection        PASSED [ 89%]
tests/test_security_analyzer.py::test_ssrf_detection                  PASSED [ 92%]
tests/test_security_analyzer.py::test_insecure_cors_detection         PASSED [ 94%]
tests/test_typescript_parser.py::test_typescript_ast_property_access  PASSED [ 97%]
tests/test_pr_analysis.py::test_analyze_pr_endpoint                   PASSED [100%]
======================= 38 passed, 11 warnings in 3.86s =======================
```

```bash
# Run Frontend Tests & Production Build
cd frontend
npm test -- --run
npm run build
```

<br/>

---

## 🤖 GitHub Actions CI/CD Integration

Automate REGRAVA checks on every pull request. Add this workflow to `.github/workflows/regrava.yml`:

```yaml
name: REGRAVA Pull-Request Sentinel

on:
  pull_request:
    branches: [main, master]

jobs:
  analyze:
    name: Security & Regression Scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r backend/requirements.txt
          cd analyzer_ts && npm install

      - name: Run REGRAVA Scan
        run: |
          python -m backend.app.cli --repo . --base origin/${{ github.base_ref }} --head HEAD --fail-on high
```

<br/>

---

## 🔒 Zero-Retention & Privacy Manifesto

> [!NOTE]
> Developer security tools must never become a data liability. REGRAVA is architected from the ground up for strict privacy:

* 🚫 **Zero Source Code Execution:** Target code is never imported, compiled, or executed. Everything is inspected strictly as abstract syntax trees (ASTs).
* 🛡️ **Automated Secret Redaction:** API keys, AWS credentials, and auth tokens are masked in-memory before reaching logs or the UI.
* 💾 **In-Memory & Ephemeral:** Source code diffs are analyzed in-memory. No client code is stored on disk or in remote databases.
* 🧠 **No External LLM Training:** Your code is never sent to third-party language models or training pools.
* 🔑 **Scoped Read-Only Access:** Requires only read access to pull requests and repository metadata—no write or administrative permissions needed.

<br/>

---

## 🗺️ Project Structure

```
REGRAVA/
├── backend/                        # FastAPI Application & Analysis Engine
│   ├── app/
│   │   ├── analyzer/               # Deterministic Analyzers
│   │   │   ├── security_analyzer.py# 7 Security Categories
│   │   │   ├── contract_comparator.py# Pydantic Base vs Head Diff
│   │   │   ├── typescript_parser.py# TypeScript Compiler API Bridge
│   │   │   └── test_evidence.py    # Test Coverage Discovery
│   │   ├── api/                    # REST Endpoints (Auth, PRs, Repos)
│   │   ├── db/session_db.py        # SQLite Local Persistence (regrava.db)
│   │   ├── services/               # GitHub Service & PR Analysis Service
│   │   └── main.py                 # Application Entry Point
│   └── tests/                      # 38 Automated Backend Tests
├── frontend/                       # Modern React + Vite Dashboard
│   ├── src/
│   │   ├── components/             # Header, Sidebar, FindingDetailModal
│   │   ├── pages/                  # Overview, Repos, PullRequests, Findings, Settings, Auth
│   │   ├── services/api.ts         # Typed API Client
│   │   └── types/index.ts          # Domain Models & Finding Types
├── services/payments/              # Live Testing Scenario & Consumer Components
│   ├── models.py                   # PaymentResponse Pydantic Model
│   ├── routes.py                   # Payment Gateway Routes (SQLi, Secrets, Path Traversal)
│   └── PaymentView.tsx             # React Consumer Component (Contract Regression + XSS)
├── analyzer_ts/                    # TypeScript AST Subprocess Analyzer
└── docs/                           # Threat Model & Supported Patterns
```

<br/>

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

<div align="center">
<br/>

**REGRAVA** &bull; *Catch what your diff could break.*  
Built with ❤️ for full-stack developers and high-assurance engineering teams.

</div>
