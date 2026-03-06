import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API = '/api';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch(`${API}/orders`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setOrders)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading orders...</div>;

  return (
    <div className="page">
      <h1>Order History</h1>
      {orders.length === 0 ? (
        <div className="empty-state">
          <p>No orders yet.</p>
          <Link to="/products" className="btn-primary">Shop Now</Link>
        </div>
      ) : (
        <div className="order-list">
          {orders.map(o => (
            <div key={o._id} className="order-card">
              <div className="order-header">
                <span>Order #{o._id.slice(-6).toUpperCase()}</span>
                <span className={`status ${o.status}`}>{o.status}</span>
              </div>
              <ul>
                {o.items.map((i, idx) => (
                  <li key={idx}>{i.name} × {i.quantity} — ₹{i.price * i.quantity}</li>
                ))}
              </ul>
              <p className="order-total">Total: ₹{o.totalAmount}</p>
              <p className="order-date">
                {new Date(o.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
