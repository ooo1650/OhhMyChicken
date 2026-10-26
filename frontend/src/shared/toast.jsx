import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Icon } from './Icon.jsx';

// type: 'ok' (default), 'error' or 'info' — picks the icon and accent colour.
const ICONS = { ok: 'check-circle', error: 'alert', info: 'info' };
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [t, setT] = useState({ msg: '', type: 'ok', hidden: true, show: false, n: 0 });
  const timers = useRef([]);
  const toast = useCallback((msg, type) => {
    timers.current.forEach(clearTimeout);
    type = ICONS[type] ? type : 'ok';
    setT((p) => ({ msg, type, hidden: false, show: false, n: p.n + 1 }));
    // Next frame: add .show so the CSS transition restarts.
    requestAnimationFrame(() => requestAnimationFrame(() => setT((p) => ({ ...p, show: true }))));
    timers.current = [setTimeout(() => {
      setT((p) => ({ ...p, show: false }));
      timers.current.push(setTimeout(() => setT((p) => ({ ...p, hidden: true })), 300));
    }, 2200)];
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className={'toast toast-' + t.type + (t.show ? ' show' : '')} role="status" aria-live="polite" hidden={t.hidden}>
        <Icon name={ICONS[t.type]} /><span>{t.msg}</span>
      </div>
    </ToastCtx.Provider>
  );
}
