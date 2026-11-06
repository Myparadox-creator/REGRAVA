"""
Security Posture & Repository Health Service for REGRAVA.
Calculates deterministic health scores, evaluates the 7 security layers per repository,
and generates fleet-wide compliance metrics.
"""

from typing import Dict, List, Any, Optional
from app.db.session_db import db
from app.services.github_service import github_service


class SecurityPostureService:
    def __init__(self):
        self.categories_meta = [
            {
                "id": "secrets",
                "layer": 1,
                "name": "Secrets & Credentials",
                "description": "AWS, Stripe, GitHub PATs, and high-entropy private keys",
                "pass_msg": "Zero active credentials or unredacted keys detected",
                "fail_msg": "Hardcoded credentials or API keys exposed in source",
            },
            {
                "id": "injection",
                "layer": 2,
                "name": "Injection Vulnerabilities",
                "description": "SQL Injection, Command Injection, and DOM-based XSS",
                "pass_msg": "Parameterized queries and secure DOM sanitization enforced",
                "fail_msg": "Untrusted dynamic string formatting or dangerous sinks detected",
            },
            {
                "id": "authorization",
                "layer": 3,
                "name": "Authorization & IDOR",
                "description": "Missing tenancy and resource-ownership filters",
                "pass_msg": "User tenancy ownership verified on data access",
                "fail_msg": "Missing resource-ownership check on sensitive operations",
            },
            {
                "id": "input_validation",
                "layer": 4,
                "name": "Input Validation & Path Traversal",
                "description": "Path traversal in file operations and unvalidated SSRF",
                "pass_msg": "File access confined to base directory with safe URL schemes",
                "fail_msg": "Unsanitized path or remote URL request detected",
            },
            {
                "id": "configuration",
                "layer": 5,
                "name": "Security Configuration",
                "description": "Insecure CORS policies and dangerous GitHub Actions triggers",
                "pass_msg": "Explicit CORS allowlists and safe CI workflow triggers",
                "fail_msg": "Wildcard CORS origin or elevated workflow permissions detected",
            },
            {
                "id": "dependency",
                "layer": 6,
                "name": "Dependency CVEs",
                "description": "Pinned vulnerable packages and unconstrained versions",
                "pass_msg": "No known vulnerable package constraints identified",
                "fail_msg": "Vulnerable or unconstrained package dependencies found",
            },
            {
                "id": "api_contract",
                "layer": 7,
                "name": "API Contract Regressions",
                "description": "Cross-boundary schema field & type compatibility (Backend -> Frontend)",
                "pass_msg": "Backend response models 100% synchronized with React consumers",
                "fail_msg": "Breaking schema change: frontend accesses removed or renamed field",
            },
        ]

    async def get_fleet_security_posture(self, user_id: str) -> Dict[str, Any]:
        """Generate comprehensive, deterministic security posture and repository health data."""
        # 1. Fetch authorized repositories
        repos = await github_service.list_authorized_repositories(user_id)
        if not repos:
            repos = []

        # 2. Fetch all user analyses with full findings
        analyses = db.list_full_analyses_for_user(user_id, limit=200)

        # 3. Group analyses by repo_name (normalized)
        repo_analyses_map: Dict[str, List[Dict[str, Any]]] = {}
        for a in analyses:
            r_name = a.get("repo_name", "").lower()
            if r_name not in repo_analyses_map:
                repo_analyses_map[r_name] = []
            repo_analyses_map[r_name].append(a)

        repo_health_list: List[Dict[str, Any]] = []
        fleet_category_distribution: Dict[str, int] = {c["id"]: 0 for c in self.categories_meta}

        for repo in repos:
            full_name = repo.get("full_name", "")
            norm_name = full_name.lower()
            matching_analyses = repo_analyses_map.get(norm_name, [])

            repo_health = self._calculate_repo_health(repo, matching_analyses)
            repo_health_list.append(repo_health)

            # Accumulate category distribution
            for c_id, count in repo_health.get("category_alert_counts", {}).items():
                if c_id in fleet_category_distribution:
                    fleet_category_distribution[c_id] += count

        # Sort repos: lowest health score first (prioritize action on at-risk repos)
        repo_health_list.sort(key=lambda r: (r["health_score"], -r["open_findings_count"]))

        # 4. Calculate Fleet-wide KPI metrics
        total_repos = len(repo_health_list)
        if total_repos > 0:
            avg_score = round(sum(r["health_score"] for r in repo_health_list) / total_repos, 1)
        else:
            avg_score = 100.0

        fleet_grade = self._grade_for_score(avg_score)
        hardened_count = sum(1 for r in repo_health_list if r["health_score"] >= 88)
        at_risk_count = sum(1 for r in repo_health_list if r["health_score"] < 70)

        total_alerts = sum(r["open_findings_count"] for r in repo_health_list)
        total_critical_high = sum(r["high_severity_count"] for r in repo_health_list)
        total_breaking_contracts = sum(r["breaking_contracts_count"] for r in repo_health_list)
        total_test_gaps = sum(r["test_evidence_gaps_count"] for r in repo_health_list)
        total_checks_passed = sum(r["checks_passed_count"] for r in repo_health_list)
        total_checks_eval = sum(r["total_checks_count"] for r in repo_health_list)

        soc2_ready = total_critical_high == 0 and total_breaking_contracts == 0
        owasp_status = (
            "Verified Clean"
            if total_critical_high == 0
            else f"{total_critical_high} High-Severity Finding(s) Requiring Triage"
        )

        return {
            "average_health_score": avg_score,
            "fleet_grade": fleet_grade,
            "total_repositories": total_repos,
            "hardened_repositories": hardened_count,
            "at_risk_repositories": at_risk_count,
            "total_security_alerts": total_alerts,
            "total_critical_high": total_critical_high,
            "total_breaking_contracts": total_breaking_contracts,
            "total_test_gaps": total_test_gaps,
            "total_checks_passed": total_checks_passed,
            "total_checks_evaluated": total_checks_eval,
            "category_distribution": fleet_category_distribution,
            "compliance_readiness": {
                "soc2_ready": soc2_ready,
                "owasp_top10_status": owasp_status,
                "unresolved_blockers": total_critical_high + total_breaking_contracts,
            },
            "repositories": repo_health_list,
        }

    def _calculate_repo_health(
        self, repo: Dict[str, Any], analyses: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Compute individual repository security score, checks status, and PR velocity."""
        # Deduplicate open findings across PR analyses for this repo
        seen_findings = set()
        open_findings: List[Dict[str, Any]] = []
        category_counts: Dict[str, int] = {c["id"]: 0 for c in self.categories_meta}

        high_count = 0
        medium_count = 0
        low_count = 0
        breaking_contracts = 0
        test_gaps_count = 0

        clean_prs = 0
        flagged_prs = 0
        last_scan_at: Optional[str] = None
        last_pr_number: Optional[int] = None
        last_pr_title: Optional[str] = None

        if analyses:
            latest_analysis = analyses[0]
            last_scan_at = latest_analysis.get("created_at")
            last_pr_number = latest_analysis.get("pr_number")
            last_pr_title = latest_analysis.get("pr_title")

            for a in analyses:
                findings = a.get("findings", [])
                has_critical_issue = False

                for f in findings:
                    status = f.get("review_status", "open")
                    # Only consider unreviewed open findings for health degradation
                    if status != "open":
                        continue

                    # Deduplicate by title + changed_file path
                    key = (
                        f.get("title", ""),
                        f.get("changed_file", {}).get("path", "") if f.get("changed_file") else "",
                    )
                    if key in seen_findings:
                        continue
                    seen_findings.add(key)
                    open_findings.append(f)

                    sev = f.get("severity", "medium").lower()
                    cat = self._normalize_category(f.get("category", ""))

                    if cat in category_counts:
                        category_counts[cat] += 1

                    if sev == "high":
                        high_count += 1
                        has_critical_issue = True
                    elif sev == "medium":
                        medium_count += 1
                    else:
                        low_count += 1

                    if cat == "api_contract" and "removed" in f.get("title", "").lower():
                        breaking_contracts += 1

                    if f.get("test_evidence") == "not_found_by_analyzer":
                        test_gaps_count += 1

                if has_critical_issue:
                    flagged_prs += 1
                else:
                    clean_prs += 1

        # Calculate Health Score (15 to 100)
        if not analyses:
            # Clean unscanned repo baseline
            health_score = 96.0
            status_label = "compliant"
        else:
            # Deterministic penalty calculation
            penalty = (
                (high_count * 18.0)
                + (breaking_contracts * 14.0)
                + (medium_count * 8.0)
                + (test_gaps_count * 3.5)
            )
            raw_score = 100.0 - penalty
            health_score = max(15.0, min(100.0, round(raw_score, 1)))

            if health_score >= 88:
                status_label = "hardened" if high_count == 0 else "compliant"
            elif health_score >= 70:
                status_label = "moderate_risk"
            elif health_score >= 50:
                status_label = "at_risk"
            else:
                status_label = "critical"

        grade = self._grade_for_score(health_score)

        # Build 7-Layer Security Checks
        checks: List[Dict[str, Any]] = []
        checks_passed = 0

        for c_meta in self.categories_meta:
            c_id = c_meta["id"]
            alerts_for_cat = category_counts.get(c_id, 0)

            if not analyses:
                check_status = "pending"
                desc = "Awaiting first PR security scan"
                checks_passed += 1
            elif alerts_for_cat == 0:
                check_status = "passed"
                desc = c_meta["pass_msg"]
                checks_passed += 1
            else:
                # Find if any open finding in this category is high
                has_high = any(
                    f.get("severity", "").lower() == "high"
                    for f in open_findings
                    if self._normalize_category(f.get("category", "")) == c_id
                )
                check_status = "failed" if has_high else "warning"
                desc = f"{alerts_for_cat} alert(s): {c_meta['fail_msg']}"

            checks.append({
                "id": c_id,
                "layer": c_meta["layer"],
                "name": c_meta["name"],
                "status": check_status,
                "alerts_count": alerts_for_cat,
                "description": desc,
            })

        # Top risk summary
        if high_count > 0:
            top_risk = f"{high_count} unresolved high-severity vulnerabilities require review."
        elif breaking_contracts > 0:
            top_risk = f"{breaking_contracts} breaking API contract regression(s) detected."
        elif medium_count > 0:
            top_risk = f"{medium_count} medium-risk findings identified."
        elif not analyses:
            top_risk = "Ready for first pull request analysis."
        else:
            top_risk = "All 7 security layers passed with zero open critical issues."

        return {
            "repo_id": str(repo.get("id", "")),
            "repo_name": repo.get("name", ""),
            "repo_full_name": repo.get("full_name", ""),
            "owner": repo.get("owner", ""),
            "is_private": repo.get("is_private", False),
            "default_branch": repo.get("default_branch", "main"),
            "health_score": health_score,
            "health_grade": grade,
            "status": status_label,
            "checks": checks,
            "checks_passed_count": checks_passed,
            "total_checks_count": len(self.categories_meta),
            "open_findings_count": len(open_findings),
            "high_severity_count": high_count,
            "medium_severity_count": medium_count,
            "low_severity_count": low_count,
            "breaking_contracts_count": breaking_contracts,
            "test_evidence_gaps_count": test_gaps_count,
            "total_prs_analyzed": len(analyses),
            "clean_prs_count": clean_prs,
            "flagged_prs_count": flagged_prs,
            "last_scan_at": last_scan_at,
            "last_pr_number": last_pr_number,
            "last_pr_title": last_pr_title,
            "top_risk_summary": top_risk,
            "category_alert_counts": category_counts,
        }

    def _normalize_category(self, cat_str: str) -> str:
        """Map raw finding category enum string to one of the 7 canonical IDs."""
        norm = cat_str.lower().replace("findingcategory.", "").replace("category.", "")
        if "secret" in norm:
            return "secrets"
        if "inject" in norm or "xss" in norm or "sqli" in norm:
            return "injection"
        if "auth" in norm or "idor" in norm:
            return "authorization"
        if "path" in norm or "traversal" in norm or "ssrf" in norm or "input" in norm:
            return "input_validation"
        if "config" in norm or "cors" in norm:
            return "configuration"
        if "depend" in norm:
            return "dependency"
        if "contract" in norm or "field" in norm or "model" in norm or "route" in norm or "consumer" in norm:
            return "api_contract"
        return "injection"

    def _grade_for_score(self, score: float) -> str:
        if score >= 95.0:
            return "A+"
        if score >= 88.0:
            return "A"
        if score >= 78.0:
            return "B"
        if score >= 65.0:
            return "C"
        if score >= 50.0:
            return "D"
        return "F"


security_posture_service = SecurityPostureService()
