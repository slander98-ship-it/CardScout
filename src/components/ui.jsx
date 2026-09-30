// Shared UI primitives: buttons, inputs, bottom sheet, toasts, toggle.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export const inputCls =
  'h-11 w-full rounded-xl border border-line bg-panel2 px-3 text-base text-white outline-none focus:border-brand placeholder:text-zinc-600';

const btnBase =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-xl outline-none transition active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none';

const btnVariants = {
  primary: 'bg-brand text-brand-ink',
  secondary: 'border border-line bg-panel2 text-zinc-200',
  danger: 'bg-rose-600 text-white',
  ghost: 'text-dim',
};

const btnSizes = {
  md: 'h-12 px-5 text-base',
  sm: 'h-9 px-3 text-sm rounded-lg',
};

export function Button({ variant = 'primary', size = 'md', className = '', ...p }) {
  return (
    <button
      type="button"
      className={`${btnBase} ${btnVariants[variant] || btnVariants.primary} ${btnSizes[size] || btnSizes.md} ${className}`}
      {...p}
    />
  );
}

export function Field({ label, hint, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-zinc-200">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-dim">{hint}</span>}
    </label>
  );
}

export function Input({ className = '', ...p }) {
  return <input className={`${inputCls} ${className}`} {...p} />;
}

export function Toggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 rounded-full border border-line bg-panel2 py-1.5 pl-4 pr-1.5 text-sm text-zinc-200"
    >
      {label}
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-brand' : 'bg-zinc-600'}`}>
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
        />
      </span>
    </button>
  );
}

/** Bottom sheet modal. */
export function Sheet({ open, onClose, title, footer, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="sheet-in absolute inset-x-0 bottom-0 mx-auto max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t border-line bg-panel safe-bottom">
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-panel px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-dim" aria-label="Close">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="sticky bottom-0 border-t border-line bg-panel px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} animate-spin text-brand`} fill="none" aria-label="Loading">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ---------- Toasts ----------
const ToastCtx = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-2), { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-sm rounded-full px-4 py-2.5 text-sm font-medium shadow-lg ${
              t.type === 'success'
                ? 'bg-emerald-500 text-black'
                : t.type === 'error'
                  ? 'bg-rose-600 text-white'
                  : 'bg-zinc-800 text-white ring-1 ring-line'
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

// ---------- Clipboard ----------
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

// ---------- Online status ----------
export function useOnline() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
