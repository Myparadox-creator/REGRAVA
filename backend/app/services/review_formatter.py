"""
GitHub Pull Request Review Formatter & Fingerprint Generator for REGRAVA.
Converts REGRAVA analysis findings into concise, high-signal GitHub PR review
summaries and anchored inline comments without inventing line positions or leaking secrets.
"""

from __future__ import annotations

import hashlib
from enum import Enum
from typing import Any, Dict, List, Optional, Set
from app.config import settings
from app.services.pull_request_diff_service import DiffFileMap, map_finding_to_diff_location


_CONFIDENCE_RANK = {"high": 3, "medium": 2, "low": 1}


def _enum_str(val: Any, default: str = "") -> str:
    if val is None:
        return default
    if isinstance(val, Enum):
        return str(val.value)
    return str(val)


def compute_finding_fingerprint(finding: Dict[str, Any]) -> str:
    """
    Generate a stable fingerprint for deduplication and cross-commit tracking.
    Combines category, file path, symbol, title, and normalized code evidence.
    """
    cf = finding.get("changed_file") or {}
    af = finding.get("affected_file") or {}
    path = (cf.get("path") or finding.get("route_path") or "").replace("\\", "/")
    symbol = cf.get("symbol") or finding.get("field_name") or ""
    snippet = (af.get("context_snippet") or "").strip()
    raw = "|".join([
        _enum_str(finding.get("category", "")),
        path,
        str(symbol),
        str(finding.get("title", "")),
        str(finding.get("change_type") or ""),
        snippet[:120],
    ])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def passes_confidence_threshold(confidence: Any, threshold: Optional[str] = None) -> bool:
    conf_str = _enum_str(confidence, "medium").lower()
    thresh = (threshold or settings.REVIEW_CONFIDENCE_THRESHOLD or "medium").lower()
    return _CONFIDENCE_RANK.get(conf_str, 1) >= _CONFIDENCE_RANK.get(thresh, 2)


def _why_it_matters(finding: Dict[str, Any]) -> str:
    if finding.get("attack_scenario"):
        return str(finding["attack_scenario"]).strip()
    cat = _enum_str(finding.get("category", "")).lower()
    if cat in ("api_contract", "removed_field", "type_mismatch", "removed_route", "frontend_consumer_risk", "param_change"):
        return (
            "Dependent frontend components or external API consumers referencing the previous schema "
            "contract may experience runtime errors or undefined fields."
        )
    return "If reachable by untrusted input or unauthenticated callers, this issue may expose sensitive data or weaken application security."


def format_inline_comment(finding: Dict[str, Any]) -> str:
    """Render a concise GitHub-style inline review comment from actual finding data."""
    severity = _enum_str(finding.get("severity", "medium")).upper()
    title = str(finding.get("title", "Code Issue"))
    summary = str(finding.get("summary", "")).strip()
    why = _why_it_matters(finding)
    recommendation = str(finding.get("recommendation", "Review and remediate the flagged pattern.")).strip()
    confidence = _enum_str(finding.get("confidence", "medium")).capitalize()
    finding_id = str(finding.get("id", "RS-000"))

    confidence_note = (
        f"{confidence} *(potential risk — verify surrounding access-control context)*"
        if confidence.lower() == "medium"
        else confidence
    )

    lines = [
        f"### {severity} — {title}",
        "",
        "**Problem:**",
        summary,
        "",
        "**Why it matters:**",
        why,
        "",
        "**Recommended action:**",
        recommendation,
        "",
        f"**Confidence:** {confidence_note}",
        "",
        f"**REGRAVA finding:** `{finding_id}`",
    ]
    return "\n".join(lines)


def build_github_review_payload(
    pr_context: Dict[str, Any],
    analysis_result: Dict[str, Any],
    confidence_threshold: Optional[str] = None,
    skip_fingerprints: Optional[Set[str]] = None,
    is_update_review: bool = False,
) -> Dict[str, Any]:
    """
    Build a GitHub Pull Request Review payload (`POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews`)
    strictly using event='COMMENT' and valid diff anchors.
    """
    head_sha: str = pr_context.get("head_sha") or analysis_result.get("head_ref") or "HEAD"
    diff_maps: Dict[str, DiffFileMap] = pr_context.get("diff_maps") or {}
    findings: List[Dict[str, Any]] = analysis_result.get("findings") or []
    metrics: Dict[str, Any] = analysis_result.get("metrics") or {}

    skip_fps = skip_fingerprints or set()
    seen_in_review: Set[str] = set()

    inline_comments: List[Dict[str, Any]] = []
    unanchored_findings: List[Dict[str, Any]] = []
    dashboard_only_findings: List[Dict[str, Any]] = []
    actionable_findings: List[Dict[str, Any]] = []
    published_fingerprints: List[str] = []

    for f in findings:
        fp = f.get("fingerprint") or compute_finding_fingerprint(f)
        f["fingerprint"] = fp

        # Deduplicate within the same review and against previously published findings
        if fp in seen_in_review or fp in skip_fps:
            continue
        seen_in_review.add(fp)

        confidence = _enum_str(f.get("confidence", "medium")).lower()
        if not passes_confidence_threshold(confidence, confidence_threshold):
            dashboard_only_findings.append(f)
            continue

        actionable_findings.append(f)
        published_fingerprints.append(fp)

        cf = f.get("changed_file") or {}
        anchor = map_finding_to_diff_location(
            diff_maps=diff_maps,
            file_path=cf.get("path"),
            line_number=cf.get("line"),
            head_sha=head_sha,
            change_type=f.get("change_type"),
        )

        if anchor:
            inline_comments.append({
                "path": anchor.path,
                "line": anchor.line,
                "side": anchor.side,
                "body": format_inline_comment(f),
                "finding_id": f.get("id"),
                "fingerprint": fp,
            })
        else:
            unanchored_findings.append(f)

    summary_body = format_summary_markdown(
        pr_context=pr_context,
        actionable_findings=actionable_findings,
        unanchored_findings=unanchored_findings,
        dashboard_only_count=len(dashboard_only_findings),
        metrics=metrics,
        head_sha=head_sha,
        is_update_review=is_update_review,
    )

    return {
        "commit_id": head_sha,
        "event": "COMMENT",
        "body": summary_body,
        "comments": inline_comments,
        "unanchored_findings": unanchored_findings,
        "dashboard_only_findings": dashboard_only_findings,
        "published_fingerprints": published_fingerprints,
    }


def format_summary_markdown(
    pr_context: Dict[str, Any],
    actionable_findings: List[Dict[str, Any]],
    unanchored_findings: List[Dict[str, Any]],
    dashboard_only_count: int,
    metrics: Dict[str, Any],
    head_sha: str,
    is_update_review: bool = False,
) -> str:
    """Format the top-level GitHub review summary comment from actual analysis data."""
    crit_cnt = sum(1 for f in actionable_findings if _enum_str(f.get("severity", "")).lower() == "critical")
    high_cnt = sum(1 for f in actionable_findings if _enum_str(f.get("severity", "")).lower() == "high")
    med_cnt = sum(1 for f in actionable_findings if _enum_str(f.get("severity", "")).lower() == "medium")
    low_cnt = sum(1 for f in actionable_findings if _enum_str(f.get("severity", "")).lower() == "low")

    files_analyzed = metrics.get("files_analyzed", pr_context.get("changed_files_count", 0))
    short_sha = head_sha[:7] if head_sha else "unknown"
    heading = "## REGRAVA Review Update" if is_update_review else "## REGRAVA Review"

    lines = [
        heading,
        "",
        "### Review Summary",
        "",
    ]

    if not actionable_findings:
        lines.append(
            "No actionable security or API compatibility issues were identified by the enabled checks in this revision."
        )
    else:
        lines.append(
            "We analyzed this Pull Request for supported security and code-compatibility issues."
        )

    lines.extend([
        "",
        "**Findings:**",
        f"- Critical: {crit_cnt}",
        f"- High: {high_cnt}",
        f"- Medium: {med_cnt}",
        f"- Low: {low_cnt}",
        "",
        "### Main Observations",
        "",
    ])

    observations: List[str] = []
    if actionable_findings:
        sec_count = sum(
            1
            for f in actionable_findings
            if _enum_str(f.get("category", "")).lower()
            in ("secrets", "injection", "authorization", "input_validation", "configuration", "dependency")
        )
        reg_count = sum(
            1
            for f in actionable_findings
            if _enum_str(f.get("category", "")).lower()
            in ("api_contract", "removed_field", "type_mismatch", "removed_route", "param_change", "frontend_consumer_risk")
        )
        test_gaps = sum(
            1
            for f in actionable_findings
            if _enum_str(f.get("test_evidence", "")) in ("not_found_by_analyzer", "unknown")
        )
        if sec_count:
            observations.append(f"- {sec_count} security finding(s) require attention in the analyzed changes.")
        if reg_count:
            observations.append(f"- {reg_count} API contract / schema compatibility change(s) may affect downstream consumers.")
        if test_gaps:
            observations.append(f"- Additional test evidence is recommended for {test_gaps} modified path(s) where no automated test coverage was detected.")
        for f in actionable_findings[:5]:
            cf = f.get("changed_file") or {}
            loc = f"`{cf['path']}:{cf['line']}`" if cf.get("path") and cf.get("line") else "analyzed context"
            observations.append(f"- **{_enum_str(f.get('severity', '')).upper()}** (`{f.get('id')}`): {f.get('title')} ({loc})")
    else:
        observations.append("- Enabled security (Secrets, Injection, Auth/IDOR, Input Validation, Configuration, Dependencies) and API contract checks reported no actionable warnings.")

    if dashboard_only_count > 0:
        observations.append(
            f"- {dashboard_only_count} lower-confidence observation(s) were kept in the REGRAVA dashboard only to avoid inline review noise."
        )

    lines.extend(observations)

    if unanchored_findings:
        lines.extend([
            "",
            "### Additional Findings Outside Diff Hunks",
            "",
            "_The following findings apply to lines outside the current PR diff hunk or surrounding context and could not be anchored inline:_",
            "",
        ])
        for f in unanchored_findings:
            cf = f.get("changed_file") or {}
            loc = f"{cf.get('path', 'unknown')}:{cf.get('line', '?')}"
            lines.append(
                f"- **{_enum_str(f.get('severity', 'medium')).upper()} — {f.get('title')}** (`{f.get('id')}`, `{loc}`, Confidence: {_enum_str(f.get('confidence', 'medium')).capitalize()}): "
                f"{f.get('summary')} — *Action:* {f.get('recommendation')}"
            )

    lines.extend([
        "",
        "### Analysis Information",
        "",
        f"Files analyzed: {files_analyzed}",
        f"Head commit: `{short_sha}`",
        "Analysis status: Completed",
        "",
        "REGRAVA provides independent analysis.",
        "This review does not guarantee that the code is vulnerability-free.",
        "",
        "---",
        "REGRAVA | Review • Track • Verify",
    ])
    return "\n".join(lines)
