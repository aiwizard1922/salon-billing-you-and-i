import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);
const TOKEN_KEY = 'auth_token';

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}
function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
  localStorage.removeItem(TOKEN_KEY);
}
function removeToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setUser({ username: d.username });
        } else {
          removeToken();
          setUser(null);
        }
      })
      .catch(() => {
        removeToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error('Server not responding – is the backend running?');
    }
    if (!data.success) throw new Error(data.error || 'Login failed');
    setToken(data.token);
    setUser({ username: data.username });
    return data;
  };

  const logout = () => {
    removeToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
