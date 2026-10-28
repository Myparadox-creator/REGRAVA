"""
Test evidence discovery for RepoSentinel.
Statically discovers test definitions in Python and TypeScript/TSX test files
and checks for references to affected routes, models, fields, or consumers.
"""

import ast
from typing import Dict, List, Optional
from app.analyzer.typescript_parser import TSAnalysisResult, TSFrontendTest
from app.models.finding import TestEvidenceItem, TestEvidenceStatus


class TestEvidenceAnalyzer:
    def __init__(
        self,
        python_test_files: Dict[str, str],
        ts_analysis: TSAnalysisResult,
    ):
        self.python_test_files = python_test_files
        self.ts_analysis = ts_analysis

    def find_evidence_for_change(
        self,
        route_path: Optional[str] = None,
        field_name: Optional[str] = None,
        model_name: Optional[str] = None,
        consumer_file: Optional[str] = None,
    ) -> tuple[TestEvidenceStatus, List[TestEvidenceItem]]:
        """
        Search Python and TypeScript test suites for references to the changed elements.
        """
        items: List[TestEvidenceItem] = []
        has_tests_available = bool(self.python_test_files) or bool(self.ts_analysis.tests)

        if not has_tests_available:
            return TestEvidenceStatus.NOT_FOUND_BY_ANALYZER, []

        targets = [t for t in [route_path, field_name, model_name] if t]
        if not targets:
            return TestEvidenceStatus.UNKNOWN, []

        # 1. Search Python test files
        for test_path, code in self.python_test_files.items():
            norm_path = test_path.replace("\\", "/")
            try:
                tree = ast.parse(code, filename=norm_path)
            except Exception:
                continue

            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    if node.name.startswith("test_") or "_test" in node.name:
                        func_code = ast.get_source_segment(code, node) or ""
                        # Check if any target is referenced in this test function
                        for target in targets:
                            # Match route path or field name in string or attribute
                            if target in func_code:
                                items.append(
                                    TestEvidenceItem(
                                        file_path=norm_path,
                                        test_name=node.name,
                                        line=node.lineno,
                                        matched_target=target,
                                        description=(
                                            f"Python test '{node.name}' references '{target}'"
                                        ),
                                    )
                                )

        # 2. Search Frontend test files
        # Check tests extracted from TS/TSX test files
        for test_item in self.ts_analysis.tests:
            # Check test name or suite name
            for target in targets:
                if (
                    target.lower() in test_item.test_name.lower()
                    or (test_item.suite_name and target.lower() in test_item.suite_name.lower())
                ):
                    items.append(
                        TestEvidenceItem(
                            file_path=test_item.file,
                            test_name=test_item.test_name,
                            line=test_item.line,
                            matched_target=target,
                            description=(
                                f"Frontend test '{test_item.test_name}' matches '{target}'"
                            ),
                        )
                    )

        if items:
            return TestEvidenceStatus.FOUND, items
        return TestEvidenceStatus.NOT_FOUND_BY_ANALYZER, []
