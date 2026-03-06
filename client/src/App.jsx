import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import NewInvoice from './pages/NewInvoice';
import InvoiceView from './pages/InvoiceView';
import Appointments from './pages/Appointments';
import Marketing from './pages/Marketing';
import Reports from './pages/Reports';
import Staff from './pages/Staff';
import Memberships from './pages/Memberships';
import ClientInsights from './pages/ClientInsights';
import { LogOut } from 'lucide-react';

function AppLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold">Salon Billing</Link>
          <nav className="flex items-center gap-6">
            <Link to="/" className="hover:text-amber-300">Dashboard</Link>
            <Link to="/customers" className="hover:text-amber-300">Customers</Link>
            <Link to="/invoices/new" className="hover:text-amber-300">New Invoice</Link>
            <Link to="/appointments" className="hover:text-amber-300">Appointments</Link>
            <Link to="/marketing" className="hover:text-amber-300">Marketing</Link>
            <Link to="/memberships" className="hover:text-amber-300">Memberships</Link>
            <Link to="/clients" className="hover:text-amber-300">Clients</Link>
            <Link to="/staff" className="hover:text-amber-300">Staff</Link>
            <Link to="/reports" className="hover:text-amber-300">Reports</Link>
            <span className="text-slate-300 text-sm">{user?.username}</span>
            <button
              onClick={logout}
              className="flex items-center gap-1 text-slate-300 hover:text-amber-300 transition"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/invoices/new" element={<NewInvoice />} />
          <Route path="/invoices/:id" element={<InvoiceView />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/marketing" element={<Marketing />} />
          <Route path="/memberships" element={<Memberships />} />
          <Route path="/clients" element={<ClientInsights />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
