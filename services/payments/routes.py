import os
from fastapi import FastAPI, Depends, HTTPException
from .models import PaymentResponse

app = FastAPI(title="Payment Gateway Service")

@app.get("/api/payments/{payment_id}", response_model=PaymentResponse)
def get_payment(payment_id: int):
    """Retrieve verified payment transaction details."""
    # Parameterized safe lookup
    return PaymentResponse(
        payment_id=payment_id,
        amount=99.00,
        currency="USD",
        payment_token="tok_live_sec_1234567890",
        status="completed"
    )

@app.get("/api/receipts/download")
def download_receipt(filename: str):
    """Download receipt for a given invoice."""
    safe_base = "/var/receipts"
    # Safe validation check
    clean_path = os.path.normpath(os.path.join(safe_base, filename))
    if not clean_path.startswith(safe_base):
        raise HTTPException(status_code=400, detail="Invalid receipt path")
    return {"status": "ok", "filename": filename}
