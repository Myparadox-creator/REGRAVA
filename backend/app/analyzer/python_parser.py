"""
Python AST parser for RepoSentinel.
Extracts FastAPI routes, Pydantic models, parameters, and return types statically using Python's ast module.
"""

import ast
from typing import Dict, List, Optional, Tuple, Any
from app.models.contract import (
    FieldContract,
    HTTPMethod,
    ModelContract,
    ParameterContract,
    ParameterKind,
    RouteContract,
    SourceLocation,
)


class PythonParser:
    def __init__(self, file_path: str, source_code: str):
        self.file_path = file_path.replace("\\", "/")
        self.source_code = source_code
        self.routes: List[RouteContract] = []
        self.models: Dict[str, ModelContract] = {}
        self.warnings: List[str] = []

    def parse(self) -> Tuple[List[RouteContract], Dict[str, ModelContract], List[str]]:
        """Parse source code and return extracted routes, models, and warnings."""
        if not self.source_code or not self.source_code.strip():
            return [], {}, []

        try:
            tree = ast.parse(self.source_code, filename=self.file_path)
        except SyntaxError as e:
            self.warnings.append(
                f"Syntax error in {self.file_path}:{e.lineno or 1}: {e.msg}"
            )
            return [], {}, self.warnings
        except Exception as e:
            self.warnings.append(
                f"Failed to parse {self.file_path}: {str(e)}"
            )
            return [], {}, self.warnings

        # First pass: Extract Pydantic models
        for node in tree.body:
            if isinstance(node, ast.ClassDef):
                self._extract_class_model(node)

        # Second pass: Extract FastAPI routes
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                self._extract_route(node)

        return self.routes, self.models, self.warnings

    def _extract_class_model(self, node: ast.ClassDef) -> None:
        """Extract a Pydantic model class definition."""
        # Check base classes (BaseModel or similar)
        is_pydantic = False
        for base in node.bases:
            name = self._get_name_or_attr(base)
            if "BaseModel" in name or "Model" in name:
                is_pydantic = True
                break

        fields: Dict[str, FieldContract] = {}

        # Scan class body for type-annotated attributes
        for item in node.body:
            if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                field_name = item.target.id
                type_str = self._unparse_expr(item.annotation)
                is_required = True
                default_val: Optional[str] = None

                if item.value is not None:
                    is_required = False
                    default_val = self._unparse_expr(item.value)
                    # Check if Field(...) is used with ... (ellipsis means required)
                    if default_val == "..." or "...)" in default_val:
                        is_required = True

                loc = SourceLocation(
                    file_path=self.file_path,
                    line=item.lineno,
                    end_line=getattr(item, "end_lineno", item.lineno),
                    column=item.col_offset,
                )
                fields[field_name] = FieldContract(
                    name=field_name,
                    type_annotation=type_str,
                    is_required=is_required,
                    default_value=default_val,
                    location=loc,
                )

        # Even if not explicitly subclassing BaseModel, if it has typed fields, record it as a model candidate
        if is_pydantic or fields:
            loc = SourceLocation(
                file_path=self.file_path,
                line=node.lineno,
                end_line=getattr(node, "end_lineno", node.lineno),
                column=node.col_offset,
            )
            docstring = ast.get_docstring(node)
            self.models[node.name] = ModelContract(
                name=node.name,
                fields=fields,
                location=loc,
                raw_docstring=docstring,
            )

    def _extract_route(self, node: Any) -> None:
        """Inspect decorators to determine if a function is a FastAPI route."""
        for decorator in node.decorator_list:
            route_info = self._inspect_route_decorator(decorator)
            if not route_info:
                continue

            method, path, resp_model_name = route_info
            params = self._extract_parameters(node)
            loc = SourceLocation(
                file_path=self.file_path,
                line=node.lineno,
                end_line=getattr(node, "end_lineno", node.lineno),
                column=node.col_offset,
            )
            docstring = ast.get_docstring(node)

            # Check if there is an explicit response model or dictionary return
            resp_fields: Dict[str, FieldContract] = {}
            if resp_model_name and resp_model_name in self.models:
                resp_fields = self.models[resp_model_name].fields
            else:
                # Fallback: check return statements inside function for dict literals
                dict_fields = self._extract_return_dict_fields(node)
                if dict_fields:
                    resp_fields = dict_fields

            route_contract = RouteContract(
                path=path,
                method=method,
                function_name=node.name,
                response_model_name=resp_model_name,
                response_fields=resp_fields,
                parameters=params,
                location=loc,
                docstring=docstring,
            )
            self.routes.append(route_contract)

    def _inspect_route_decorator(self, decorator: Any) -> Optional[Tuple[HTTPMethod, str, Optional[str]]]:
        """Extract HTTP method, route path, and response_model from decorator."""
        if not isinstance(decorator, ast.Call):
            return None

        # Check decorator function call, e.g., app.get("/api/users", response_model=UserResponse)
        # or router.post(...)
        func_expr = decorator.func
        attr_name: Optional[str] = None

        if isinstance(func_expr, ast.Attribute):
            attr_name = func_expr.attr
        elif isinstance(func_expr, ast.Name):
            attr_name = func_expr.id
        else:
            return None

        if not attr_name:
            return None

        http_methods = {
            "get": HTTPMethod.GET,
            "post": HTTPMethod.POST,
            "put": HTTPMethod.PUT,
            "delete": HTTPMethod.DELETE,
            "patch": HTTPMethod.PATCH,
            "options": HTTPMethod.OPTIONS,
            "head": HTTPMethod.HEAD,
        }

        method: Optional[HTTPMethod] = None
        if attr_name.lower() in http_methods:
            method = http_methods[attr_name.lower()]
        elif attr_name == "api_route":
            # Search keywords for methods
            for kw in decorator.keywords:
                if kw.arg == "methods" and isinstance(kw.value, (ast.List, ast.Tuple)):
                    if kw.value.elts and isinstance(kw.value.elts[0], ast.Constant):
                        val = str(kw.value.elts[0].value).upper()
                        if val in HTTPMethod.__members__:
                            method = HTTPMethod(val)
            if not method:
                method = HTTPMethod.GET
        else:
            return None

        # Extract path: 1st positional arg or 'path' keyword
        path: Optional[str] = None
        if decorator.args:
            first_arg = decorator.args[0]
            if isinstance(first_arg, ast.Constant) and isinstance(first_arg.value, str):
                path = first_arg.value

        resp_model_name: Optional[str] = None
        for kw in decorator.keywords:
            if kw.arg == "path" and isinstance(kw.value, ast.Constant) and isinstance(kw.value.value, str):
                path = kw.value.value
            elif kw.arg == "response_model":
                resp_model_name = self._unparse_expr(kw.value)

        if not path:
            return None

        return method, path, resp_model_name

    def _extract_parameters(self, func_node: Any) -> List[ParameterContract]:
        """Extract function arguments and their annotations."""
        params: List[ParameterContract] = []
        args = func_node.args.args

        # Calculate defaults offset
        num_args = len(args)
        num_defaults = len(func_node.args.defaults)
        default_start_idx = num_args - num_defaults

        for idx, arg in enumerate(args):
            param_name = arg.arg
            if param_name in ("self", "cls"):
                continue

            type_str = "Any"
            if arg.annotation:
                type_str = self._unparse_expr(arg.annotation)

            is_required = True
            default_val: Optional[str] = None
            if idx >= default_start_idx:
                is_required = False
                default_expr = func_node.args.defaults[idx - default_start_idx]
                default_val = self._unparse_expr(default_expr)
                if default_val == "..." or "...)" in default_val:
                    is_required = True

            kind = ParameterKind.QUERY
            if "Path(" in (default_val or ""):
                kind = ParameterKind.PATH
            elif "Body(" in (default_val or ""):
                kind = ParameterKind.BODY
            elif "Header(" in (default_val or ""):
                kind = ParameterKind.HEADER

            loc = SourceLocation(
                file_path=self.file_path,
                line=arg.lineno,
                column=arg.col_offset,
            )

            params.append(
                ParameterContract(
                    name=param_name,
                    type_annotation=type_str,
                    kind=kind,
                    is_required=is_required,
                    default_value=default_val,
                    location=loc,
                )
            )

        return params

    def _extract_return_dict_fields(self, func_node: Any) -> Dict[str, FieldContract]:
        """Extract keys from dictionary return statements as fallback contract."""
        fields: Dict[str, FieldContract] = {}
        for child in ast.walk(func_node):
            if isinstance(child, ast.Return) and isinstance(child.value, ast.Dict):
                for k, v in zip(child.value.keys, child.value.values):
                    if isinstance(k, ast.Constant) and isinstance(k.value, str):
                        field_name = k.value
                        type_str = type(getattr(v, "value", None)).__name__ if isinstance(v, ast.Constant) else "Any"
                        fields[field_name] = FieldContract(
                            name=field_name,
                            type_annotation=type_str,
                            is_required=True,
                            location=SourceLocation(
                                file_path=self.file_path,
                                line=child.lineno,
                                column=child.col_offset,
                            ),
                        )
        return fields

    def _get_name_or_attr(self, node: Any) -> str:
        """Helper to get string name from Name or Attribute node."""
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            return f"{self._get_name_or_attr(node.value)}.{node.attr}"
        return ""

    def _unparse_expr(self, node: Any) -> str:
        """Convert AST expression node to clean string representation."""
        if node is None:
            return ""
        try:
            return ast.unparse(node)
        except Exception:
            return str(type(node).__name__)
