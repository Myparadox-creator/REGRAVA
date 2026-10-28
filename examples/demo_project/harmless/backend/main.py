from fastapi import FastAPI
from .models import UserResponse

app = FastAPI(title="Demo User API - Harmless Update")


@app.get("/api/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int):
    # Formatted with additional comments
    return UserResponse(user_id=user_id, name="Aditya")
