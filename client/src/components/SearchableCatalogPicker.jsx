import { useState, useEffect, useRef, useMemo } from 'react';
import { Search } from 'lucide-react';

/**
 * Searchable list for catalog lines (services, products, plans, staff).
 * Options: { value: string, label: string, sublabel?: string }
 */
export function SearchableCatalogPicker({
  value,
  onChange,
  options,
  emptyLabel = 'Select…',
  extraFooterOptions = [],
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || (o.sublabel && o.sublabel.toLowerCase().includes(q))
    );
  }, [options, query]);

  const inputDisplay = open ? query : selected?.label || '';

  return (
    <div className={`relative ${className}`} ref={boxRef}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" aria-hidden />
        <input
          type="text"
          autoComplete="off"
          className="w-full border rounded-lg pl-9 pr-8 py-2 text-sm"
          placeholder={emptyLabel}
          value={inputDisplay}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
        />
        {value ? (
          <button
            type="button"
            className="absolute right-2 text-slate-400 hover:text-slate-600 text-lg leading-none"
            title="Clear"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('');
              setQuery('');
              setOpen(false);
            }}
          >
            ×
          </button>
        ) : null}
      </div>
      {open && (
        <div className="absolute z-30 w-full mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          {filtered.length === 0 && extraFooterOptions.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-500">No matches</div>
          ) : (
            <>
              {filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-0 ${value === o.value ? 'bg-amber-50' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(o.value);
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  <span className="font-medium text-slate-800">{o.label}</span>
                  {o.sublabel ? <span className="block text-xs text-slate-500 mt-0.5">{o.sublabel}</span> : null}
                </button>
              ))}
              {extraFooterOptions.map((ex) => (
                <button
                  key={ex.value}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-amber-800 hover:bg-amber-50 border-t border-slate-100"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(ex.value);
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  {ex.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
