import { useState, useEffect } from 'react';

const API = '/api';

export default function Admin() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState('products');
  const [form, setForm] = useState({ name: '', description: '', price: '', category: 'service' });
  const [editing, setEditing] = useState(null);
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };

  useEffect(() => {
    fetch(`${API}/products/admin`, { headers })
      .then(res => res.json())
      .then(setProducts);
  }, [tab]);

  useEffect(() => {
    if (tab === 'orders') {
      fetch(`${API}/orders`, { headers })
        .then(res => res.json())
        .then(setOrders);
    }
  }, [tab]);

  async function addProduct(e) {
    e.preventDefault();
    const res = await fetch(`${API}/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...form, price: Number(form.price) })
    });
    const data = await res.json();
    if (res.ok) {
      setProducts(prev => [data, ...prev]);
      setForm({ name: '', description: '', price: '', category: 'service' });
    } else alert(data.error);
  }

  async function updateProduct(e) {
    e.preventDefault();
    const res = await fetch(`${API}/products/${editing._id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ ...form, price: Number(form.price) })
    });
    const data = await res.json();
    if (res.ok) {
      setProducts(prev => prev.map(p => p._id === data._id ? data : p));
      setEditing(null);
      setForm({ name: '', description: '', price: '', category: 'service' });
    } else alert(data.error);
  }

  async function deleteProduct(id) {
    if (!confirm('Deactivate this product?')) return;
    await fetch(`${API}/products/${id}`, { method: 'DELETE', headers });
    setProducts(prev => prev.filter(p => p._id !== id));
  }

  async function updateOrderStatus(orderId, status) {
    const res = await fetch(`${API}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (res.ok) {
      setOrders(prev => prev.map(o => o._id === data._id ? data : o));
    }
  }

  function editProduct(p) {
    setEditing(p);
    setForm({ name: p.name, description: p.description || '', price: p.price, category: p.category || 'service' });
  }

  return (
    <div className="page">
      <h1>Admin Dashboard</h1>
      <div className="admin-tabs">
        <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>Products</button>
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>Orders</button>
      </div>

      {tab === 'products' && (
        <div className="admin-products">
          <form className="admin-form" onSubmit={editing ? updateProduct : addProduct}>
            <h3>{editing ? 'Edit Product' : 'Add Product'}</h3>
            <input
              placeholder="Name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
            <input
              placeholder="Description"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
            <input
              type="number"
              placeholder="Price (₹)"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              required
            />
            <input
              placeholder="Category"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            />
            <div>
              <button type="submit" className="btn-primary">{editing ? 'Update' : 'Add'}</button>
              {editing && <button type="button" className="btn-outline" onClick={() => { setEditing(null); setForm({ name: '', description: '', price: '', category: 'service' }); }}>Cancel</button>}
            </div>
          </form>
          <div className="admin-product-list">
            {products.map(p => (
              <div key={p._id} className={`admin-product-card ${!p.isActive ? 'inactive' : ''}`}>
                <div>
                  <h4>{p.name}</h4>
                  <p>₹{p.price}</p>
                </div>
                <div>
                  <button className="btn-outline small" onClick={() => editProduct(p)}>Edit</button>
                  <button className="btn-outline small danger" onClick={() => deleteProduct(p._id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div className="admin-orders">
          {orders.map(o => (
            <div key={o._id} className="order-card">
              <div className="order-header">
                <span>#{o._id.slice(-6).toUpperCase()} — {o.user?.name}</span>
                <select
                  value={o.status}
                  onChange={e => updateOrderStatus(o._id, e.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <ul>{o.items.map((i, idx) => <li key={idx}>{i.name} × {i.quantity}</li>)}</ul>
              <p className="order-total">₹{o.totalAmount}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
