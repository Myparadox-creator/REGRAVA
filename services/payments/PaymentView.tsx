import React, { useEffect, useState } from "react";

interface PaymentDetails {
  payment_id: number;
  amount: number;
  currency: string;
  payment_token: string;
  status: string;
}

export const PaymentView: React.FC<{ paymentId: number }> = ({ paymentId }) => {
  const [payment, setPayment] = useState<PaymentDetails | null>(null);

  useEffect(() => {
    fetch(`/api/payments/${paymentId}`)
      .then((res) => res.json())
      .then((data: PaymentDetails) => setPayment(data));
  }, [paymentId]);

  if (!payment) {
    return <div className="loading">Loading payment details...</div>;
  }

  // Regression: backend model removed 'payment_token' and replaced it with 'checkout_id'
  // At runtime, 'token' will now be undefined!
  const token = payment.payment_token;

  return (
    <div className="payment-card">
      <h2>Payment #{payment.payment_id}</h2>
      <p>Amount: {payment.amount} {payment.currency}</p>
      <p className="token">Authorization Token: {token}</p>
      <p>Status: {payment.status}</p>

      {/* Vulnerability 4: Dangerous XSS pattern */}
      <div dangerouslySetInnerHTML={{ __html: "<p>Receipt Verified</p>" }} />
    </div>
  );
};
