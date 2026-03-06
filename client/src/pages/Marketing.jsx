import { useState, useEffect } from 'react';
import { Send, Megaphone, AlertCircle, CheckCircle } from 'lucide-react';

const API = '/api';

export default function Marketing() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [waConfigured, setWaConfigured] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/customers`).then((r) => r.json()),
      fetch(`${API}/whatsapp/status`).then((r) => r.json()),
    ])
      .then(([custRes, waRes]) => {
        if (custRes.success) setCustomers(custRes.data);
        if (waRes.configured) setWaConfigured(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const withPhone = customers.filter((c) => c.phone?.trim());
  const selectAll = () => setSelectedIds(withPhone.map((c) => c.id));
  const selectNone = () => setSelectedIds([]);
  const toggle = (id) =>
    setSelectedIds((prev) => {
      if (prev.length === 0) {
        return withPhone.filter((c) => c.id !== id).map((c) => c.id);
      }
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
  const isSelected = (id) => (selectedIds.length === 0 ? true : selectedIds.includes(id));
  const targetCount = selectedIds.length === 0 ? withPhone.length : selectedIds.length;

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`${API}/marketing/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          customerIds: selectedIds.length ? selectedIds : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      } else {
        setResult({ sent: 0, failed: 0, total: 0, error: data.error });
      }
    } catch (err) {
      setResult({ sent: 0, failed: 0, total: 0, error: err.message });
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="text-slate-600">Loading...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Megaphone className="w-7 h-7 text-amber-500" />
        WhatsApp Marketing
      </h2>

      {!waConfigured && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">WhatsApp not configured</p>
            <p className="text-sm text-amber-700 mt-1">
              Add <code className="bg-amber-100 px-1 rounded">WA_PHONE_NUMBER_ID</code> and{' '}
              <code className="bg-amber-100 px-1 rounded">WA_ACCESS_TOKEN</code> to{' '}
              <code className="bg-amber-100 px-1 rounded">server/.env</code> from your Meta for
              Developers console. Messages will be logged but not sent until configured.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow border p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Compose message</h3>
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                placeholder={`Hi {{name}}, 

We have exciting offers for you!

🎉 20% off on all services this week.
📍 Visit us today!

– Salon Team`}
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Use <code className="bg-slate-100 px-1 rounded">{'{{name}}'}</code> to insert each
                customer&apos;s name
              </p>
            </div>
            <button
              type="submit"
              disabled={sending || withPhone.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {sending ? `Sending... (${targetCount} recipients)` : `Send to ${targetCount} customers`}
            </button>
          </form>

          {result && (
            <div
              className={`mt-6 p-4 rounded-lg flex items-start gap-3 ${
                result.error
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-green-50 border border-green-200'
              }`}
            >
              {result.error ? (
                <>
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-red-800">{result.error}</p>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-green-800">
                      Sent: {result.sent} • Failed: {result.failed}
                    </p>
                    {result.errors?.length > 0 && (
                      <ul className="text-sm text-green-700 mt-2 space-y-1">
                        {result.errors.slice(0, 5).map((e, i) => (
                          <li key={i}>
                            {e.name}: {e.error}
                          </li>
                        ))}
                        {result.errors.length > 5 && (
                          <li>...and {result.errors.length - 5} more</li>
                        )}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow border p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-800">Select recipients</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-sm text-amber-600 hover:underline"
              >
                Select all
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={selectNone}
                className="text-sm text-slate-500 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          {withPhone.length === 0 ? (
            <p className="text-slate-500 py-8 text-center">
              No customers with phone numbers. Add customers with phone numbers to send promotions.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {withPhone.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isSelected(c.id) || selectedIds.length === 0}
                    onChange={() => toggle(c.id)}
                  />
                  <div>
                    <p className="font-medium text-slate-800">{c.name}</p>
                    <p className="text-sm text-slate-500">{c.phone}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
          <p className="text-sm text-slate-500 mt-4">
            {selectedIds.length === 0
              ? `Will send to all ${withPhone.length} customers with phone numbers`
              : `${selectedIds.length} customer(s) selected`}
          </p>
        </div>
      </div>
    </div>
  );
}
