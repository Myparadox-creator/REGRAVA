"""
Unified analysis service for RepoSentinel.
Orchestrates Git reading, AST parsing, contract extraction, comparison,
frontend dependency tracking, test discovery, and finding generation.
"""

import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
from app.analyzer.contract_comparator import ContractComparator
from app.analyzer.contract_extractor import ContractExtractor
from app.analyzer.dependency_analyzer import DependencyAnalyzer
from app.analyzer.git_reader import GitReader, InvalidRepositoryError, InvalidRevisionError
from app.analyzer.risk_assessor import RiskAssessor
from app.analyzer.test_evidence import TestEvidenceAnalyzer
from app.analyzer.typescript_parser import TypeScriptParser
from app.config import settings
from app.models.analysis import (
    AnalysisMetrics,
    AnalysisResult,
    AnalysisStatus,
    ContractDiffSummary,
)
from app.models.finding import Finding, Severity, TestEvidenceStatus


class SecurityError(Exception):
    """Raised when an operation violates security boundaries."""
    pass


class AnalysisService:
    def __init__(self):
        self.ts_parser = TypeScriptParser()
        self.contract_extractor = ContractExtractor()
        self.contract_comparator = ContractComparator()
        # In-memory storage for analysis results
        self.results_store: Dict[str, AnalysisResult] = {}

    def validate_workspace_path(self, target_path: Path) -> Path:
        """
        Verify that the requested path is strictly located within the configured
        workspaces directory or examples directory. Protects against path traversal.
        """
        resolved = target_path.resolve()
        allowed_roots = [
            settings.WORKSPACES_DIR.resolve(),
            settings.EXAMPLES_DIR.resolve(),
        ]

        # Check symlink or path traversal
        is_safe = any(
            resolved == root or resolved.is_relative_to(root)
            for root in allowed_roots
        )
        if not is_safe:
            raise SecurityError(
                f"Access denied: Path '{target_path}' is outside permitted workspace roots: "
                f"{[str(r) for r in allowed_roots]}"
            )
        return resolved

    def analyze_git_repository(
        self,
        repo_path: Path,
        base_ref: str,
        head_ref: str,
        target_name: Optional[str] = None,
    ) -> AnalysisResult:
        """Analyze a Git repository comparing base_ref and head_ref."""
        start_time = time.perf_counter()
        analysis_id = str(uuid.uuid4())
        warnings: List[str] = []

        reader = GitReader(
            repo_path=repo_path,
            max_file_size=settings.MAX_FILE_SIZE_BYTES,
            timeout_seconds=settings.COMMAND_TIMEOUT_SECONDS,
        )

        # Verify revisions
        base_commit = reader.verify_revision(base_ref)
        head_commit = reader.verify_revision(head_ref)

        # List changed files
        changed_files = reader.get_changed_files(base_ref, head_ref)

        # Collect Python source files
        base_py_files = reader.list_files_at_revision(base_ref, extensions=[".py"])
        head_py_files = reader.list_files_at_revision(head_ref, extensions=[".py"])

        base_py_content: Dict[str, str] = {}
        for p in base_py_files:
            c = reader.read_file_at_revision(base_ref, p)
            if c is not None:
                base_py_content[p] = c

        head_py_content: Dict[str, str] = {}
        for p in head_py_files:
            c = reader.read_file_at_revision(head_ref, p)
            if c is not None:
                head_py_content[p] = c

        # Collect TypeScript / TSX files from head
        head_ts_files = reader.list_files_at_revision(
            head_ref, extensions=[".ts", ".tsx", ".js", ".jsx"]
        )
        head_ts_content: Dict[str, str] = {}
        for p in head_ts_files:
            if "/node_modules/" in p or "/dist/" in p or "/build/" in p:
                continue
            c = reader.read_file_at_revision(head_ref, p)
            if c is not None:
                head_ts_content[p] = c

        # Extract API contracts
        base_snapshot = self.contract_extractor.extract_from_files(
            base_py_content, revision=base_ref
        )
        head_snapshot = self.contract_extractor.extract_from_files(
            head_py_content, revision=head_ref
        )
        warnings.extend(base_snapshot.warnings)
        warnings.extend(head_snapshot.warnings)

        # Compare contracts
        comparison = self.contract_comparator.compare(base_snapshot, head_snapshot)

        # Parse TypeScript
        ts_analysis = self.ts_parser.parse_files(head_ts_content)
        warnings.extend(ts_analysis.warnings)

        # Collect test files (Python tests)
        python_test_files = {
            p: c
            for p, c in head_py_content.items()
            if "test_" in p or "_test.py" in p or "/tests/" in p
        }

        # Initialize analyzers
        dependency_analyzer = DependencyAnalyzer(ts_analysis)
        test_analyzer = TestEvidenceAnalyzer(python_test_files, ts_analysis)
        risk_assessor = RiskAssessor(
            base_snapshot=base_snapshot,
            head_snapshot=head_snapshot,
            dependency_analyzer=dependency_analyzer,
            test_analyzer=test_analyzer,
        )

        findings = risk_assessor.assess(comparison)

        # Compute metrics & diff summary
        result = self._build_result(
            analysis_id=analysis_id,
            target_name=target_name or repo_path.name,
            base_ref=base_ref,
            head_ref=head_ref,
            findings=findings,
            comparison=comparison,
            files_analyzed=len(set(list(base_py_files) + list(head_py_files) + list(head_ts_files))),
            warnings=warnings,
            start_time=start_time,
        )

        self.results_store[analysis_id] = result
        return result

    def analyze_directories(
        self,
        base_dir: Path,
        head_dir: Path,
        target_name: str,
        base_label: str = "base",
        head_label: str = "head",
    ) -> AnalysisResult:
        """
        Analyze two directory trees statically.
        Used for reproducible scenario evaluations and folder comparisons.
        """
        start_time = time.perf_counter()
        analysis_id = str(uuid.uuid4())
        warnings: List[str] = []

        base_py_content = self._read_dir_files(base_dir, [".py"])
        head_py_content = self._read_dir_files(head_dir, [".py"])
        head_ts_content = self._read_dir_files(head_dir, [".ts", ".tsx", ".js", ".jsx"])

        # Extract contracts
        base_snapshot = self.contract_extractor.extract_from_files(
            base_py_content, revision=base_label
        )
        head_snapshot = self.contract_extractor.extract_from_files(
            head_py_content, revision=head_label
        )
        warnings.extend(base_snapshot.warnings)
        warnings.extend(head_snapshot.warnings)

        # Compare contracts
        comparison = self.contract_comparator.compare(base_snapshot, head_snapshot)

        # Parse TypeScript
        ts_analysis = self.ts_parser.parse_files(head_ts_content)
        warnings.extend(ts_analysis.warnings)

        # Collect test files
        python_test_files = {
            p: c
            for p, c in head_py_content.items()
            if "test_" in p or "_test.py" in p or "/tests/" in p
        }

        # Dependencies & Tests
        dependency_analyzer = DependencyAnalyzer(ts_analysis)
        test_analyzer = TestEvidenceAnalyzer(python_test_files, ts_analysis)
        risk_assessor = RiskAssessor(
            base_snapshot=base_snapshot,
            head_snapshot=head_snapshot,
            dependency_analyzer=dependency_analyzer,
            test_analyzer=test_analyzer,
        )

        findings = risk_assessor.assess(comparison)

        total_files = len(set(list(base_py_content.keys()) + list(head_py_content.keys()) + list(head_ts_content.keys())))
        result = self._build_result(
            analysis_id=analysis_id,
            target_name=target_name,
            base_ref=base_label,
            head_ref=head_label,
            findings=findings,
            comparison=comparison,
            files_analyzed=total_files,
            warnings=warnings,
            start_time=start_time,
        )

        self.results_store[analysis_id] = result
        return result

    def _read_dir_files(self, base_dir: Path, extensions: List[str]) -> Dict[str, str]:
        """Read source files matching extensions from directory tree."""
        files_dict: Dict[str, str] = {}
        if not base_dir.exists():
            return files_dict

        for root, dirs, files in os.walk(base_dir):
            # Prune unwanted directories
            dirs[:] = [d for d in dirs if d not in {".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build"}]
            for file in files:
                if any(file.endswith(ext) for ext in extensions):
                    full_p = Path(root) / file
                    try:
                        if full_p.stat().st_size <= settings.MAX_FILE_SIZE_BYTES:
                            rel_p = str(full_p.relative_to(base_dir)).replace("\\", "/")
                            with open(full_p, "r", encoding="utf-8", errors="replace") as f:
                                files_dict[rel_p] = f.read()
                    except Exception:
                        pass
        return files_dict

    def _build_result(
        self,
        analysis_id: str,
        target_name: str,
        base_ref: str,
        head_ref: str,
        findings: List[Finding],
        comparison: Any,
        files_analyzed: int,
        warnings: List[str],
        start_time: float,
    ) -> AnalysisResult:
        elapsed = (time.perf_counter() - start_time) * 1000.0

        # Metrics
        high_cnt = sum(1 for f in findings if f.severity == Severity.HIGH)
        med_cnt = sum(1 for f in findings if f.severity == Severity.MEDIUM)
        low_cnt = sum(1 for f in findings if f.severity == Severity.LOW)
        info_cnt = sum(1 for f in findings if f.severity == Severity.INFO)
        consumers_cnt = sum(1 for f in findings if f.affected_file is not None)
        test_gaps_cnt = sum(
            1 for f in findings
            if f.test_evidence in (TestEvidenceStatus.NOT_FOUND_BY_ANALYZER, TestEvidenceStatus.UNKNOWN)
            and f.severity in (Severity.HIGH, Severity.MEDIUM)
        )

        # Diff summary
        cd = ContractDiffSummary(
            routes_added=[c.route_path for c in comparison.changes if c.change_type == "route_added" and c.route_path],
            routes_removed=[c.route_path for c in comparison.changes if c.change_type == "route_removed" and c.route_path],
            models_modified=list(set(c.model_name for c in comparison.changes if c.model_name)),
            fields_removed=[c.field_name for c in comparison.changes if c.change_type == "field_removed" and c.field_name],
            fields_added=[c.field_name for c in comparison.changes if c.change_type == "field_added" and c.field_name],
            fields_type_changed=[c.field_name for c in comparison.changes if c.change_type == "type_changed" and c.field_name],
        )

        metrics = AnalysisMetrics(
            total_findings=len(findings),
            high_severity_count=high_cnt,
            medium_severity_count=med_cnt,
            low_severity_count=low_cnt,
            info_severity_count=info_cnt,
            breaking_contract_changes=len(comparison.breaking_changes),
            affected_consumers_identified=consumers_cnt,
            test_evidence_gaps=test_gaps_cnt,
            files_analyzed=files_analyzed,
            warnings_count=len(warnings),
        )

        status = AnalysisStatus.COMPLETED if not warnings else AnalysisStatus.PARTIAL

        return AnalysisResult(
            analysis_id=analysis_id,
            target_name=target_name,
            base_ref=base_ref,
            head_ref=head_ref,
            status=status,
            created_at=datetime.now(timezone.utc).isoformat(),
            metrics=metrics,
            findings=findings,
            contract_diff=cd,
            warnings=warnings,
            execution_time_ms=elapsed,
        )


analysis_service = AnalysisService()
