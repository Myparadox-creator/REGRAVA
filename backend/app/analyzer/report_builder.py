"""
Report builder for RepoSentinel.
Generates human-readable terminal output, structured JSON, and GitHub-ready Markdown summaries.
"""

import json
from typing import Dict, Any
from app.models.analysis import AnalysisResult
from app.models.finding import Severity


class ReportBuilder:
    @staticmethod
    def to_json(result: AnalysisResult) -> str:
        """Serialize analysis result to indented JSON."""
        return result.model_dump_json(indent=2)

    @staticmethod
    def to_markdown(result: AnalysisResult) -> str:
        """Generate a GitHub-ready Markdown summary of the regression analysis."""
        lines = []
        lines.append(f"# 🛡️ RepoSentinel Regression Risk Report")
        lines.append("")
        lines.append(f"**Target:** `{result.target_name}` | **Revisions:** `{result.base_ref}` → `{result.head_ref}` | **Status:** `{result.status.value.upper()}`")
        lines.append("")

        # Metrics banner
        m = result.metrics
        lines.append("## 📊 Executive Summary")
        lines.append("")
        lines.append(f"| Metric | Count |")
        lines.append(f"| :--- | :--- |")
        lines.append(f"| **Breaking Contract Changes** | `{m.breaking_contract_changes}` |")
        lines.append(f"| **Affected Frontend Consumers** | `{m.affected_consumers_identified}` |")
        lines.append(f"| **High Severity Risks** | `{m.high_severity_count}` |")
        lines.append(f"| **Medium Severity Risks** | `{m.medium_severity_count}` |")
        lines.append(f"| **Test Evidence Gaps** | `{m.test_evidence_gaps}` |")
        lines.append(f"| **Files Inspected** | `{m.files_analyzed}` |")
        lines.append("")

        if m.high_severity_count > 0:
            lines.append("> [!CAUTION]")
            lines.append(f"> **Blocking Regressions Detected:** {m.high_severity_count} high-severity contract risk(s) found. Review the affected frontend consumers before merging.")
            lines.append("")
        elif m.medium_severity_count > 0:
            lines.append("> [!WARNING]")
            lines.append(f"> **Potential Contract Risks:** {m.medium_severity_count} potential risk(s) detected. Verify external consumer compatibility.")
            lines.append("")
        else:
            lines.append("> [!NOTE]")
            lines.append("> **No Breaking Regressions Detected:** Analyzed API contracts and frontend consumers are compatible.")
            lines.append("")

        # Contract Diff Summary
        cd = result.contract_diff
        if any([cd.fields_removed, cd.fields_added, cd.fields_type_changed, cd.routes_removed]):
            lines.append("## 🔍 API Contract Changes")
            lines.append("")
            if cd.fields_removed:
                lines.append(f"- **Removed Fields:** {', '.join(f'`{f}`' for f in cd.fields_removed)}")
            if cd.fields_added:
                lines.append(f"- **Added Fields:** {', '.join(f'`{f}`' for f in cd.fields_added)}")
            if cd.fields_type_changed:
                lines.append(f"- **Type Mutations:** {', '.join(f'`{f}`' for f in cd.fields_type_changed)}")
            if cd.routes_removed:
                lines.append(f"- **Removed Routes:** {', '.join(f'`{r}`' for r in cd.routes_removed)}")
            lines.append("")

        # Findings Detail
        lines.append("## 🚨 Findings & Evidence")
        lines.append("")
        if not result.findings:
            lines.append("_No regression findings generated for this revision range._")
            lines.append("")
        else:
            for f in result.findings:
                sev_icon = "🔴" if f.severity == Severity.HIGH else "🟡" if f.severity == Severity.MEDIUM else "ℹ️"
                lines.append(f"### {sev_icon} [{f.id}] {f.title}")
                lines.append("")
                lines.append(f"- **Severity:** `{f.severity.value.upper()}` | **Confidence:** `{f.confidence.value.upper()}` | **Category:** `{f.category.value}`")
                if f.changed_file:
                    lines.append(f"- **Changed File:** `{f.changed_file.path}:{f.changed_file.line}`")
                if f.affected_file:
                    lines.append(f"- **Affected Consumer:** `{f.affected_file.path}:{f.affected_file.line}`")
                    if f.affected_file.context_snippet:
                        lines.append(f"  > `{f.affected_file.context_snippet}`")
                lines.append(f"- **Test Evidence:** `{f.test_evidence.value}`")
                lines.append("")
                lines.append("**Evidence Trail:**")
                for ev in f.evidence:
                    lines.append(f"1. {ev}")
                lines.append("")
                lines.append(f"**Recommendation:** {f.recommendation}")
                lines.append("")

        # Limitations & Warnings
        if result.warnings:
            lines.append("## ⚠️ Analysis Caveats & Parser Limitations")
            lines.append("")
            for w in result.warnings:
                lines.append(f"- {w}")
            lines.append("")

        lines.append("---")
        lines.append(f"*Generated by RepoSentinel static analysis in {result.execution_time_ms:.1f}ms*")
        return "\n".join(lines)

    @staticmethod
    def to_terminal(result: AnalysisResult) -> str:
        """Produce clear ANSI terminal output for CLI."""
        lines = []
        lines.append("=" * 70)
        lines.append("  REPOSENTINEL: EVIDENCE-BASED REGRESSION RISK REPORT")
        lines.append("=" * 70)
        lines.append(f"Target:     {result.target_name}")
        lines.append(f"Revisions:  {result.base_ref} -> {result.head_ref}")
        lines.append(f"Status:     {result.status.value.upper()} ({result.execution_time_ms:.1f}ms)")
        lines.append("-" * 70)
        lines.append("SUMMARY METRICS:")
        m = result.metrics
        lines.append(f"  Breaking Contract Changes:   {m.breaking_contract_changes}")
        lines.append(f"  Affected Frontend Consumers: {m.affected_consumers_identified}")
        lines.append(f"  High Severity Risks:         {m.high_severity_count}")
        lines.append(f"  Medium Severity Risks:       {m.medium_severity_count}")
        lines.append(f"  Test Evidence Gaps:          {m.test_evidence_gaps}")
        lines.append(f"  Total Files Analyzed:        {m.files_analyzed}")
        lines.append("-" * 70)

        if not result.findings:
            lines.append("No regression risks detected.")
        else:
            lines.append("DETAILED FINDINGS:")
            for f in result.findings:
                lines.append(f"\n[{f.id}] [{f.severity.value.upper()}] {f.title}")
                lines.append(f"  Confidence: {f.confidence.value.upper()} | Category: {f.category.value}")
                if f.changed_file:
                    lines.append(f"  Changed:    {f.changed_file.path}:{f.changed_file.line}")
                if f.affected_file:
                    lines.append(f"  Affected:   {f.affected_file.path}:{f.affected_file.line} ({f.affected_file.context_snippet or ''})")
                lines.append(f"  Tests:      {f.test_evidence.value}")
                lines.append("  Evidence:")
                for ev in f.evidence:
                    lines.append(f"    - {ev}")
                lines.append(f"  Action:     {f.recommendation}")

        if result.warnings:
            lines.append("\nWARNINGS / LIMITATIONS:")
            for w in result.warnings:
                lines.append(f"  ! {w}")

        lines.append("=" * 70)
        return "\n".join(lines)
