# Security Model and Threat Assessment

RepoSentinel is designed to evaluate untrusted repositories without exposing the host system to remote code execution, command injection, or filesystem escapes.

## Threat Model

Analyzing source code involves processing potentially malicious or adversarial input (e.g. repositories submitted in pull requests or placed into workspace directories). RepoSentinel implements multi-layered isolation to neutralize these vectors:

### 1. Zero Code Execution
- **Policy**: RepoSentinel never imports, evaluates, or executes Python or JavaScript files from analyzed repositories.
- **Implementation**: All AST analysis is performed using Python's standard library `ast.parse` and the official TypeScript Compiler API `ts.createSourceFile`. No `eval()`, `exec()`, `importlib`, or `vm.runInContext` is used.

### 2. No Automated Dependency Installation
- **Policy**: RepoSentinel never executes `pip install`, `npm install`, or arbitrary build scripts inside or on behalf of analyzed repositories.
- **Protection**: Eliminates `setup.py` / `package.json` lifecycle hook vulnerabilities (e.g. `preinstall` malicious scripts).

### 3. Safe Subprocess Execution
- **Policy**: All subprocess calls avoid shell invocation (`shell=False`).
- **Implementation**: Commands are passed as structured string arrays (e.g. `["git", "-C", str(repo_path), "show", f"{ref}:{norm_path}"]`). Command timeouts (default 20 seconds) prevent denial-of-service via infinite processes or hanging operations.

### 4. Workspace Confinement & Path Traversal Prevention
- **Policy**: The web dashboard restricts analysis strictly to configured repository directories (`workspaces/` and `examples/`).
- **Implementation**: All filesystem paths are resolved via `Path.resolve()` and verified using `path.is_relative_to(allowed_root)` before file reading occurs. Attempts to traverse directories via `../` or symlinks outside the root are blocked with a `SecurityError`.

### 5. Resource Limits
- **File Size Caps**: Files exceeding `MAX_FILE_SIZE_BYTES` (default 1 MB) are skipped with an explanatory warning to prevent memory exhaustion.
- **Diff Limits**: Limits the number of inspected diff objects (`MAX_DIFF_FILES = 500`).

### 6. Secret Isolation & Zero API Key Requirement
- RepoSentinel does not require external AI API keys, proprietary tokens, or private credentials for any core feature.
- Analyzer output and logs do not dump environment variables or system authentication stores.

### 7. CI / GitHub Actions Least Privilege
- The included workflow runs with `permissions: contents: read`.
- Pull request reviews are published to the job summary (`$GITHUB_STEP_SUMMARY`) rather than requiring write permissions to create pull request comments.
