"""
Unit tests for PythonParser and ContractExtractor.
"""

from app.analyzer.python_parser import PythonParser
from app.analyzer.contract_extractor import ContractExtractor
from app.models.contract import HTTPMethod


def test_parse_pydantic_model():
    code = """
from pydantic import BaseModel

class UserResponse(BaseModel):
    user_id: int
    name: str = "Anonymous"
    email: str
"""
    parser = PythonParser("backend/models.py", code)
    routes, models, warnings = parser.parse()
    assert "UserResponse" in models
    model = models["UserResponse"]
    assert "user_id" in model.fields
    assert model.fields["user_id"].type_annotation == "int"
    assert model.fields["user_id"].is_required is True
    assert model.fields["name"].is_required is False
    assert model.fields["name"].default_value == "'Anonymous'"


def test_parse_fastapi_route():
    code = """
from fastapi import FastAPI
app = FastAPI()

@app.get("/api/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int, query: str = None):
    return {"user_id": user_id, "name": "Test"}
"""
    parser = PythonParser("backend/main.py", code)
    routes, models, warnings = parser.parse()
    assert len(routes) == 1
    r = routes[0]
    assert r.path == "/api/users/{user_id}"
    assert r.method == HTTPMethod.GET
    assert r.response_model_name == "UserResponse"
    assert len(r.parameters) == 2
    assert r.parameters[0].name == "user_id"
    assert r.parameters[0].is_required is True
    assert r.parameters[1].name == "query"
    assert r.parameters[1].is_required is False


def test_malformed_python_syntax():
    code = "def broken_code( : invalid"
    parser = PythonParser("backend/broken.py", code)
    routes, models, warnings = parser.parse()
    assert len(warnings) == 1
    assert "Syntax error" in warnings[0]


def test_cross_file_contract_extractor():
    models_code = """
from pydantic import BaseModel
class OrderResponse(BaseModel):
    order_id: int
    amount: float
"""
    routes_code = """
from fastapi import FastAPI
from .models import OrderResponse
app = FastAPI()

@app.post("/api/orders", response_model=OrderResponse)
def create_order():
    pass
"""
    files = {
        "backend/models.py": models_code,
        "backend/main.py": routes_code,
    }
    extractor = ContractExtractor()
    snapshot = extractor.extract_from_files(files)
    assert len(snapshot.routes) == 1
    route = snapshot.routes[0]
    assert route.response_model_name == "OrderResponse"
    assert "order_id" in route.response_fields
    assert "amount" in route.response_fields
