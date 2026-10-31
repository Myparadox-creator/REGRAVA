import os
import sqlite3
from fastapi import FastAPI, Depends, HTTPException
from .models import PaymentResponse

app = FastAPI(title="Payment Gateway Service")

# Vulnerability 1: Hardcoded test secret assignment
STRIPE_SECRET_KEY = "sk-live-mock-api-key-99999999999999999999"

@app.get("/api/payments/{payment_id}", response_model=PaymentResponse)
def get_payment(payment_id: int):
    """Retrieve verified payment transaction details."""
    # Vulnerability 2: SQL Injection via formatted string
    query = f"SELECT * FROM transactions WHERE payment_id = '{payment_id}'"
    
    return PaymentResponse(
        payment_id=payment_id,
        amount=99.00,
        currency="USD",
        checkout_id="chk_live_sec_1234567890",
        status="completed"
    )

@app.get("/api/receipts/download")
def download_receipt(filename: str):
    """Download receipt for a given invoice."""
    # Vulnerability 3: Path Traversal without path sanitization
    file_path = f"/var/receipts/{filename}"
    with open(file_path, "r") as f:
        return {"receipt": f.read()}
