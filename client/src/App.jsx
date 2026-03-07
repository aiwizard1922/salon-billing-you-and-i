import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import NewInvoice from './pages/NewInvoice';
import InvoiceView from './pages/InvoiceView';
import Invoices from './pages/Invoices';
import Appointments from './pages/Appointments';
import Marketing from './pages/Marketing';
import Reports from './pages/Reports';
import Staff from './pages/Staff';
import Memberships from './pages/Memberships';
import Expenses from './pages/Expenses';
import ClientInsights from './pages/ClientInsights';
import Inventory from './pages/Inventory';
import Catalog from './pages/Catalog';
import CustomerProfile from './pages/CustomerProfile';
import { LogOut, LayoutDashboard, Users, FilePlus, FileText, Calendar, Package, BookOpen, Megaphone, Gift, UserCheck, UserCog, BarChart3, Receipt } from 'lucide-react';

const SIDEBAR_LINKS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/invoices/new', label: 'New Invoice', icon: FilePlus },
  { to: '/appointments', label: 'Appointments', icon: Calendar },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/catalog', label: 'Catalog', icon: BookOpen },
  { to: '/marketing', label: 'Marketing', icon: Megaphone },
  { to: '/memberships', label: 'Memberships', icon: Gift },
  { to: '/clients', label: 'Clients', icon: UserCheck },
  { to: '/staff', label: 'Staff', icon: UserCog },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
];

function NavLink({ to, label, icon: Icon }) {
  const location = useLocation();
  const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
        isActive ? 'bg-amber-500/20 text-amber-300' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {label}
    </Link>
  );
}

function AppLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="no-print w-56 bg-slate-800 text-white flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Quick Links</span>
        </div>
        <nav className="p-3 space-y-1 overflow-y-auto">
          {SIDEBAR_LINKS.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} label={label} icon={icon} />
          ))}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="no-print bg-slate-800 text-white shadow flex-shrink-0">
          <div className="px-6 py-4 flex items-center justify-between">
            <Link to="/" className="text-xl font-bold">Salon Billing</Link>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:text-amber-300 hover:bg-slate-700 rounded-lg transition"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerProfile />} />
          <Route path="/invoices/new" element={<NewInvoice />} />
          <Route path="/invoices/:id" element={<InvoiceView />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/marketing" element={<Marketing />} />
          <Route path="/memberships" element={<Memberships />} />
          <Route path="/clients" element={<ClientInsights />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </main>
      </div>
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
