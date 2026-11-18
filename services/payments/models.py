from pydantic import BaseModel
from typing import Optional

class PaymentResponse(BaseModel):
    payment_id: int
    amount: float
    currency: str = "USD"
    checkout_id: str  # Breaking change: replaced payment_token with checkout_id
    status: str = "completed"
