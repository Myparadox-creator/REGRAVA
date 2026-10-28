"""
Deterministic Security Analyzer for REGRAVA.
Statically analyzes code diffs and surrounding context across:
- Category A: Secrets and Credentials (with automatic redaction)
- Category B: Injection Vulnerabilities (SQLi, Command Injection, XSS, Unsafe Eval)
- Category C: Authentication and Authorization (Missing Resource-Ownership Checks)
- Category D: Input Validation & Path Traversal (Path Traversal, SSRF, Insecure Deserialization)
- Category E: Security Configuration (Insecure CORS, Dangerous Container/Workflow Configs)
- Category F: Dependency Security (Vulnerable Packages & Insecure Version Constraints)
"""

import ast
import re
from typing import Dict, List, Optional, Tuple, Any
from app.models.finding import (
    Finding,
    FindingCategory,
    Severity,
    Confidence,
    TestEvidenceStatus,
    ChangedFileRef,
    AffectedFileRef,
)


class SecurityAnalyzer:
    def __init__(self):
        self.secret_rules = self._init_secret_rules()

    def _init_secret_rules(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": "AWS Access Key ID",
                "pattern": re.compile(r"['\"]?(AKIA[0-9A-Z]{16})['\"]?"),
                "severity": Severity.HIGH,
                "confidence": Confidence.HIGH,
                "redact_group": 1,
            },
            {
                "name": "AWS Secret Access Key",
                "pattern": re.compile(r"(?i)(?:aws_secret_access_key|aws_secret)\s*[:=]\s*['\"]([A-Za-z0-9/+=]{40})['\"]"),
                "severity": Severity.HIGH,
                "confidence": Confidence.HIGH,
                "redact_group": 1,
            },
            {
                "name": "GitHub Personal Access Token",
                "pattern": re.compile(r"['\"](ghp_[A-Za-z0-9_]{30,50}|github_pat_[A-Za-z0-9_]{60,90})['\"]"),
                "severity": Severity.HIGH,
                "confidence": Confidence.HIGH,
                "redact_group": 1,
            },
            {
                "name": "OpenAI / Anthropic / Stripe API Key",
                "pattern": re.compile(r"['\"](sk-(?:live-|ant-)?[A-Za-z0-9_-]{24,64})['\"]"),
                "severity": Severity.HIGH,
                "confidence": Confidence.HIGH,
                "redact_group": 1,
            },
            {
                "name": "Generic Private Key",
                "pattern": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
                "severity": Severity.HIGH,
                "confidence": Confidence.HIGH,
                "redact_group": 0,
            },
            {
                "name": "Database Connection URI with Password",
                "pattern": re.compile(r"(?i)(?:postgres|mysql|mongodb|redis):\/\/[a-zA-Z0-9_\-]+:([a-zA-Z0-9_\-!@#$%^&*]+)@[a-zA-Z0-9_\-.]+"),
                "severity": Severity.HIGH,
                "confidence": Confidence.HIGH,
                "redact_group": 1,
            },
            {
                "name": "Hardcoded Password / Secret Assignment",
                "pattern": re.compile(r"(?i)(?:api_key|secret_key|jwt_secret|db_password)\s*[:=]\s*['\"]([a-zA-Z0-9_!@#$%^&*+=]{12,64})['\"]"),
                "severity": Severity.HIGH,
                "confidence": Confidence.MEDIUM,
                "redact_group": 1,
            },
        ]

    def redact_secret(self, secret: str) -> str:
        """Mask detected secret for safe display in UI and logs."""
        if not secret:
            return "***"
        if len(secret) <= 8:
            return secret[:2] + "****"
        return secret[:4] + "*" * (len(secret) - 8) + secret[-4:]

    def analyze_file(self, file_path: str, content: str) -> List[Finding]:
        findings: List[Finding] = []
        norm_path = file_path.replace("\\", "/")

        # 1. Scan for Secrets (across all file types)
        findings.extend(self._scan_secrets(norm_path, content))

        # 2. Python-specific Security AST & Source Scan
        if norm_path.endswith(".py"):
            findings.extend(self._scan_python_security(norm_path, content))

        # 3. TypeScript / JavaScript / TSX Security Scan
        if norm_path.endswith((".ts", ".tsx", ".js", ".jsx")):
            findings.extend(self._scan_javascript_security(norm_path, content))

        # 4. Configuration & Infrastructure Scan
        if norm_path.endswith((".py", ".yml", ".yaml", "Dockerfile", "docker-compose.yml", "package.json", "requirements.txt")):
            findings.extend(self._scan_configuration_security(norm_path, content))

        return findings

    # --- Category A: Secrets Scanning ---
    def _scan_secrets(self, file_path: str, content: str) -> List[Finding]:
        findings: List[Finding] = []
        lines = content.splitlines()

        for line_idx, line in enumerate(lines, start=1):
            # Skip comments or documentation files if purely informational
            for rule in self.secret_rules:
                match = rule["pattern"].search(line)
                if match:
                    raw_secret = match.group(rule["redact_group"]) if rule["redact_group"] > 0 else match.group(0)
                    # Ignore obvious false-positive placeholders
                    if any(p in raw_secret.lower() for p in ["your_", "example", "placeholder", "fake", "test", "xxx", "dummy", "my_secret"]):
                        continue

                    redacted = self.redact_secret(raw_secret)
                    findings.append(
                        Finding(
                            id=f"SEC-SEC-{len(findings) + 1:03d}",
                            category=FindingCategory.SECRETS,
                            title=f"Potential Hardcoded {rule['name']}",
                            severity=rule["severity"],
                            confidence=rule["confidence"],
                            summary=f"A potential hardcoded {rule['name']} was detected in source code.",
                            changed_file=ChangedFileRef(
                                path=file_path,
                                line=line_idx,
                                symbol=redacted,
                            ),
                            evidence=[
                                f"Pattern matched '{rule['name']}' at {file_path}:{line_idx}.",
                                f"Redacted secret token: {redacted}",
                            ],
                            conditions=[
                                "The secret key must be active and valid in production or cloud services.",
                                "The repository or build artifact is accessible to unauthorized parties.",
                            ],
                            recommendation=(
                                f"Remove the hardcoded secret immediately. Rotate the credential in your cloud provider, "
                                f"and inject it at runtime via environment variables or a secrets manager."
                            ),
                            attack_scenario=(
                                "An attacker with read access to the repository or commit history can extract this credential "
                                "and impersonate your service or access sensitive cloud resources."
                            ),
                            limitations=[
                                "Deterministic regex matches token syntax; verify whether the credential is active."
                            ],
                            test_evidence=TestEvidenceStatus.NOT_FOUND_BY_ANALYZER,
                        )
                    )
        return findings

    # --- Category B, C, D: Python Security AST Analysis ---
    def _scan_python_security(self, file_path: str, content: str) -> List[Finding]:
        findings: List[Finding] = []
        try:
            tree = ast.parse(content, filename=file_path)
        except Exception:
            return findings

        lines = content.splitlines()

        for node in ast.walk(tree):
            # B1-a. SQL Injection: Raw SQL string formatting in assignments (e.g. query = f"SELECT ... {id}")
            if isinstance(node, ast.Assign):
                val = node.value
                is_sqli = False
                snippet = ""
                if isinstance(val, ast.JoinedStr):
                    raw_str = "".join([part.value for part in val.values if isinstance(part, ast.Constant)])
                    if any(w in raw_str.upper() for w in ["SELECT ", "UPDATE ", "DELETE ", "INSERT ", "WHERE "]):
                        is_sqli = True
                        snippet = lines[node.lineno - 1].strip() if node.lineno <= len(lines) else ""
                elif isinstance(val, ast.BinOp) and isinstance(val.op, ast.Mod):
                    is_sqli = True
                    snippet = lines[node.lineno - 1].strip() if node.lineno <= len(lines) else ""

                if is_sqli:
                    findings.append(
                        Finding(
                            id=f"SEC-INJ-{len(findings) + 1:03d}",
                            category=FindingCategory.INJECTION,
                            title="Potential SQL Injection via Dynamic String Formatting",
                            severity=Severity.HIGH,
                            confidence=Confidence.HIGH,
                            summary="A database query is constructed using dynamic string formatting instead of parameterized inputs.",
                            changed_file=ChangedFileRef(path=file_path, line=node.lineno, symbol="query"),
                            affected_file=AffectedFileRef(path=file_path, line=node.lineno, symbol="query", context_snippet=snippet),
                            evidence=[
                                f"SQL query constructed using dynamic interpolation at line {node.lineno}.",
                                f"Code snippet: `{snippet}`",
                            ],
                            conditions=[
                                "The variable injected into the query must originate from user-controllable input.",
                                "The database driver executes the query without server-side parameterization.",
                            ],
                            recommendation="Use parameterized queries (e.g. `cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))`) or an ORM like SQLAlchemy.",
                            attack_scenario="An attacker can supply SQL syntax in the parameter to manipulate the query, bypass authentication, or exfiltrate the database.",
                            limitations=["Static analysis verifies formatted query string; does not verify runtime sanitization."],
                            test_evidence=TestEvidenceStatus.NOT_FOUND_BY_ANALYZER,
                        )
                    )

            # B1-b. SQL Injection: Raw SQL string formatting in execute queries
            if isinstance(node, ast.Call):
                func_name = ""
                if isinstance(node.func, ast.Attribute):
                    func_name = node.func.attr
                elif isinstance(node.func, ast.Name):
                    func_name = node.func.id

                # DB cursor execute calls
                if func_name in ["execute", "executemany", "raw"]:
                    if node.args:
                        first_arg = node.args[0]
                        # Check f-string or % or .format()
                        is_sqli = False
                        snippet = ""
                        if isinstance(first_arg, ast.JoinedStr):  # f"SELECT ... {var}"
                            # Check if joined string looks like SQL query
                            raw_str = "".join([part.value for part in first_arg.values if isinstance(part, ast.Constant)])
                            if any(w in raw_str.upper() for w in ["SELECT ", "UPDATE ", "DELETE ", "INSERT ", "WHERE "]):
                                is_sqli = True
                                snippet = lines[node.lineno - 1].strip() if node.lineno <= len(lines) else ""
                        elif isinstance(first_arg, ast.BinOp) and isinstance(first_arg.op, ast.Mod):  # "SELECT ... %s" % var
                            is_sqli = True
                            snippet = lines[node.lineno - 1].strip() if node.lineno <= len(lines) else ""

                        if is_sqli:
                            findings.append(
                                Finding(
                                    id=f"SEC-INJ-{len(findings) + 1:03d}",
                                    category=FindingCategory.INJECTION,
                                    title="Potential SQL Injection via Dynamic String Formatting",
                                    severity=Severity.HIGH,
                                    confidence=Confidence.HIGH,
                                    summary="A database query is constructed using dynamic string formatting instead of parameterized inputs.",
                                    changed_file=ChangedFileRef(path=file_path, line=node.lineno, symbol=func_name),
                                    affected_file=AffectedFileRef(path=file_path, line=node.lineno, symbol=func_name, context_snippet=snippet),
                                    evidence=[
                                        f"Call to '{func_name}()' uses an unparameterized f-string or string modulo at line {node.lineno}.",
                                        f"Code snippet: `{snippet}`",
                                    ],
                                    conditions=[
                                        "The variable injected into the query must originate from user-controllable input.",
                                        "The database driver executes the query without server-side parameterization.",
                                    ],
                                    recommendation="Use parameterized queries (e.g. `cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))`) or an ORM like SQLAlchemy.",
                                    attack_scenario="An attacker can supply SQL syntax in the parameter to manipulate the query, bypass authentication, or exfiltrate the database.",
                                    limitations=["Static analysis verifies formatted query string; does not verify runtime sanitization."],
                                    test_evidence=TestEvidenceStatus.NOT_FOUND_BY_ANALYZER,
                                )
                            )

                # B2. Command Injection: subprocess with shell=True
                if func_name in ["run", "Popen", "call", "check_output", "system"]:
                    is_shell_true = False
                    for kw in getattr(node, "keywords", []):
                        if kw.arg == "shell" and isinstance(kw.value, ast.Constant) and kw.value.value is True:
                            is_shell_true = True
                    if func_name == "system" or is_shell_true:
                        snippet = lines[node.lineno - 1].strip() if node.lineno <= len(lines) else ""
                        findings.append(
                            Finding(
                                id=f"SEC-CMD-{len(findings) + 1:03d}",
                                category=FindingCategory.INJECTION,
                                title="Potential Command Injection via Shell Execution",
                                severity=Severity.HIGH,
                                confidence=Confidence.HIGH,
                                summary=f"Subprocess call uses shell execution (`shell=True` or `os.system`) which can permit arbitrary shell command injection.",
                                changed_file=ChangedFileRef(path=file_path, line=node.lineno, symbol=func_name),
                                affected_file=AffectedFileRef(path=file_path, line=node.lineno, symbol=func_name, context_snippet=snippet),
                                evidence=[
                                    f"Command execution invocation '{func_name}' at {file_path}:{node.lineno}.",
                                    f"Code snippet: `{snippet}`",
                                ],
                                conditions=[
                                    "Command string incorporates user-controlled arguments or unescaped paths.",
                                ],
                                recommendation="Pass arguments as a list with `shell=False` (e.g. `subprocess.run(['git', 'status'], shell=False)`).",
                                attack_scenario="An attacker can append shell operators (e.g. `; rm -rf /` or `| curl evil.com`) to execute arbitrary host commands.",
                                limitations=["Check verifies shell=True invocation; ensure argument array is strictly separated."],
                                test_evidence=TestEvidenceStatus.NOT_FOUND_BY_ANALYZER,
                            )
                        )

                # B3. Insecure Dynamic Execution: eval(), exec(), pickle.loads()
                if func_name in ["eval", "exec", "pickle.loads", "loads"]:
                    snippet = lines[node.lineno - 1].strip() if node.lineno <= len(lines) else ""
                    findings.append(
                        Finding(
                            id=f"SEC-DYN-{len(findings) + 1:03d}",
                            category=FindingCategory.INJECTION,
                            title=f"Unsafe Dynamic Execution via '{func_name}'",
                            severity=Severity.HIGH,
                            confidence=Confidence.HIGH,
                            summary=f"Call to '{func_name}' executes dynamic code or deserializes untrusted objects.",
                            changed_file=ChangedFileRef(path=file_path, line=node.lineno, symbol=func_name),
                            affected_file=AffectedFileRef(path=file_path, line=node.lineno, symbol=func_name, context_snippet=snippet),
                            evidence=[
                                f"Invocation of '{func_name}' at line {node.lineno}.",
                                f"Snippet: `{snippet}`",
                            ],
                            conditions=["Input to function can be influenced by untrusted users or payloads."],
                            recommendation="Avoid dynamic evaluation. Use `ast.literal_eval` for safe evaluation or `json.loads` for serialization.",
                            attack_scenario="Supplying crafted Python syntax or pickle bytecode achieves remote code execution.",
                            limitations=["Static check catches all direct eval/pickle calls."],
                            test_evidence=TestEvidenceStatus.NOT_FOUND_BY_ANALYZER,
                        )
                    )

                # D1. Path Traversal: open() with user-controlled path string formatting
                if func_name == "open" and node.args:
                    first_arg = node.args[0]
                    if isinstance(first_arg, (ast.JoinedStr, ast.BinOp)):
                        snippet = lines[node.lineno - 1].strip() if node.lineno <= len(lines) else ""
                        findings.append(
                            Finding(
                                id=f"SEC-PTH-{len(findings) + 1:03d}",
                                category=FindingCategory.INPUT_VALIDATION,
                                title="Potential Path Traversal via Dynamic File Access",
                                severity=Severity.HIGH,
                                confidence=Confidence.MEDIUM,
                                summary="File opened using dynamic path construction without verified path confinement.",
                                changed_file=ChangedFileRef(path=file_path, line=node.lineno, symbol="open"),
                                affected_file=AffectedFileRef(path=file_path, line=node.lineno, symbol="open", context_snippet=snippet),
                                evidence=[
                                    f"File open with dynamically constructed path at line {node.lineno}.",
                                    f"Snippet: `{snippet}`",
                                ],
                                conditions=[
                                    "Path variable contains user input without sanitizing `..` sequences.",
                                    "No validation checks that the resolved path stays within an allowed directory root.",
                                ],
                                recommendation="Resolve the target path using `Path(p).resolve()` and verify `target.is_relative_to(base_dir)`.",
                                attack_scenario="An attacker supplies `../../etc/passwd` or windows paths to read or overwrite system files.",
                                limitations=["Analyzer flags dynamic file path construction; verify whether an upstream validator was applied."],
                                test_evidence=TestEvidenceStatus.NOT_FOUND_BY_ANALYZER,
                            )
                        )

                # D2. Server-Side Request Forgery (SSRF): requests.get(url) with dynamic URL
                if func_name in ["get", "post", "put", "delete"] and isinstance(getattr(node, "func", None), ast.Attribute):
                    obj_name = getattr(node.func.value, "id", "")
                    if obj_name in ["requests", "httpx", "urllib", "client", "session"]:
                        if node.args and isinstance(node.args[0], (ast.Name, ast.JoinedStr, ast.BinOp)):
                            snippet = lines[node.lineno - 1].strip() if node.lineno <= len(lines) else ""
                            findings.append(
                                Finding(
                                    id=f"SEC-SSRF-{len(findings) + 1:03d}",
                                    category=FindingCategory.INPUT_VALIDATION,
                                    title="Potential Server-Side Request Forgery (SSRF)",
                                    severity=Severity.HIGH,
                                    confidence=Confidence.MEDIUM,
                                    summary=f"HTTP request made via '{obj_name}.{func_name}()' using dynamic URL parameter.",
                                    changed_file=ChangedFileRef(path=file_path, line=node.lineno, symbol=f"{obj_name}.{func_name}"),
                                    affected_file=AffectedFileRef(path=file_path, line=node.lineno, symbol=f"{obj_name}.{func_name}", context_snippet=snippet),
                                    evidence=[
                                        f"Outbound network request with dynamic target at line {node.lineno}.",
                                        f"Snippet: `{snippet}`",
                                    ],
                                    conditions=["Target URL is supplied or modified by an untrusted user."],
                                    recommendation="Validate outbound URLs against an explicit allowlist and block private IP ranges (e.g. 127.0.0.1, 169.254.169.254, RFC1918).",
                                    attack_scenario="An attacker points the server to internal metadata services (e.g. AWS 169.254.169.254) to steal instance IAM credentials.",
                                    limitations=["Static detection identifies dynamic outbound URLs."],
                                    test_evidence=TestEvidenceStatus.NOT_FOUND_BY_ANALYZER,
                                )
                            )

            # C1. Missing Resource-Ownership Check:
            # Route handler takes {user_id} or {account_id} as parameter but does not check current_user ownership
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                # Check if decorated as FastAPI route
                is_route = False
                for dec in node.decorator_list:
                    if isinstance(dec, ast.Call) and isinstance(getattr(dec, "func", None), (ast.Attribute, ast.Name)):
                        attr = getattr(dec.func, "attr", getattr(dec.func, "id", ""))
                        if attr.lower() in ["get", "post", "put", "delete", "patch"]:
                            is_route = True
                            break

                if is_route:
                    # Check parameters for ID parameters e.g. user_id, account_id, org_id
                    id_params = [
                        arg.arg for arg in node.args.args
                        if arg.arg in ["user_id", "account_id", "customer_id", "profile_id"]
                    ]

                    # Check function body for ownership verification
                    func_body_text = ast.get_source_segment(content, node) or ""
                    has_auth_check = any(
                        term in func_body_text
                        for term in ["current_user.id ==", "user.id ==", "check_ownership", "verify_ownership", "permission"]
                    )

                    if id_params and not has_auth_check:
                        param_name = id_params[0]
                        findings.append(
                            Finding(
                                id=f"SEC-AUTH-{len(findings) + 1:03d}",
                                category=FindingCategory.AUTHENTICATION,
                                title=f"Potential Missing Resource-Ownership Check on '{param_name}'",
                                severity=Severity.HIGH,
                                confidence=Confidence.MEDIUM,
                                summary=(
                                    f"Endpoint '{node.name}' accepts client-supplied '{param_name}' without a verified "
                                    f"ownership check against the authenticated user session."
                                ),
                                changed_file=ChangedFileRef(path=file_path, line=node.lineno, symbol=node.name),
                                affected_file=AffectedFileRef(path=file_path, line=node.lineno, symbol=node.name, context_snippet=f"def {node.name}(..., {param_name}: int)"),
                                evidence=[
                                    f"Route handler '{node.name}' accepts resource identifier '{param_name}' at line {node.lineno}.",
                                    "No verification comparing the parameter to the caller's session identity was identified in the handler.",
                                ],
                                conditions=[
                                    "The endpoint is accessible to authenticated or anonymous users without fine-grained authorization middleware.",
                                    "A user can supply another tenant's or user's ID to access their records.",
                                ],
                                recommendation=(
                                    f"Verify that `current_user.id == {param_name}` or check the user's role/tenant authorization "
                                    f"before returning or mutating the requested resource."
                                ),
                                attack_scenario=(
                                    f"An authenticated user can change '{param_name}' from their own ID to 101 to access or modify "
                                    f"another user's private data (Insecure Direct Object Reference / IDOR)."
                                ),
                                limitations=[
                                    "Authorization may be enforced by an uninspected custom dependency or middleware layer."
                                ],
                                test_evidence=TestEvidenceStatus.NOT_FOUND_BY_ANALYZER,
                            )
                        )

        return findings

    # --- Category B & D: JavaScript / TypeScript Security Scan ---
    def _scan_javascript_security(self, file_path: str, content: str) -> List[Finding]:
        findings: List[Finding] = []
        lines = content.splitlines()

        for idx, line in enumerate(lines, start=1):
            # XSS: dangerouslySetInnerHTML
            if "dangerouslySetInnerHTML" in line and not line.strip().startswith("//"):
                findings.append(
                    Finding(
                        id=f"SEC-XSS-{len(findings) + 1:03d}",
                        category=FindingCategory.INJECTION,
                        title="Potential Cross-Site Scripting (XSS) via dangerouslySetInnerHTML",
                        severity=Severity.HIGH,
                        confidence=Confidence.HIGH,
                        summary="React component renders raw HTML using 'dangerouslySetInnerHTML'.",
                        changed_file=ChangedFileRef(path=file_path, line=idx, symbol="dangerouslySetInnerHTML"),
                        affected_file=AffectedFileRef(path=file_path, line=idx, symbol="dangerouslySetInnerHTML", context_snippet=line.strip()),
                        evidence=[
                            f"Usage of 'dangerouslySetInnerHTML' at {file_path}:{idx}.",
                            f"Code snippet: `{line.strip()}`",
                        ],
                        conditions=["The rendered HTML content includes untrusted user input without sanitization."],
                        recommendation="Avoid raw HTML injection. If required, sanitize inputs using a library like DOMPurify before rendering.",
                        attack_scenario="An attacker can inject `<script>` tags or malicious event handlers that execute in victims' browsers to steal session tokens.",
                        limitations=["Static detection flags direct property usage; verify if input is pre-sanitized."],
                        test_evidence=TestEvidenceStatus.NOT_FOUND_BY_ANALYZER,
                    )
                )

            # Client-side hardcoded credentials or tokens
            if any(term in line.lower() for term in ["private_key", "secret_key", "api_secret"]) and ("=" in line or ":" in line):
                if not line.strip().startswith("//"):
                    findings.append(
                        Finding(
                            id=f"SEC-CLI-{len(findings) + 1:03d}",
                            category=FindingCategory.SECRETS,
                            title="Potential Secret Assigned in Frontend Source",
                            severity=Severity.MEDIUM,
                            confidence=Confidence.MEDIUM,
                            summary="A private key or secret variable name was found in frontend code, which will be visible in client bundles.",
                            changed_file=ChangedFileRef(path=file_path, line=idx, symbol="secret"),
                            evidence=[f"Potential secret assignment at line {idx}: `{line.strip()[:60]}...`"],
                            conditions=["The file is bundled into client-side assets."],
                            recommendation="Never store secrets in frontend code. Move sensitive operations to backend API endpoints.",
                            attack_scenario="Any browser user inspecting JavaScript bundles can extract the secret.",
                            limitations=["Rule flags secret-like variable assignments in frontend files."],
                            test_evidence=TestEvidenceStatus.NOT_FOUND_BY_ANALYZER,
                        )
                    )

        return findings

    # --- Category E & F: Configuration and Dependency Security Scan ---
    def _scan_configuration_security(self, file_path: str, content: str) -> List[Finding]:
        findings: List[Finding] = []
        lines = content.splitlines()

        # E1. Insecure CORS: allow_origins=["*"] with allow_credentials=True
        if "CORSMiddleware" in content or "allow_origins" in content:
            has_wildcard = any('allow_origins=["*"]' in l.replace(" ", "") or "allow_origins=['*']" in l.replace(" ", "") for l in lines)
            has_creds = any("allow_credentials=True" in l.replace(" ", "") or "allow_credentials=true" in l.replace(" ", "") for l in lines)
            if has_wildcard and has_creds:
                line_no = next((i for i, l in enumerate(lines, 1) if "allow_origins" in l), 1)
                findings.append(
                    Finding(
                        id=f"SEC-CORS-{len(findings) + 1:03d}",
                        category=FindingCategory.CONFIGURATION,
                        title="Insecure CORS Policy: Wildcard Origins with Credentials",
                        severity=Severity.HIGH,
                        confidence=Confidence.HIGH,
                        summary="CORS is configured with wildcard origin ('*') while allowing credentials (`allow_credentials=True`).",
                        changed_file=ChangedFileRef(path=file_path, line=line_no, symbol="CORSMiddleware"),
                        evidence=[
                            f"Configuration at {file_path}:{line_no} pairs wildcard origins with credentials allowed."
                        ],
                        conditions=["A browser visits a malicious website while authenticated to your application."],
                        recommendation="Specify explicit trusted origins in `allow_origins` instead of `*` when credentials are permitted.",
                        attack_scenario="A malicious third-party site can make authenticated cross-origin requests and read private responses.",
                        limitations=["Static inspection of CORS settings."],
                        test_evidence=TestEvidenceStatus.NOT_FOUND_BY_ANALYZER,
                    )
                )

        # E2. GitHub Actions Insecure Trigger: pull_request_target with untrusted checkout
        if file_path.endswith((".yml", ".yaml")) and "pull_request_target" in content:
            if "actions/checkout" in content and any("ref:" in l and "github.event.pull_request.head.sha" in l for l in lines):
                findings.append(
                    Finding(
                        id=f"SEC-GHA-{len(findings) + 1:03d}",
                        category=FindingCategory.CONFIGURATION,
                        title="Dangerous GitHub Actions Workflow: pull_request_target with Untrusted Checkout",
                        severity=Severity.HIGH,
                        confidence=Confidence.HIGH,
                        summary="Workflow triggers on 'pull_request_target' with elevated repository permissions and checks out untrusted PR head code.",
                        changed_file=ChangedFileRef(path=file_path, line=1, symbol="pull_request_target"),
                        evidence=[
                            f"Workflow in {file_path} pairs 'pull_request_target' with checkout of PR head SHA."
                        ],
                        conditions=["A pull request is submitted from a public fork with modified script or build steps."],
                        recommendation="Use `pull_request` trigger for untrusted code, or avoid checking out PR code in workflows that have access to secrets.",
                        attack_scenario="An attacker opens a pull request with modified code that exfiltrates repository secrets (e.g. GITHUB_TOKEN or cloud secrets).",
                        limitations=["Standard GitHub Actions security best practice check."],
                        test_evidence=TestEvidenceStatus.NOT_FOUND_BY_ANALYZER,
                    )
                )

        # F1. Known Insecure Dependencies
        vulnerable_pkg_rules = [
            ("requests<2.31.0", "requests", "2.31.0", "CVE-2023-32681 (Potential unintended leak of Proxy-Authorization header)"),
            ("urllib3<1.26.17", "urllib3", "1.26.17", "CVE-2023-43804 (Cookie header leak on redirect)"),
            ("cryptography<41.0.4", "cryptography", "41.0.4", "CVE-2023-38325 (Memory corruption vulnerability in OpenSSL bindings)"),
            ("flask<2.2.5", "flask", "2.2.5", "CVE-2023-30861 (Session disclosure vulnerability)"),
            ("axios<1.6.0", "axios", "1.6.0", "CVE-2023-45857 (Cross-Site Request Forgery via CSRF token exposure)"),
        ]

        for rule_text, pkg_name, safe_ver, advisory in vulnerable_pkg_rules:
            for idx, line in enumerate(lines, 1):
                clean_l = line.strip().lower()
                if clean_l.startswith(pkg_name.lower()) and any(op in clean_l for op in ["==", "<=", "<"]):
                    findings.append(
                        Finding(
                            id=f"SEC-DEP-{len(findings) + 1:03d}",
                            category=FindingCategory.DEPENDENCY,
                            title=f"Vulnerable Dependency Version Detected: '{pkg_name}'",
                            severity=Severity.MEDIUM,
                            confidence=Confidence.HIGH,
                            summary=f"Dependency '{pkg_name}' matches a known vulnerable version specification.",
                            changed_file=ChangedFileRef(path=file_path, line=idx, symbol=pkg_name),
                            evidence=[
                                f"Declared dependency at {file_path}:{idx}: `{line.strip()}`",
                                f"Associated Advisory: {advisory}",
                            ],
                            conditions=["The vulnerable function in the library is invoked by your application."],
                            recommendation=f"Upgrade '{pkg_name}' to version >= {safe_ver} or latest release.",
                            attack_scenario="Exploitation depends on the specific CVE advisory vector.",
                            limitations=["Static parsing of declared version specs."],
                            test_evidence=TestEvidenceStatus.NOT_FOUND_BY_ANALYZER,
                        )
                    )

        return findings
