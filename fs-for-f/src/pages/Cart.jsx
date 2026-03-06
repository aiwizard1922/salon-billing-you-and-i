import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API = '/api';

export default function Cart() {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch(`${API}/cart`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setCart)
      .finally(() => setLoading(false));
  }, []);

  async function updateQty(productId, quantity) {
    const res = await fetch(`${API}/cart/update/${productId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ quantity })
    });
    const data = await res.json();
    setCart(data);
  }

  async function remove(productId) {
    await fetch(`${API}/cart/remove/${productId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    setCart(prev => ({
      ...prev,
      items: prev.items.filter(i => i.product._id !== productId)
    }));
  }

  if (loading) return <div className="loading">Loading cart...</div>;

  const items = cart?.items || [];
  const total = items.reduce((sum, i) => sum + (i.product?.price || 0) * i.quantity, 0);

  return (
    <div className="page">
      <h1>Shopping Cart</h1>
      {items.length === 0 ? (
        <div className="empty-state">
          <p>Your cart is empty.</p>
          <Link to="/products" className="btn-primary">Browse Products</Link>
        </div>
      ) : (
        <>
          <div className="cart-list">
            {items.map(item => (
              <div key={item.product._id} className="cart-item">
                <div>
                  <h4>{item.product.name}</h4>
                  <p>₹{item.product.price} × {item.quantity}</p>
                </div>
                <div className="cart-item-actions">
                  <button
                    onClick={() => updateQty(item.product._id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                  >−</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => updateQty(item.product._id, item.quantity + 1)}>+</button>
                  <button className="remove" onClick={() => remove(item.product._id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
          <div className="cart-footer">
            <h3>Total: ₹{total}</h3>
            <Link to="/checkout" className="btn-primary">Proceed to Checkout</Link>
          </div>
        </>
      )}
    </div>
  );
}
