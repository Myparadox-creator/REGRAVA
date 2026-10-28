from fastapi import FastAPI
from .models import UserResponse

app = FastAPI(title="Demo User API")


@app.get("/api/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int):
    """Retrieve user details by ID."""
    return UserResponse(id=user_id, name="Aditya")
