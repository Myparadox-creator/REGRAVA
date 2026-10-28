"""
Risk assessor and finding generator for RepoSentinel.
Generates structured findings with distinct severity, confidence, evidence trails,
and actionable recommendations.
"""

from typing import List, Optional
from app.analyzer.contract_comparator import ContractChange, ContractComparisonResult
from app.analyzer.dependency_analyzer import ConsumerMatch, DependencyAnalyzer
from app.analyzer.test_evidence import TestEvidenceAnalyzer
from app.models.contract import ContractSnapshot
from app.models.finding import (
    AffectedFileRef,
    ChangedFileRef,
    Confidence,
    Finding,
    FindingCategory,
    Severity,
    TestEvidenceStatus,
)


class RiskAssessor:
    def __init__(
        self,
        base_snapshot: ContractSnapshot,
        head_snapshot: ContractSnapshot,
        dependency_analyzer: DependencyAnalyzer,
        test_analyzer: TestEvidenceAnalyzer,
    ):
        self.base_snapshot = base_snapshot
        self.head_snapshot = head_snapshot
        self.dependency_analyzer = dependency_analyzer
        self.test_analyzer = test_analyzer

    def assess(self, comparison: ContractComparisonResult) -> List[Finding]:
        findings: List[Finding] = []
        finding_counter = 1

        for change in comparison.changes:
            # 1. Determine associated route paths for this model/change
            associated_routes: List[str] = []
            if change.route_path:
                associated_routes.append(change.route_path)
            elif change.model_name:
                for r in self.base_snapshot.routes:
                    if r.response_model_name and change.model_name in r.response_model_name:
                        associated_routes.append(r.path)

            # 2. Check for affected frontend consumers
            consumers = self.dependency_analyzer.find_affected_consumers(
                change, associated_routes
            )

            # 3. Check test evidence
            test_status, test_items = self.test_analyzer.find_evidence_for_change(
                route_path=change.route_path or (associated_routes[0] if associated_routes else None),
                field_name=change.field_name,
                model_name=change.model_name,
            )

            # 4. Generate findings based on change type and consumer presence
            if change.change_type == "field_removed":
                if consumers:
                    for consumer in consumers:
                        finding_id = f"RS-{finding_counter:03d}"
                        finding_counter += 1

                        evidence = [
                            f"Base response model '{change.model_name}' defined field '{change.field_name}' ({change.old_value or 'Any'}).",
                            f"Head response model '{change.model_name}' removed field '{change.field_name}'.",
                            f"Frontend consumer '{consumer.file_path}:{consumer.line}' accesses '{consumer.snippet}'.",
                            f"Consumer correlation: {consumer.association_rule}.",
                        ]
                        if change.possible_rename_field:
                            evidence.append(
                                f"Observed added field '{change.possible_rename_field}' in same model (possible rename candidate)."
                            )

                        rec = (
                            f"Update '{consumer.file_path}:{consumer.line}' to consume the updated response structure "
                            f"(e.g. migrate to '{change.possible_rename_field or 'new field'}') or preserve '{change.field_name}' on the backend."
                        )

                        findings.append(
                            Finding(
                                id=finding_id,
                                category=FindingCategory.API_CONTRACT,
                                title=f"Frontend references removed response field '{change.field_name}'",
                                severity=Severity.HIGH,
                                confidence=consumer.confidence,
                                summary=(
                                    f"Field '{change.field_name}' was removed from backend model '{change.model_name}', "
                                    f"but is still referenced in frontend consumer '{consumer.file_path}'."
                                ),
                                changed_file=ChangedFileRef(
                                    path=change.old_location.file_path if change.old_location else "backend/models.py",
                                    line=change.old_location.line if change.old_location else 1,
                                    symbol=change.field_name,
                                    old_value=change.old_value,
                                    new_value=None,
                                ),
                                affected_file=AffectedFileRef(
                                    path=consumer.file_path,
                                    line=consumer.line,
                                    symbol=consumer.property_accessed,
                                    context_snippet=consumer.snippet,
                                ),
                                evidence=evidence,
                                test_evidence=test_status,
                                test_evidence_items=test_items,
                                recommendation=rec,
                                route_path=associated_routes[0] if associated_routes else None,
                                field_name=change.field_name,
                                model_name=change.model_name,
                                change_type=change.change_type,
                            )
                        )
                else:
                    # Removed field without direct consumers identified
                    finding_id = f"RS-{finding_counter:03d}"
                    finding_counter += 1

                    findings.append(
                        Finding(
                            id=finding_id,
                            category=FindingCategory.REMOVED_FIELD,
                            title=f"Response field '{change.field_name}' removed from '{change.model_name}'",
                            severity=Severity.MEDIUM,
                            confidence=Confidence.HIGH,
                            summary=(
                                f"Field '{change.field_name}' was removed from model '{change.model_name}'. "
                                f"No active frontend references were detected by the static analyzer."
                            ),
                            changed_file=ChangedFileRef(
                                path=change.old_location.file_path if change.old_location else "backend/models.py",
                                line=change.old_location.line if change.old_location else 1,
                                symbol=change.field_name,
                                old_value=change.old_value,
                                new_value=None,
                            ),
                            affected_file=None,
                            evidence=[
                                f"Field '{change.field_name}' existed in base revision but is absent in head.",
                                "Static inspection did not find active property access in analyzed frontend files.",
                            ],
                            test_evidence=test_status,
                            test_evidence_items=test_items,
                            recommendation=(
                                f"Verify that external API consumers or mobile clients do not depend on '{change.field_name}'."
                            ),
                            route_path=associated_routes[0] if associated_routes else None,
                            field_name=change.field_name,
                            model_name=change.model_name,
                            change_type=change.change_type,
                        )
                    )

            elif change.change_type == "type_changed":
                finding_id = f"RS-{finding_counter:03d}"
                finding_counter += 1
                severity = Severity.HIGH if consumers else Severity.MEDIUM

                findings.append(
                    Finding(
                        id=finding_id,
                        category=FindingCategory.TYPE_MISMATCH,
                        title=f"Response field '{change.field_name}' type altered in '{change.model_name}'",
                        severity=severity,
                        confidence=Confidence.HIGH,
                        summary=(
                            f"Field '{change.field_name}' type changed from '{change.old_value}' to '{change.new_value}'."
                        ),
                        changed_file=ChangedFileRef(
                            path=change.new_location.file_path if change.new_location else "backend/models.py",
                            line=change.new_location.line if change.new_location else 1,
                            symbol=change.field_name,
                            old_value=change.old_value,
                            new_value=change.new_value,
                        ),
                        affected_file=AffectedFileRef(
                            path=consumers[0].file_path,
                            line=consumers[0].line,
                            symbol=consumers[0].property_accessed,
                            context_snippet=consumers[0].snippet,
                        ) if consumers else None,
                        evidence=[
                            f"Previous type: {change.old_value}",
                            f"New type: {change.new_value}",
                        ],
                        test_evidence=test_status,
                        test_evidence_items=test_items,
                        recommendation="Verify that frontend parsers and serializers support the updated type.",
                        route_path=associated_routes[0] if associated_routes else None,
                        field_name=change.field_name,
                        model_name=change.model_name,
                        change_type=change.change_type,
                    )
                )

            elif change.change_type == "route_removed":
                finding_id = f"RS-{finding_counter:03d}"
                finding_counter += 1

                findings.append(
                    Finding(
                        id=finding_id,
                        category=FindingCategory.REMOVED_ROUTE,
                        title=f"Route '{change.method} {change.route_path}' was removed",
                        severity=Severity.HIGH,
                        confidence=Confidence.HIGH,
                        summary=f"The endpoint '{change.method} {change.route_path}' was removed from the backend.",
                        changed_file=ChangedFileRef(
                            path=change.old_location.file_path if change.old_location else "backend/main.py",
                            line=change.old_location.line if change.old_location else 1,
                            symbol=change.route_path,
                        ),
                        affected_file=None,
                        evidence=[
                            f"Endpoint '{change.method} {change.route_path}' was declared in base revision but is missing in head.",
                        ],
                        test_evidence=test_status,
                        test_evidence_items=test_items,
                        recommendation="Audit frontend client routes to ensure no traffic is sent to this removed endpoint.",
                        route_path=change.route_path,
                        change_type=change.change_type,
                    )
                )

            elif change.change_type == "param_required":
                finding_id = f"RS-{finding_counter:03d}"
                finding_counter += 1

                findings.append(
                    Finding(
                        id=finding_id,
                        category=FindingCategory.PARAM_CHANGE,
                        title=f"Parameter '{change.param_name}' became required on '{change.route_path}'",
                        severity=Severity.HIGH,
                        confidence=Confidence.HIGH,
                        summary=f"Parameter '{change.param_name}' on '{change.route_path}' is now mandatory.",
                        changed_file=ChangedFileRef(
                            path=change.new_location.file_path if change.new_location else "backend/main.py",
                            line=change.new_location.line if change.new_location else 1,
                            symbol=change.param_name,
                        ),
                        affected_file=None,
                        evidence=[
                            f"Parameter '{change.param_name}' on '{change.route_path}' is required in head revision.",
                        ],
                        test_evidence=test_status,
                        test_evidence_items=test_items,
                        recommendation="Ensure all frontend requests supply this mandatory parameter.",
                        route_path=change.route_path,
                        change_type=change.change_type,
                    )
                )

            elif change.change_type == "field_added":
                # Additive changes are non-breaking, flagged as INFO
                finding_id = f"RS-{finding_counter:03d}"
                finding_counter += 1

                findings.append(
                    Finding(
                        id=finding_id,
                        category=FindingCategory.API_CONTRACT,
                        title=f"Non-breaking field '{change.field_name}' added to '{change.model_name}'",
                        severity=Severity.INFO,
                        confidence=Confidence.HIGH,
                        summary=f"New field '{change.field_name}' ({change.new_value}) added to '{change.model_name}'.",
                        changed_file=ChangedFileRef(
                            path=change.new_location.file_path if change.new_location else "backend/models.py",
                            line=change.new_location.line if change.new_location else 1,
                            symbol=change.field_name,
                            new_value=change.new_value,
                        ),
                        affected_file=None,
                        evidence=[
                            f"Field '{change.field_name}' was introduced in head revision.",
                            "Backward-compatible additive change.",
                        ],
                        test_evidence=test_status,
                        test_evidence_items=test_items,
                        recommendation="No immediate action required unless frontend wants to utilize this field.",
                        route_path=associated_routes[0] if associated_routes else None,
                        field_name=change.field_name,
                        model_name=change.model_name,
                        change_type=change.change_type,
                    )
                )

        return findings
