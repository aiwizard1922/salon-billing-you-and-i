import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="layout">
      <nav className="nav">
        <Link to="/" className="logo">GemGlow Studio</Link>
        <div className="nav-links">
          <Link to="/products">Products</Link>
          {user ? (
            <>
              <Link to="/cart">Cart</Link>
              <Link to="/orders">Orders</Link>
              {user.role === 'admin' && <Link to="/admin">Admin</Link>}
              <button onClick={logout} className="btn-outline">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/signup" className="btn-primary">Sign Up</Link>
            </>
          )}
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
