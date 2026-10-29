/* ==========================================================================
   Staff dashboard (its own page and bundle, served only at ADMIN_PATH):
   passcode gate, Menu CMS, live orders, store & promo settings and table
   QR stickers. Auth and data live on the server.
   ========================================================================== */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAdmin } from './store.jsx';
import { MenuPanel } from './MenuPanel.jsx';
import { OrdersPanel } from './OrdersPanel.jsx';
import { SettingsPanel } from './SettingsPanel.jsx';
import { QrPanel } from './QrPanel.jsx';
import { PhotosPanel } from './PhotosPanel.jsx';
import { InsightsPanel } from './InsightsPanel.jsx';
import { OutletsPanel } from './OutletsPanel.jsx';
import { Icon } from '../shared/Icon.jsx';
import { useToast } from '../shared/toast.jsx';
import { setUnauthorizedHandler } from '../shared/api.js';

const POLL_MS = 20000;
const TABS = [
  { id: 'menu', icon: 'utensils', label: 'Menu' },
  { id: 'orders', icon: 'chart', label: 'Orders' },
  { id: 'insights', icon: 'sparkles', label: 'Insights' },
  { id: 'photos', icon: 'image', label: 'Photos' },
  { id: 'outlets', icon: 'store', label: 'Outlets' },
  { id: 'settings', icon: 'sliders', label: 'Store' },
  { id: 'qr', icon: 'qr', label: 'QR', more: ' codes' }
];

function Login({ error: initialError, onUnlocked }) {
  const admin = useAdmin();
  const [pass, setPass] = useState('');
  const [error, setError] = useState(initialError || '');
  const [shake, setShake] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current.focus(); }, []);

  function submit(e) {
    e.preventDefault();
    admin.login(pass).then(onUnlocked, (err) => {
      setError(err.message);
      inputRef.current.select();
      setShake(false);
      requestAnimationFrame(() => setShake(true));
    });
  }
  return (
    <main className="login-screen">
      <form className={'login-card' + (shake ? ' shake' : '')} onSubmit={submit}>
        <div className="lock-ico" aria-hidden="true"><Icon name="lock" /></div>
        <h1>Staff dashboard</h1>
        <p className="muted">Enter the staff passcode to manage the menu and orders.</p>
        <input type="password" ref={inputRef} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Passcode" autoComplete="current-password" aria-label="Passcode" required />
        <p className="form-error" aria-live="assertive">{error}</p>
        <button type="submit" className="btn btn-red btn-block">Unlock dashboard</button>
        <details className="login-help">
          <summary>Forgot the passcode?</summary>
          <p>Ask whoever looks after the website's server. They can set a new passcode in a minute, and your menu, orders and settings stay exactly as they are.</p>
        </details>
      </form>
    </main>
  );
}

function Dashboard({ defaultPass, onPassChanged, onLock }) {
  const admin = useAdmin(), toast = useToast();
  const [tab, setTab] = useState('menu');
  const [live, setLive] = useState(true);
  const [flash, setFlash] = useState(new Set());
  const [focusPass, setFocusPass] = useState(0);
  const searchRef = useRef(null);
  const loadRef = useRef(admin.loadOrders);
  loadRef.current = admin.loadOrders;

  useEffect(() => { window.scrollTo(0, 0); searchRef.current.focus({ preventScroll: true }); }, []);

  // Live orders: poll while the dashboard is open; skip rounds while the tab is hidden.
  useEffect(() => {
    let timer, known = null, stopped = false;
    const poll = () => {
      clearTimeout(timer);
      if (stopped) return;
      const next = () => { if (!stopped) timer = setTimeout(poll, POLL_MS); };
      if (document.hidden) { next(); return; }
      loadRef.current().then((list) => {
        setLive(true);
        const fresh = known ? list.filter((o) => !known.has(o.id)) : [];
        known = new Set(list.map((o) => o.id));
        if (fresh.length) {
          setFlash(new Set(fresh.map((o) => o.id)));
          toast(fresh.length === 1 ? 'New order from ' + fresh[0].name : fresh.length + ' new orders', 'info');
        }
      }, () => setLive(false)).then(next, next);
    };
    const onVisible = () => { if (!document.hidden) poll(); };
    poll();
    document.addEventListener('visibilitychange', onVisible);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [toast]);

  const fresh = admin.orders.filter((o) => o.status === 'new').length;

  return (
    <section className="admin" aria-labelledby="adminTitle">
      <header className="admin-head">
        <div className="wrap admin-head-inner">
          <h1 id="adminTitle"><span className="brand-block brand-ohh">OMC</span> Dashboard</h1>
          <div className="admin-head-actions">
            <a href="/" className="btn btn-ghost btn-sm" target="_blank" rel="noopener"><Icon name="external" /><span className="hide-xs">View site</span></a>
            <button className="btn btn-yellow btn-sm" onClick={onLock}><Icon name="lock" /> Lock</button>
          </div>
        </div>
        <nav className="wrap admin-tabs" role="tablist" aria-label="Admin sections">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} /><span>{t.label}{t.more && <span className="hide-xs">{t.more}</span>}</span>
              {t.id === 'orders' && <span className="tab-badge" hidden={!fresh}>{fresh}</span>}
            </button>
          ))}
        </nav>
      </header>

      <div className="wrap admin-body">
        <div className="admin-alert" role="alert" hidden={!defaultPass}>
          <Icon name="alert" />
          <p><b>You're still using a start-up passcode.</b> Choose your own so only your staff can edit the menu.</p>
          <button type="button" className="btn btn-yellow btn-sm" onClick={() => { setTab('settings'); setFocusPass((n) => n + 1); }}>Change passcode</button>
        </div>
        <MenuPanel hidden={tab !== 'menu'} searchRef={searchRef} />
        <OrdersPanel hidden={tab !== 'orders'} live={live} flash={flash} />
        <InsightsPanel hidden={tab !== 'insights'} />
        <PhotosPanel hidden={tab !== 'photos'} />
        <OutletsPanel hidden={tab !== 'outlets'} />
        <SettingsPanel hidden={tab !== 'settings'} onPassChanged={onPassChanged} focusPass={focusPass} />
        <QrPanel hidden={tab !== 'qr'} />
      </div>
    </section>
  );
}

export function AdminApp() {
  const admin = useAdmin(), toast = useToast();
  const [state, setState] = useState({ phase: 'loading', defaultPass: false, error: '' });
  const authed = state.phase === 'dashboard';
  const authedRef = useRef(false);
  authedRef.current = authed;

  useEffect(() => {
    admin.session().then(
      (s) => setState({ phase: s.authed ? 'dashboard' : 'login', defaultPass: !!s.defaultPass, error: '' }),
      (err) => setState({ phase: 'login', defaultPass: false, error: err.message })
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Session expired or passcode changed elsewhere: lock and ask again.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!authedRef.current) return;
      setState({ phase: 'login', defaultPass: false, error: '' });
      toast('Session expired. Unlock the dashboard again.', 'info');
    });
    return () => setUnauthorizedHandler(null);
  }, [toast]);

  const unlocked = useCallback(() => {
    admin.session().then((s) => s.defaultPass, () => false)
      .then((defaultPass) => setState({ phase: 'dashboard', defaultPass, error: '' }));
  }, [admin]);

  const lock = () => {
    setState({ phase: 'login', defaultPass: false, error: '' });
    admin.logout().then(() => toast('Dashboard locked', 'info'));
  };

  if (state.phase === 'loading') return null;
  if (!authed) return <Login error={state.error} onUnlocked={unlocked} />;
  return <Dashboard defaultPass={state.defaultPass} onPassChanged={() => setState((s) => ({ ...s, defaultPass: false }))} onLock={lock} />;
}
