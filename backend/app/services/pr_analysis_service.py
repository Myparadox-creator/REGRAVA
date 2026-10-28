"""
Pull-Request Analysis Orchestrator for REGRAVA.
Combines security AST checks (Secrets, Injection, Authorization, SSRF, Path Traversal)
with API contract regression analysis (FastAPI/Pydantic/TypeScript) and test evidence discovery.
"""

import time
import uuid
from typing import Dict, List, Optional, Any
from app.analyzer.contract_comparator import ContractComparator
from app.analyzer.contract_extractor import ContractExtractor
from app.analyzer.dependency_analyzer import DependencyAnalyzer
from app.analyzer.risk_assessor import RiskAssessor
from app.analyzer.security_analyzer import SecurityAnalyzer
from app.analyzer.test_evidence import TestEvidenceAnalyzer
from app.analyzer.typescript_parser import TypeScriptParser
from app.db.session_db import db
from app.models.finding import Finding, Severity, TestEvidenceStatus
from app.services.github_service import github_service


class PRAnalysisService:
    def __init__(self):
        self.security_analyzer = SecurityAnalyzer()
        self.contract_extractor = ContractExtractor()
        self.contract_comparator = ContractComparator()
        self.ts_parser = TypeScriptParser()

    async def analyze_pull_request(
        self,
        user_id: str,
        repo_name: str,
        pr_number: int,
    ) -> Dict[str, Any]:
        start_time = time.perf_counter()
        analysis_id = str(uuid.uuid4())

        # 1. Fetch PR details and changed files
        pr_data = await github_service.get_pull_request_files(user_id, repo_name, pr_number)
        files = pr_data.get("files", [])

        all_findings: List[Finding] = []
        warnings: List[str] = []

        # 2. Run Security Checks on all changed files
        for f in files:
            file_name = f.get("filename", "")
            head_content = f.get("head_content", "")
            if head_content:
                sec_findings = self.security_analyzer.analyze_file(file_name, head_content)
                all_findings.extend(sec_findings)

        # 3. Run API Contract & Regression Analysis
        base_py_files: Dict[str, str] = {}
        head_py_files: Dict[str, str] = {}
        head_ts_files: Dict[str, str] = {}
        test_py_files: Dict[str, str] = {}

        for f in files:
            fname = f.get("filename", "")
            base_c = f.get("base_content", "")
            head_c = f.get("head_content", "")

            if fname.endswith(".py"):
                if base_c:
                    base_py_files[fname] = base_c
                if head_c:
                    head_py_files[fname] = head_c
                if "test_" in fname or "_test.py" in fname:
                    test_py_files[fname] = head_c
            elif fname.endswith((".ts", ".tsx", ".js", ".jsx")):
                if head_c:
                    head_ts_files[fname] = head_c

        contract_diff_summary = {
            "fields_removed": [],
            "fields_added": [],
            "fields_type_changed": [],
            "routes_removed": [],
        }

        if base_py_files and head_py_files:
            base_snapshot = self.contract_extractor.extract_from_files(base_py_files, revision=pr_data.get("base_ref"))
            head_snapshot = self.contract_extractor.extract_from_files(head_py_files, revision=pr_data.get("head_ref"))
            comparison = self.contract_comparator.compare(base_snapshot, head_snapshot)

            ts_analysis = self.ts_parser.parse_files(head_ts_files) if head_ts_files else self.ts_parser.parse_files({})
            warnings.extend(ts_analysis.warnings)

            dep_analyzer = DependencyAnalyzer(ts_analysis)
            test_analyzer = TestEvidenceAnalyzer(test_py_files, ts_analysis)
            risk_assessor = RiskAssessor(
                base_snapshot=base_snapshot,
                head_snapshot=head_snapshot,
                dependency_analyzer=dep_analyzer,
                test_analyzer=test_analyzer,
            )

            regression_findings = risk_assessor.assess(comparison)
            all_findings.extend(regression_findings)

            contract_diff_summary = {
                "fields_removed": [c.field_name for c in comparison.changes if c.change_type == "field_removed" and c.field_name],
                "fields_added": [c.field_name for c in comparison.changes if c.change_type == "field_added" and c.field_name],
                "fields_type_changed": [c.field_name for c in comparison.changes if c.change_type == "type_changed" and c.field_name],
                "routes_removed": [c.route_path for c in comparison.changes if c.change_type == "route_removed" and c.route_path],
            }

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        # 4. Compute Metrics
        high_cnt = sum(1 for f in all_findings if f.severity == Severity.HIGH)
        med_cnt = sum(1 for f in all_findings if f.severity == Severity.MEDIUM)
        low_cnt = sum(1 for f in all_findings if f.severity == Severity.LOW)
        info_cnt = sum(1 for f in all_findings if f.severity == Severity.INFO)

        sec_cnt = sum(1 for f in all_findings if f.category in [
            "secrets", "injection", "authorization", "input_validation", "configuration", "dependency"
        ])
        reg_cnt = sum(1 for f in all_findings if f.category in [
            "api_contract", "removed_field", "type_mismatch", "removed_route", "param_change", "frontend_consumer_risk"
        ])

        consumers_cnt = sum(1 for f in all_findings if f.affected_file is not None)
        test_gaps_cnt = sum(
            1 for f in all_findings
            if f.test_evidence in [TestEvidenceStatus.NOT_FOUND_BY_ANALYZER, TestEvidenceStatus.UNKNOWN]
            and f.severity in [Severity.HIGH, Severity.MEDIUM]
        )

        metrics = {
            "total_findings": len(all_findings),
            "high_severity_count": high_cnt,
            "medium_severity_count": med_cnt,
            "low_severity_count": low_cnt,
            "info_severity_count": info_cnt,
            "security_findings_count": sec_cnt,
            "regression_findings_count": reg_cnt,
            "affected_consumers_count": consumers_cnt,
            "test_evidence_gaps": test_gaps_cnt,
            "files_analyzed": len(files),
        }

        # Convert findings to JSON serializable dicts
        findings_dicts = [f.model_dump() for f in all_findings]
        for f in findings_dicts:
            f["review_status"] = "open"

        summary = {
            "pr_number": pr_number,
            "pr_title": pr_data.get("title", ""),
            "author": pr_data.get("author", ""),
            "base_ref": pr_data.get("base_ref", "main"),
            "head_ref": pr_data.get("head_ref", "HEAD"),
            "contract_diff": contract_diff_summary,
            "warnings": warnings,
        }

        # 5. Persist to database
        db.save_pr_analysis(
            analysis_id=analysis_id,
            user_id=user_id,
            repo_name=repo_name,
            pr_number=pr_number,
            pr_title=pr_data.get("title", f"PR #{pr_number}"),
            base_ref=pr_data.get("base_ref", "main"),
            head_ref=pr_data.get("head_ref", "HEAD"),
            status="completed",
            findings=findings_dicts,
            metrics=metrics,
            summary=summary,
            execution_time_ms=elapsed_ms,
        )

        return {
            "id": analysis_id,
            "repo_name": repo_name,
            "pr_number": pr_number,
            "pr_title": pr_data.get("title"),
            "author": pr_data.get("author"),
            "author_avatar": pr_data.get("author_avatar"),
            "base_ref": pr_data.get("base_ref"),
            "head_ref": pr_data.get("head_ref"),
            "status": "completed",
            "metrics": metrics,
            "findings": findings_dicts,
            "summary": summary,
            "changed_files": [f["filename"] for f in files],
            "execution_time_ms": elapsed_ms,
        }


pr_analysis_service = PRAnalysisService()
