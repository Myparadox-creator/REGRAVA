from pydantic import BaseModel


class UserResponse(BaseModel):
    """User response schema with updated documentation."""
    user_id: int
    name: str
