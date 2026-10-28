"""
Contract extractor for RepoSentinel.
Scans Python source files, extracts endpoints and Pydantic models, and cross-references schemas.
"""

from typing import Dict, List, Optional
from app.analyzer.python_parser import PythonParser
from app.models.contract import ContractSnapshot, ModelContract, RouteContract


class ContractExtractor:
    def __init__(self):
        self.routes: List[RouteContract] = []
        self.models: Dict[str, ModelContract] = {}
        self.warnings: List[str] = []

    def extract_from_files(
        self,
        files_dict: Dict[str, str],
        revision: Optional[str] = None
    ) -> ContractSnapshot:
        """
        Process a dictionary of {file_path: file_content} and return a consolidated ContractSnapshot.
        """
        self.routes = []
        self.models = {}
        self.warnings = []

        # First pass: parse all files and collect models and routes
        for path, content in files_dict.items():
            norm_path = path.replace("\\", "/")
            # Skip test files and hidden files for API contracts
            if any(part.startswith(".") for part in norm_path.split("/")):
                continue
            if "/venv/" in norm_path or "/.venv/" in norm_path or "/site-packages/" in norm_path:
                continue

            parser = PythonParser(file_path=norm_path, source_code=content)
            routes, models, warnings = parser.parse()

            self.models.update(models)
            self.routes.extend(routes)
            self.warnings.extend(warnings)

        # Second pass: Link routes to response models if response_fields were empty
        for route in self.routes:
            if not route.response_fields and route.response_model_name:
                clean_model_name = route.response_model_name.strip()
                # Handle List[Model] or Optional[Model]
                for model_key in self.models:
                    if model_key in clean_model_name:
                        route.response_fields = self.models[model_key].fields
                        break

        return ContractSnapshot(
            routes=self.routes,
            models=self.models,
            revision=revision,
            warnings=self.warnings,
        )
