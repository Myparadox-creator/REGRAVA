from pydantic import BaseModel
from typing import Optional

class PaymentResponse(BaseModel):
    payment_id: int
    amount: float
    currency: str = "USD"
    payment_token: str
    status: str = "completed"
