"""
REGRAVA Native GitHub PR Review Orchestrator Service.
Coordinates strict repository authorization, full PR diff + context retrieval,
deterministic AST security & contract regression analysis, deduplication,
GitHub App review publication, and cross-commit finding lifecycle tracking.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set
from app.analyzer.contract_comparator import ContractComparator
from app.analyzer.contract_extractor import ContractExtractor
from app.analyzer.dependency_analyzer import DependencyAnalyzer
from app.analyzer.risk_assessor import RiskAssessor
from app.analyzer.security_analyzer import SecurityAnalyzer
from app.analyzer.test_evidence import TestEvidenceAnalyzer
from app.analyzer.typescript_parser import TypeScriptParser
from app.config import settings
from app.db.session_db import db
from app.models.finding import Finding, Severity, TestEvidenceStatus
from app.services.github_app_service import GitHubAppError, github_app_auth
from app.services.pull_request_diff_service import pr_diff_service
from app.services.review_deduplication_service import review_deduplication_service
from app.services.review_formatter import build_github_review_payload, compute_finding_fingerprint
from app.services.review_lifecycle_service import review_lifecycle_service
from app.services.review_publisher_service import StaleAnalysisError, review_publisher

logger = logging.getLogger(__name__)


class RegravaReviewService:
    """Orchestrates end-to-end PR review analysis and GitHub publication."""

    def __init__(self) -> None:
        self.security_analyzer = SecurityAnalyzer()
        self.contract_extractor = ContractExtractor()
        self.contract_comparator = ContractComparator()
        self.ts_parser = TypeScriptParser()

    def _append_step(self, steps: List[Dict[str, Any]], label: str, status: str = "done") -> List[Dict[str, Any]]:
        steps.append({
            "label": label,
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return steps

    def authorize_and_create_job(
        self,
        user_id: Optional[str],
        owner: str,
        repo: str,
        pr_number: int,
        dry_run: bool = False,
        mode: str = "manual",
    ) -> Dict[str, Any]:
        """
        Validate authorization synchronously before starting asynchronous review work.
        Raises PermissionError if user is not allowed to review this repository.
        """
        full_name = f"{owner}/{repo}"
        if user_id and mode == "manual":
            pr_diff_service.verify_user_authorization(user_id, full_name)

        job_id = f"job-{uuid.uuid4().hex[:12]}"
        steps = self._append_step([], "Review job initialized", status="done")
        return db.create_review_job(
            job_id=job_id,
            user_id=user_id or "github-webhook",
            repo_full_name=full_name,
            pr_number=pr_number,
            state="in_progress",
            dry_run=dry_run,
            steps=steps,
        )

    async def execute_review_job(
        self,
        job_id: str,
        user_id: Optional[str],
        owner: str,
        repo: str,
        pr_number: int,
        installation_id: Optional[str] = None,
        force_re_review: bool = False,
        dry_run: bool = False,
        mode: str = "manual",
        triggered_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Execute the full review pipeline and persist step-by-step state updates."""
        full_name = f"{owner}/{repo}"
        steps: List[Dict[str, Any]] = []
        job_rec = db.get_review_job(job_id)
        if job_rec:
            steps = list(job_rec.get("steps", []))

        try:
            # --- Stage 1: Collecting PR Changes ---
            db.update_review_job(job_id, state="collecting_pr_changes", steps=steps)
            pr_context = await pr_diff_service.fetch_pr_context(
                user_id=user_id,
                owner=owner,
                repo=repo,
                pr_number=pr_number,
                installation_id=installation_id,
            )
            head_sha = pr_context["head_sha"]
            repo_id = pr_context.get("repo_id")
            self._append_step(steps, "Pull Request retrieved")
            self._append_step(steps, f"Changed files collected ({len(pr_context.get('files', []))} files)")
            db.update_review_job(
                job_id,
                state="running_security_checks",
                head_sha=head_sha,
                repo_id=repo_id,
                steps=steps,
            )

            # --- Stage 2: Running Security & Regression Checks (reusing existing analyzers) ---
            start_time = time.perf_counter()
            files = pr_context.get("files", [])
            context_files: Dict[str, str] = pr_context.get("context_files", {})

            # Combine head contents + surrounding context for cross-file context inspection
            combined_context: Dict[str, str] = dict(context_files)
            for f in files:
                if f.get("head_content"):
                    combined_context[f["filename"]] = f["head_content"]

            all_findings: List[Finding] = []
            warnings: List[str] = []

            for f in files:
                fname = f.get("filename", "")
                head_c = f.get("head_content", "")
                if head_c:
                    sec_findings = self.security_analyzer.analyze_file(
                        fname, head_c, context_files=combined_context
                    )
                    all_findings.extend(sec_findings)

            # Contract & Regression Analysis
            base_py_files: Dict[str, str] = {}
            head_py_files: Dict[str, str] = {}
            head_ts_files: Dict[str, str] = {}
            test_py_files: Dict[str, str] = {}

            for path, content in context_files.items():
                if path.endswith(".py"):
                    base_py_files[path] = content
                    head_py_files[path] = content
                    if "test_" in path or "_test.py" in path or "/tests/" in path:
                        test_py_files[path] = content
                elif path.endswith((".ts", ".tsx", ".js", ".jsx")):
                    head_ts_files[path] = content

            for f in files:
                fname = f.get("filename", "")
                base_c = f.get("base_content", "")
                head_c = f.get("head_content", "")
                if fname.endswith(".py"):
                    if base_c:
                        base_py_files[fname] = base_c
                    if head_c:
                        head_py_files[fname] = head_c
                    if head_c and ("test_" in fname or "_test.py" in fname or "/tests/" in fname):
                        test_py_files[fname] = head_c
                elif fname.endswith((".ts", ".tsx", ".js", ".jsx")) and head_c:
                    head_ts_files[fname] = head_c

            contract_diff_summary: Dict[str, Any] = {
                "fields_removed": [],
                "fields_added": [],
                "fields_type_changed": [],
                "routes_removed": [],
            }

            if base_py_files and head_py_files:
                base_snapshot = self.contract_extractor.extract_from_files(
                    base_py_files, revision=pr_context.get("base_ref")
                )
                head_snapshot = self.contract_extractor.extract_from_files(
                    head_py_files, revision=pr_context.get("head_ref")
                )
                comparison = self.contract_comparator.compare(base_snapshot, head_snapshot)
                ts_analysis = self.ts_parser.parse_files(head_ts_files)
                warnings.extend(ts_analysis.warnings)

                dep_analyzer = DependencyAnalyzer(ts_analysis)
                test_analyzer = TestEvidenceAnalyzer(test_py_files, ts_analysis)
                risk_assessor = RiskAssessor(
                    base_snapshot=base_snapshot,
                    head_snapshot=head_snapshot,
                    dependency_analyzer=dep_analyzer,
                    test_analyzer=test_analyzer,
                )
                reg_findings = risk_assessor.assess(comparison)
                all_findings.extend(reg_findings)

                contract_diff_summary = {
                    "fields_removed": [c.field_name for c in comparison.changes if c.change_type == "field_removed" and c.field_name],
                    "fields_added": [c.field_name for c in comparison.changes if c.change_type == "field_added" and c.field_name],
                    "fields_type_changed": [c.field_name for c in comparison.changes if c.change_type == "type_changed" and c.field_name],
                    "routes_removed": [c.route_path for c in comparison.changes if c.change_type == "route_removed" and c.route_path],
                }

            elapsed_ms = (time.perf_counter() - start_time) * 1000.0
            self._append_step(steps, "Security checks completed")
            self._append_step(steps, "API compatibility checked")

            # Build metrics & save canonical PR analysis record so dashboard == GitHub review
            analysis_id = str(uuid.uuid4())
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

            findings_dicts = [f.model_dump(mode="json") for f in all_findings]
            for f in findings_dicts:
                f["review_status"] = "open"
                f["fingerprint"] = compute_finding_fingerprint(f)

            summary = {
                "pr_number": pr_number,
                "pr_title": pr_context.get("title", ""),
                "author": pr_context.get("author", ""),
                "base_ref": pr_context.get("base_ref", "main"),
                "head_ref": pr_context.get("head_ref", "HEAD"),
                "head_sha": head_sha,
                "contract_diff": contract_diff_summary,
                "warnings": warnings,
            }

            db.save_pr_analysis(
                analysis_id=analysis_id,
                user_id=user_id or "github-webhook",
                repo_name=full_name,
                pr_number=pr_number,
                pr_title=pr_context.get("title", f"PR #{pr_number}"),
                base_ref=pr_context.get("base_ref", "main"),
                head_ref=pr_context.get("head_ref", "HEAD"),
                status="completed",
                findings=findings_dicts,
                metrics=metrics,
                summary=summary,
                execution_time_ms=elapsed_ms,
            )

            # --- Stage 3: Generating Review & Checking Deduplication ---
            db.update_review_job(
                job_id, state="generating_review", steps=steps, analysis_id=analysis_id
            )

            repo_cfg = db.get_repo_settings(full_name)
            threshold = repo_cfg.get("confidence_threshold") or settings.REVIEW_CONFIDENCE_THRESHOLD

            # Compute actionable fingerprints meeting threshold
            actionable_fps = [
                f["fingerprint"] for f in findings_dicts
            ]

            dedup_info = review_deduplication_service.check_duplicate_review(
                repo_full_name=full_name,
                repo_id=repo_id,
                pr_number=pr_number,
                head_sha=head_sha,
                fingerprints=actionable_fps,
                force_re_review=force_re_review,
            )

            if dedup_info["is_duplicate"] and dedup_info["existing_review"]:
                existing_rev = dedup_info["existing_review"]
                self._append_step(steps, "Findings organized")
                self._append_step(steps, "Already reviewed for this commit (duplicate skipped)")
                return db.update_review_job(
                    job_id,
                    state="already_reviewed",
                    steps=steps,
                    analysis_id=analysis_id,
                    review_record_id=existing_rev["id"],
                )

            review_payload = build_github_review_payload(
                pr_context=pr_context,
                analysis_result={
                    "findings": findings_dicts,
                    "metrics": metrics,
                    "head_ref": pr_context.get("head_ref"),
                },
                confidence_threshold=threshold,
                skip_fingerprints=dedup_info["already_published_fingerprints"],
                is_update_review=dedup_info["has_prior_review_on_commit"],
            )
            self._append_step(steps, "Findings organized")

            # --- Stage 4: Publishing Review to GitHub ---
            db.update_review_job(job_id, state="publishing_review", steps=steps)

            use_dry_run = dry_run or pr_context.get("is_demo", False) or not github_app_auth.is_configured()
            review_record = await review_publisher.publish_review(
                repo_full_name=full_name,
                repo_id=repo_id,
                pr_number=pr_number,
                head_sha=head_sha,
                analysis_id=analysis_id,
                dedup_key=dedup_info["dedup_key"],
                review_payload=review_payload,
                installation_id=pr_context.get("installation_id"),
                mode=mode,
                triggered_by=triggered_by or user_id,
                dry_run=use_dry_run,
            )

            # Reconcile finding lifecycle across commits
            changed_paths: Set[str] = {f["filename"] for f in files if f.get("filename")}
            comments_map = {
                c["fingerprint"]: c.get("github_comment_id")
                for c in review_record.get("inline_comments", [])
                if c.get("fingerprint") and c.get("github_comment_id")
            }
            review_lifecycle_service.reconcile_findings_for_commit(
                repo_full_name=full_name,
                repo_id=repo_id,
                pr_number=pr_number,
                head_sha=head_sha,
                findings=findings_dicts,
                changed_file_paths=changed_paths,
                review_record=review_record,
                published_comments_map=comments_map,
            )

            if review_record.get("publication_status") == "published":
                self._append_step(steps, "Review published to GitHub")
                final_state = "published"
            else:
                self._append_step(steps, "Dry-run review payload prepared (not published to GitHub)")
                final_state = "dry_run"

            return db.update_review_job(
                job_id,
                state=final_state,
                steps=steps,
                analysis_id=analysis_id,
                review_record_id=review_record["id"],
                dry_run=(final_state == "dry_run"),
            )

        except StaleAnalysisError as stale_err:
            self._append_step(steps, f"Discarded stale analysis: {stale_err}", status="error")
            return db.update_review_job(
                job_id,
                state="failed",
                steps=steps,
                error_message=str(stale_err),
            )
        except (PermissionError, FileNotFoundError, GitHubAppError) as app_err:
            msg = getattr(app_err, "message", str(app_err))
            self._append_step(steps, f"Review failed: {msg}", status="error")
            return db.update_review_job(
                job_id,
                state="failed",
                steps=steps,
                error_message=msg,
            )
        except Exception as exc:
            logger.exception("Unexpected error in REGRAVA PR review job %s", job_id)
            err_msg = f"Review execution failed: {type(exc).__name__}: {str(exc)}"
            self._append_step(steps, err_msg, status="error")
            return db.update_review_job(
                job_id,
                state="failed",
                steps=steps,
                error_message=err_msg,
            )


regrava_review_service = RegravaReviewService()
