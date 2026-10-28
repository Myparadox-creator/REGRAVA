"""
TypeScript parser interface for RepoSentinel.
Calls the TypeScript Compiler API AST extractor via Node.js subprocess.
"""

import json
import subprocess
from pathlib import Path
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from app.config import settings


class TSPropertyAccess(BaseModel):
    file: str
    line: int
    column: int
    property: str
    expression: str
    full_snippet: str


class TSTypeField(BaseModel):
    file: str
    line: int
    type_name: str
    field_name: str
    field_type: str


class TSApiEndpoint(BaseModel):
    file: str
    line: int
    endpoint: str
    method: Optional[str] = None
    call_context: str


class TSFrontendTest(BaseModel):
    file: str
    line: int
    test_name: str
    suite_name: Optional[str] = None


class TSAnalysisResult(BaseModel):
    property_accesses: List[TSPropertyAccess] = Field(default_factory=list)
    type_fields: List[TSTypeField] = Field(default_factory=list)
    api_endpoints: List[TSApiEndpoint] = Field(default_factory=list)
    tests: List[TSFrontendTest] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class TypeScriptParser:
    def __init__(self, analyzer_script_path: Optional[Path] = None):
        self.script_path = (
            analyzer_script_path
            or (settings.ANALYZER_TS_DIR / "dist" / "analyze.js")
        ).resolve()

    def parse_files(self, files: Dict[str, str]) -> TSAnalysisResult:
        """
        Takes a dict of {relative_path: source_code} for .ts/.tsx files,
        passes them via stdin to the TS analyzer, and returns structured findings.
        """
        if not files:
            return TSAnalysisResult()

        if not self.script_path.exists():
            return TSAnalysisResult(
                warnings=[f"TypeScript analyzer script not found at {self.script_path}"]
            )

        payload = {
            "files": [
                {"path": path.replace("\\", "/"), "content": content}
                for path, content in files.items()
            ]
        }

        try:
            res = subprocess.run(
                ["node", str(self.script_path), "--stdin"],
                input=json.dumps(payload),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=settings.COMMAND_TIMEOUT_SECONDS,
                check=False,
            )

            if res.returncode != 0:
                return TSAnalysisResult(
                    warnings=[f"TS analyzer exited with code {res.returncode}: {res.stderr.strip()}"]
                )

            data = json.loads(res.stdout)

            prop_accesses = [
                TSPropertyAccess(
                    file=item["file"],
                    line=item["line"],
                    column=item["column"],
                    property=item["property"],
                    expression=item["expression"],
                    full_snippet=item["fullSnippet"],
                )
                for item in data.get("propertyAccesses", [])
            ]

            type_fields = [
                TSTypeField(
                    file=item["file"],
                    line=item["line"],
                    type_name=item["typeName"],
                    field_name=item["fieldName"],
                    field_type=item["fieldType"],
                )
                for item in data.get("typeFields", [])
            ]

            endpoints = [
                TSApiEndpoint(
                    file=item["file"],
                    line=item["line"],
                    endpoint=item["endpoint"],
                    method=item.get("method"),
                    call_context=item["callContext"],
                )
                for item in data.get("apiEndpoints", [])
            ]

            tests = [
                TSFrontendTest(
                    file=item["file"],
                    line=item["line"],
                    test_name=item["testName"],
                    suite_name=item.get("suiteName"),
                )
                for item in data.get("tests", [])
            ]

            warnings = data.get("warnings", [])

            return TSAnalysisResult(
                property_accesses=prop_accesses,
                type_fields=type_fields,
                api_endpoints=endpoints,
                tests=tests,
                warnings=warnings,
            )

        except subprocess.TimeoutExpired:
            return TSAnalysisResult(
                warnings=["TypeScript analyzer execution timed out."]
            )
        except Exception as e:
            return TSAnalysisResult(
                warnings=[f"Failed to execute TypeScript parser: {str(e)}"]
            )
