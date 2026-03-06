import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const API = '/api';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetch(`${API}/products`)
      .then(res => res.json())
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  async function addToCart(productId) {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    try {
      await fetch(`${API}/cart/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ productId, quantity: 1 })
      });
      alert('Added to cart');
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) return <div className="loading">Loading products...</div>;

  return (
    <div className="page">
      <h1>Our Collection</h1>
      <div className="product-grid">
        {products.length === 0 ? (
          <p className="empty">No products yet.</p>
        ) : (
          products.map(p => (
            <div key={p._id} className="product-card">
              <div className="product-image">
                {p.image ? (
                  <img src={p.image} alt={p.name} />
                ) : (
                  <div className="product-placeholder">✦</div>
                )}
              </div>
              <div className="product-info">
                <h3>{p.name}</h3>
                <p className="product-desc">{p.description}</p>
                <p className="product-price">₹{p.price}</p>
                <button
                  className="btn-primary"
                  onClick={() => addToCart(p._id)}
                >
                  Add to Cart
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
