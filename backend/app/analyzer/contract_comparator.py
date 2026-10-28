"""
Contract comparator for RepoSentinel.
Compares base and head ContractSnapshots to identify removed fields, added fields,
type alterations, route removals, and parameter mutations.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from app.models.contract import (
    ContractSnapshot,
    FieldContract,
    HTTPMethod,
    ModelContract,
    ParameterContract,
    RouteContract,
    SourceLocation,
)


class ContractChange(BaseModel):
    change_type: str  # "field_removed", "field_added", "type_changed", "route_removed", "route_added", "param_required"
    is_breaking: bool
    route_path: Optional[str] = None
    method: Optional[HTTPMethod] = None
    model_name: Optional[str] = None
    field_name: Optional[str] = None
    param_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    old_location: Optional[SourceLocation] = None
    new_location: Optional[SourceLocation] = None
    description: str
    possible_rename_field: Optional[str] = None


class ContractComparisonResult(BaseModel):
    changes: List[ContractChange] = Field(default_factory=list)
    breaking_changes: List[ContractChange] = Field(default_factory=list)
    non_breaking_changes: List[ContractChange] = Field(default_factory=list)


class ContractComparator:
    def compare(
        self,
        base_snapshot: ContractSnapshot,
        head_snapshot: ContractSnapshot
    ) -> ContractComparisonResult:
        changes: List[ContractChange] = []

        # 1. Compare Models
        self._compare_models(base_snapshot.models, head_snapshot.models, changes)

        # 2. Compare Routes
        self._compare_routes(base_snapshot.routes, head_snapshot.routes, changes)

        breaking = [c for c in changes if c.is_breaking]
        non_breaking = [c for c in changes if not c.is_breaking]

        return ContractComparisonResult(
            changes=changes,
            breaking_changes=breaking,
            non_breaking_changes=non_breaking,
        )

    def _compare_models(
        self,
        base_models: Dict[str, ModelContract],
        head_models: Dict[str, ModelContract],
        changes: List[ContractChange],
    ) -> None:
        for model_name, base_model in base_models.items():
            if model_name not in head_models:
                # Model completely removed
                changes.append(
                    ContractChange(
                        change_type="model_removed",
                        is_breaking=True,
                        model_name=model_name,
                        old_location=base_model.location,
                        description=f"Model '{model_name}' was removed in head revision.",
                    )
                )
                continue

            head_model = head_models[model_name]
            base_fields = base_model.fields
            head_fields = head_model.fields

            # Removed fields
            removed_fields = [f for f in base_fields if f not in head_fields]
            added_fields = [f for f in head_fields if f not in base_fields]

            for rf in removed_fields:
                old_f = base_fields[rf]
                # Check for possible rename heuristic: if exactly 1 removed and 1 added
                possible_rename: Optional[str] = None
                if len(removed_fields) == 1 and len(added_fields) == 1:
                    possible_rename = added_fields[0]

                changes.append(
                    ContractChange(
                        change_type="field_removed",
                        is_breaking=True,
                        model_name=model_name,
                        field_name=rf,
                        old_value=old_f.type_annotation,
                        old_location=old_f.location,
                        new_location=head_model.location,
                        possible_rename_field=possible_rename,
                        description=(
                            f"Field '{rf}' was removed from model '{model_name}'. "
                            + (f"Field '{possible_rename}' was newly added (possible rename candidate)."
                               if possible_rename else "")
                        ),
                    )
                )

            # Added fields (non-breaking)
            for af in added_fields:
                new_f = head_fields[af]
                changes.append(
                    ContractChange(
                        change_type="field_added",
                        is_breaking=False,
                        model_name=model_name,
                        field_name=af,
                        new_value=new_f.type_annotation,
                        new_location=new_f.location,
                        description=f"Field '{af}' ({new_f.type_annotation}) added to model '{model_name}'.",
                    )
                )

            # Type changed in existing fields
            for common_field in base_fields:
                if common_field in head_fields:
                    bf = base_fields[common_field]
                    hf = head_fields[common_field]
                    if bf.type_annotation != hf.type_annotation:
                        changes.append(
                            ContractChange(
                                change_type="type_changed",
                                is_breaking=True,
                                model_name=model_name,
                                field_name=common_field,
                                old_value=bf.type_annotation,
                                new_value=hf.type_annotation,
                                old_location=bf.location,
                                new_location=hf.location,
                                description=(
                                    f"Field '{common_field}' in model '{model_name}' changed type "
                                    f"from '{bf.type_annotation}' to '{hf.type_annotation}'."
                                ),
                            )
                        )

    def _compare_routes(
        self,
        base_routes: List[RouteContract],
        head_routes: List[RouteContract],
        changes: List[ContractChange],
    ) -> None:
        base_route_map = {(r.method, r.path): r for r in base_routes}
        head_route_map = {(r.method, r.path): r for r in head_routes}

        # Removed routes
        for (method, path), route in base_route_map.items():
            if (method, path) not in head_route_map:
                changes.append(
                    ContractChange(
                        change_type="route_removed",
                        is_breaking=True,
                        route_path=path,
                        method=method,
                        old_location=route.location,
                        description=f"Route '{method} {path}' was removed from backend.",
                    )
                )
                continue

            head_route = head_route_map[(method, path)]

            # Check response model change
            if route.response_model_name != head_route.response_model_name:
                changes.append(
                    ContractChange(
                        change_type="response_model_changed",
                        is_breaking=True,
                        route_path=path,
                        method=method,
                        old_value=route.response_model_name or "dict",
                        new_value=head_route.response_model_name or "dict",
                        old_location=route.location,
                        new_location=head_route.location,
                        description=(
                            f"Route '{method} {path}' response model changed from "
                            f"'{route.response_model_name}' to '{head_route.response_model_name}'."
                        ),
                    )
                )

            # Check parameters: e.g. optional parameter becoming required
            base_params = {p.name: p for p in route.parameters}
            head_params = {p.name: p for p in head_route.parameters}

            for p_name, hp in head_params.items():
                if p_name not in base_params:
                    if hp.is_required:
                        changes.append(
                            ContractChange(
                                change_type="param_required",
                                is_breaking=True,
                                route_path=path,
                                method=method,
                                param_name=p_name,
                                new_value=hp.type_annotation,
                                new_location=hp.location,
                                description=f"New required parameter '{p_name}' added to '{method} {path}'.",
                            )
                        )
                else:
                    bp = base_params[p_name]
                    if not bp.is_required and hp.is_required:
                        changes.append(
                            ContractChange(
                                change_type="param_required",
                                is_breaking=True,
                                route_path=path,
                                method=method,
                                param_name=p_name,
                                old_location=bp.location,
                                new_location=hp.location,
                                description=f"Parameter '{p_name}' on '{method} {path}' changed from optional to required.",
                            )
                        )
