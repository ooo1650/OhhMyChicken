/* ==========================================================================
   Admin store — menu CMS, settings, auth and order-log calls.
   Menu edits update local state first, then sync to the server; if the
   server refuses, the error is shown and the real data reloaded.
   ========================================================================== */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api } from '../shared/api.js';
import { money } from '../shared/format.js';
import { useToast } from '../shared/toast.jsx';

const AdminCtx = createContext(null);
export const useAdmin = () => useContext(AdminCtx);

const uid = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const isPizzaCat = (c) => c === 'nonveg' || c === 'veg' || c === 'porkbuff';

export function AdminProvider({ boot, children }) {
  const toast = useToast();
  const { defaults } = boot;
  const [menu, setMenu] = useState(boot.menu);
  const [settings, setSettings] = useState(boot.settings);
  const [orders, setOrders] = useState([]);

  const refresh = useCallback(() => Promise.all([api('GET', 'menu'), api('GET', 'settings')])
    .then(([m, s]) => { setMenu(m); setSettings(s); }, () => {}), []);

  // A write already applied locally failed on the server: tell the user and
  // reload the real data so the screen matches the database again.
  // Resolves false so callers can skip their success message.
  const syncFailed = useCallback((err) => {
    if (err.status !== 401) toast(err.message, 'error');
    return refresh().then(() => false);
  }, [toast, refresh]);
  const applied = (setter) => (data) => { setter(data); return true; };

  const value = useMemo(() => ({
    defaults, menu, settings, orders,
    categories: defaults.CATEGORIES,
    categoryName: (id) => { const c = defaults.CATEGORIES.find((x) => x.id === id); return c ? c.name : id; },
    getItem: (id) => menu.find((m) => m.id === id),
    money: (n) => money(settings, n),

    /* ---------- Menu ---------- */
    // Replace the whole menu (JSON import). Resolves true when the server accepted it.
    saveMenu: (list) => api('PUT', 'menu', list).then(applied(setMenu), syncFailed),
    upsertItem: (raw) => {
      const item = { ...raw, id: raw.id || uid(), isPizza: isPizzaCat(raw.category) };
      setMenu((list) => {
        const i = list.findIndex((m) => m.id === item.id);
        if (i === -1) return [...list, item];
        const next = list.slice(); next[i] = item; return next;
      });
      api('PUT', 'menu/' + encodeURIComponent(item.id), item).catch(syncFailed);
      return item;
    },
    deleteItem: (id) => {
      setMenu((list) => list.filter((m) => m.id !== id));
      api('DELETE', 'menu/' + encodeURIComponent(id)).catch(syncFailed);
    },
    resetMenu: () => api('POST', 'menu/reset').then(applied(setMenu), syncFailed),

    /* ---------- Settings ---------- */
    saveSettings: (s) => api('PUT', 'settings', s).then(applied(setSettings), syncFailed),
    resetSettings: () => api('POST', 'settings/reset').then(applied(setSettings), syncFailed),

    /* ---------- Auth (server session cookie) ---------- */
    session: () => api('GET', 'admin/session'),
    login: (p) => api('POST', 'admin/login', { passcode: p }),
    logout: () => api('POST', 'admin/logout').catch(() => {}),
    setPass: (current, p) => api('PUT', 'admin/passcode', { current, passcode: p }),

    /* ---------- Orders ---------- */
    loadOrders: () => api('GET', 'orders').then((list) => { setOrders(list); return list; }),
    setOrderStatus: (id, status) => api('PATCH', 'orders/' + id, { status }).then((saved) => {
      setOrders((list) => list.map((o) => (o.id === saved.id ? saved : o)));
      return saved;
    }),
    clearOrders: () => api('DELETE', 'orders').then(() => { setOrders([]); return true; }, syncFailed)
  }), [defaults, menu, settings, orders, syncFailed]);

  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>;
}
