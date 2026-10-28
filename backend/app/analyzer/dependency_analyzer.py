"""
Dependency analyzer for RepoSentinel.
Correlates backend contract mutations with frontend TypeScript/React consumers using
deterministic source evidence (route strings, TypeScript interfaces, property access expressions).
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from app.analyzer.contract_comparator import ContractChange
from app.analyzer.typescript_parser import (
    TSAnalysisResult,
    TSApiEndpoint,
    TSPropertyAccess,
    TSTypeField,
)
from app.models.finding import Confidence


class ConsumerMatch(BaseModel):
    file_path: str
    line: int
    column: int
    property_accessed: str
    expression: str
    snippet: str
    confidence: Confidence
    association_rule: str
    matched_endpoint: Optional[str] = None
    matched_type: Optional[str] = None


class DependencyAnalyzer:
    def __init__(self, ts_analysis: TSAnalysisResult):
        self.ts_analysis = ts_analysis

    def find_affected_consumers(
        self,
        change: ContractChange,
        associated_route_paths: List[str],
    ) -> List[ConsumerMatch]:
        """
        Identify frontend consumer locations that access the removed/changed field or route.
        """
        matches: List[ConsumerMatch] = []
        target_field = change.field_name

        if not target_field:
            return matches

        # Map frontend files that contain API calls matching the route
        file_endpoints_map: Dict[str, List[str]] = {}
        for ep in self.ts_analysis.api_endpoints:
            file_endpoints_map.setdefault(ep.file, []).append(ep.endpoint)

        # Map frontend types
        file_types_map: Dict[str, List[TSTypeField]] = {}
        for tf in self.ts_analysis.type_fields:
            file_types_map.setdefault(tf.file, []).append(tf)

        # Inspect all property accesses for target_field
        for pa in self.ts_analysis.property_accesses:
            if pa.property != target_field:
                continue

            file_endpoints = file_endpoints_map.get(pa.file, [])
            file_types = file_types_map.get(pa.file, [])

            # Check Rule 1: Direct route string match in same file
            has_matching_route = False
            matching_ep_str: Optional[str] = None
            for ep_str in file_endpoints:
                for route_path in associated_route_paths:
                    # Normalize path params e.g. /api/users/{id} vs /api/users
                    clean_route = route_path.split("{")[0].rstrip("/")
                    clean_ep = ep_str.split("?")[0].rstrip("/")
                    if clean_route and (clean_route in clean_ep or clean_ep in clean_route):
                        has_matching_route = True
                        matching_ep_str = ep_str
                        break
                if has_matching_route:
                    break

            # Check Rule 2: Interface / type annotation matching backend model name
            has_matching_type = False
            matching_type_name: Optional[str] = None
            if change.model_name:
                for tf in file_types:
                    if (
                        tf.type_name.lower() in change.model_name.lower()
                        or change.model_name.lower() in tf.type_name.lower()
                    ) and tf.field_name == target_field:
                        has_matching_type = True
                        matching_type_name = tf.type_name
                        break

            # Check Rule 3: Expression context (e.g. response.user_id, data.user_id, user.user_id)
            expr_lower = pa.expression.lower()
            is_response_var = any(
                k in expr_lower for k in ["response", "data", "res", "user", "result", "payload", "{destructured}"]
            )

            # Determine confidence and rule
            confidence = Confidence.LOW
            rule = "Uncorrelated property name match"

            if has_matching_route and has_matching_type:
                confidence = Confidence.HIGH
                rule = f"Direct route ({matching_ep_str}) and interface ({matching_type_name}) correlation"
            elif has_matching_route:
                confidence = Confidence.HIGH
                rule = f"Route reference ({matching_ep_str}) present in consumer file"
            elif has_matching_type:
                confidence = Confidence.HIGH
                rule = f"Matching TypeScript interface ({matching_type_name}) defined in consumer file"
            elif is_response_var:
                confidence = Confidence.MEDIUM
                rule = f"Property '{target_field}' accessed on response/data expression '{pa.expression}'"
            else:
                confidence = Confidence.LOW
                rule = f"Property '{target_field}' accessed without confirmed API or response context"

            matches.append(
                ConsumerMatch(
                    file_path=pa.file,
                    line=pa.line,
                    column=pa.column,
                    property_accessed=pa.property,
                    expression=pa.expression,
                    snippet=pa.full_snippet,
                    confidence=confidence,
                    association_rule=rule,
                    matched_endpoint=matching_ep_str,
                    matched_type=matching_type_name,
                )
            )

        return matches
