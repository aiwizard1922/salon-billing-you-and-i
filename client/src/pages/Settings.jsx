import { useState } from 'react';
import { Trash2, Settings as SettingsIcon } from 'lucide-react';

const TOKEN_KEY = 'auth_token';

export default function Settings() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleClearTestData = async () => {
    if (!window.confirm('Permanently delete all customers, invoices, appointments, expenses, and memberships?')) return;
    setLoading(true);
    setResult(null);
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) {
      setResult({ ok: false, error: 'Not logged in' });
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/admin/clear-test-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setResult(data.success ? { ok: true } : { ok: false, error: data.error });
    } catch (e) {
      setResult({ ok: false, error: e.message || 'Request failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <SettingsIcon className="w-7 h-7 text-amber-600" />
        Settings
      </h1>

      <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-700 mb-2">Admin</h2>
        <p className="text-slate-600 text-sm mb-4">
          Clear test data (customers, invoices, appointments, expenses, memberships). Remove this before handover.
        </p>
        <button
          onClick={handleClearTestData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-4 h-4" />
          {loading ? 'Clearing…' : 'Clear test data'}
        </button>
        {result && (
          <p className={`mt-3 text-sm ${result.ok ? 'text-green-600' : 'text-red-600'}`}>
            {result.ok ? 'All test data cleared.' : result.error}
          </p>
        )}
      </section>
    </div>
  );
}
