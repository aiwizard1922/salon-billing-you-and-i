import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API = '/api';

export default function Checkout() {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch(`${API}/cart`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setCart)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  async function handlePay() {
    if (!cart?.items?.length) {
      alert('Cart is empty');
      return;
    }
    setPaying(true);
    try {
      const res = await fetch(`${API}/payment/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create order');

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        order_id: data.razorpayOrderId,
        name: 'GemGlow Studio',
        handler: async function (response) {
          const verifyRes = await fetch(`${API}/payment/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              order_id: data.orderId
            })
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok && verifyData.success) {
            navigate('/orders');
          } else {
            alert(verifyData.error || 'Payment verification failed');
          }
        },
        prefill: { email: 'customer@example.com' }
      };
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => {
        alert('Payment failed');
        setPaying(false);
      });
      rzp.open();
    } catch (err) {
      alert(err.message);
    } finally {
      setPaying(false);
    }
  }

  if (loading) return <div className="loading">Loading...</div>;

  const items = cart?.items || [];
  const total = items.reduce((sum, i) => sum + (i.product?.price || 0) * i.quantity, 0);

  if (items.length === 0) {
    return (
      <div className="page">
        <p>Your cart is empty.</p>
        <a href="/products">Browse Products</a>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Checkout</h1>
      <div className="checkout-summary">
        <ul>
          {items.map(i => (
            <li key={i.product._id}>{i.product.name} × {i.quantity} — ₹{i.product.price * i.quantity}</li>
          ))}
        </ul>
        <h3>Total: ₹{total}</h3>
        <button
          className="btn-primary btn-lg"
          onClick={handlePay}
          disabled={paying}
        >
          {paying ? 'Processing...' : 'Pay with Razorpay'}
        </button>
      </div>
    </div>
  );
}
