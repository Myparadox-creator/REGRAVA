"""
Unit tests for ContractComparator.
"""

from app.analyzer.contract_comparator import ContractComparator
from app.analyzer.contract_extractor import ContractExtractor


def test_removed_field_detected():
    base_code = """
from pydantic import BaseModel
class User(BaseModel):
    user_id: int
    name: str
"""
    head_code = """
from pydantic import BaseModel
class User(BaseModel):
    id: int
    name: str
"""
    extractor = ContractExtractor()
    base_snap = extractor.extract_from_files({"models.py": base_code})
    head_snap = extractor.extract_from_files({"models.py": head_code})

    comparator = ContractComparator()
    res = comparator.compare(base_snap, head_snap)

    assert len(res.breaking_changes) == 1
    bc = res.breaking_changes[0]
    assert bc.change_type == "field_removed"
    assert bc.field_name == "user_id"
    assert bc.possible_rename_field == "id"

    # Non breaking change for added 'id'
    assert len(res.non_breaking_changes) == 1
    assert res.non_breaking_changes[0].field_name == "id"


def test_type_changed_detected():
    base_code = """
from pydantic import BaseModel
class Item(BaseModel):
    item_id: int
"""
    head_code = """
from pydantic import BaseModel
class Item(BaseModel):
    item_id: str
"""
    extractor = ContractExtractor()
    base_snap = extractor.extract_from_files({"models.py": base_code})
    head_snap = extractor.extract_from_files({"models.py": head_code})

    comparator = ContractComparator()
    res = comparator.compare(base_snap, head_snap)

    assert len(res.breaking_changes) == 1
    assert res.breaking_changes[0].change_type == "type_changed"
    assert res.breaking_changes[0].old_value == "int"
    assert res.breaking_changes[0].new_value == "str"


def test_route_removed_detected():
    base_code = """
from fastapi import FastAPI
app = FastAPI()
@app.delete("/api/items/{id}")
def delete_item(id: int):
    pass
"""
    head_code = """
from fastapi import FastAPI
app = FastAPI()
"""
    extractor = ContractExtractor()
    base_snap = extractor.extract_from_files({"main.py": base_code})
    head_snap = extractor.extract_from_files({"main.py": head_code})

    comparator = ContractComparator()
    res = comparator.compare(base_snap, head_snap)

    assert len(res.breaking_changes) == 1
    assert res.breaking_changes[0].change_type == "route_removed"
    assert res.breaking_changes[0].route_path == "/api/items/{id}"
