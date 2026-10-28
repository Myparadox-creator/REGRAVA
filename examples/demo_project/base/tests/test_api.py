from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_get_user():
    response = client.get("/api/users/101")
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == 101
    assert data["name"] == "Aditya"
