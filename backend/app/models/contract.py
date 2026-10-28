"""
API contract models for RepoSentinel.
Represents backend endpoints, response models, and parameters extracted from source code.
"""

from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class HTTPMethod(str, Enum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    DELETE = "DELETE"
    PATCH = "PATCH"
    OPTIONS = "OPTIONS"
    HEAD = "HEAD"


class ParameterKind(str, Enum):
    PATH = "path"
    QUERY = "query"
    BODY = "body"
    HEADER = "header"


class SourceLocation(BaseModel):
    file_path: str
    line: int
    end_line: Optional[int] = None
    column: Optional[int] = None

    def __str__(self) -> str:
        return f"{self.file_path}:{self.line}"


class ParameterContract(BaseModel):
    name: str
    type_annotation: str = "Any"
    kind: ParameterKind = ParameterKind.QUERY
    is_required: bool = True
    default_value: Optional[str] = None
    location: Optional[SourceLocation] = None


class FieldContract(BaseModel):
    name: str
    type_annotation: str = "Any"
    is_required: bool = True
    default_value: Optional[str] = None
    location: Optional[SourceLocation] = None


class ModelContract(BaseModel):
    name: str
    fields: Dict[str, FieldContract] = Field(default_factory=dict)
    location: Optional[SourceLocation] = None
    raw_docstring: Optional[str] = None


class RouteContract(BaseModel):
    path: str
    method: HTTPMethod
    function_name: str
    response_model_name: Optional[str] = None
    response_fields: Dict[str, FieldContract] = Field(default_factory=dict)
    parameters: List[ParameterContract] = Field(default_factory=list)
    location: Optional[SourceLocation] = None
    docstring: Optional[str] = None


class ContractSnapshot(BaseModel):
    routes: List[RouteContract] = Field(default_factory=list)
    models: Dict[str, ModelContract] = Field(default_factory=dict)
    revision: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)

    def find_route(self, path: str, method: HTTPMethod) -> Optional[RouteContract]:
        for r in self.routes:
            if r.path == path and r.method == method:
                return r
        return None
