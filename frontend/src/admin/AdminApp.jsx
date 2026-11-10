/* ==========================================================================
   Staff dashboard (its own page and bundle, served only at ADMIN_PATH):
   sign-in (password, then a code by email), Menu CMS, live orders, store &
   promo settings, table QR stickers, and accounts for the site administrator.
   Auth and data live on the server.
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
import { TeamPanel } from './TeamPanel.jsx';
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
  { id: 'qr', icon: 'qr', label: 'QR', more: ' codes' },
  { id: 'team', icon: 'users', label: 'Team', superOnly: true }
];

// Step 1: email and password. Step 2: the 6-digit code emailed to that address.
function Login({ error: initialError, onUnlocked }) {
  const admin = useAdmin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState(null); // { challenge, sentTo, emailed } once the password was right
  const [code, setCode] = useState('');
  const [error, setError] = useState(initialError || '');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const firstRef = useRef(null), codeRef = useRef(null);
  useEffect(() => { (step ? codeRef : firstRef).current.focus(); }, [step]);

  const failed = (err) => {
    setError(err.message);
    setShake(false);
    requestAnimationFrame(() => setShake(true));
  };
  const run = (work) => { setBusy(true); return work().finally(() => setBusy(false)); };

  function submitPassword(e) {
    e.preventDefault();
    run(() => admin.login(email, password).then((r) => { setError(''); setCode(''); setStep(r); }, failed));
  }
  function submitCode(e) {
    e.preventDefault();
    run(() => admin.verify(step.challenge, code).then(onUnlocked, (err) => {
      if (err.status === 400) { setStep(null); setPassword(''); } // expired or used up: start again
      failed(err);
      setCode('');
    }));
  }
  function resend() {
    run(() => admin.resendCode(step.challenge).then((r) => { setError(''); setStep({ ...step, emailed: r.emailed }); }, failed));
  }

  return (
    <main className="login-screen">
      {!step ? (
        <form className={'login-card' + (shake ? ' shake' : '')} onSubmit={submitPassword}>
          <div className="lock-ico" aria-hidden="true"><Icon name="lock" /></div>
          <h1>Staff dashboard</h1>
          <p className="muted">Sign in to manage the menu and orders.</p>
          <input type="email" ref={firstRef} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="username" aria-label="Email" required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" aria-label="Password" required />
          <p className="form-error" aria-live="assertive">{error}</p>
          <button type="submit" className="btn btn-red btn-block" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button>
          <details className="login-help">
            <summary>Forgot your password?</summary>
            <p>Ask the site administrator. They can give you a new one from the Team tab in a minute, and your menu, orders and settings stay exactly as they are.</p>
          </details>
        </form>
      ) : (
        <form className={'login-card' + (shake ? ' shake' : '')} onSubmit={submitCode}>
          <div className="lock-ico" aria-hidden="true"><Icon name="shield" /></div>
          <h1>Check your email</h1>
          <p className="muted">{step.emailed
            ? <>We sent a 6-digit code to <b>{step.sentTo}</b>. It works for 10 minutes.</>
            : <>We couldn't send the email to <b>{step.sentTo}</b>. The site administrator can find the code in the server log.</>}</p>
          <input ref={codeRef} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code"
            inputMode="numeric" autoComplete="one-time-code" aria-label="Sign-in code" className="code-input" required minLength="6" maxLength="6" />
          <p className="form-error" aria-live="assertive">{error}</p>
          <button type="submit" className="btn btn-red btn-block" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Sign in'}</button>
          <div className="login-links">
            <button type="button" className="btn btn-link btn-sm" onClick={resend} disabled={busy}>Send a new code</button>
            <button type="button" className="btn btn-link btn-sm" onClick={() => { setStep(null); setError(''); }}>Use another account</button>
          </div>
        </form>
      )}
    </main>
  );
}

// A temporary password (new account, or reset by the administrator) must be replaced first.
function ChoosePassword({ user, onDone, onLock }) {
  const admin = useAdmin();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const ref = useRef(null);
  useEffect(() => { ref.current.focus(); }, []);

  function submit(e) {
    e.preventDefault();
    if (next !== again) { setError('The two new passwords are different.'); return; }
    admin.setPassword(current, next).then(onDone, (err) => setError(err.message));
  }
  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="lock-ico" aria-hidden="true"><Icon name="lock" /></div>
        <h1>Choose your password</h1>
        <p className="muted">Hi {user.name || user.email}. You signed in with a temporary password: choose your own to continue.</p>
        <input type="password" ref={ref} value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Temporary password" autoComplete="current-password" aria-label="Temporary password" required />
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="New password (10+ characters)" autoComplete="new-password" aria-label="New password" minLength="10" required />
        <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} placeholder="New password again" autoComplete="new-password" aria-label="New password again" minLength="10" required />
        <p className="form-error" aria-live="assertive">{error}</p>
        <button type="submit" className="btn btn-red btn-block">Save and continue</button>
        <div className="login-links"><button type="button" className="btn btn-link btn-sm" onClick={onLock}>Sign out</button></div>
      </form>
    </main>
  );
}

function Dashboard({ endsAt: sessionEnd, user, onLock }) {
  const admin = useAdmin(), toast = useToast();
  const [tab, setTab] = useState('menu');
  const [live, setLive] = useState(true);
  const [flash, setFlash] = useState(new Set());
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
            <span className="admin-user hide-xs" title={user.email}><Icon name={user.role === 'super' ? 'shield' : 'users'} /> {user.name || user.email}</span>
            {sessionEnd && <span className="session-end hide-xs" title="For security, a sign-in lasts 1 hour"><Icon name="clock" /> Signed in until {new Date(sessionEnd).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}
            <a href="/" className="btn btn-ghost btn-sm" target="_blank" rel="noopener"><Icon name="external" /><span className="hide-xs">View site</span></a>
            <button className="btn btn-yellow btn-sm" onClick={onLock}><Icon name="lock" /> Sign out</button>
          </div>
        </div>
        <nav className="wrap admin-tabs" role="tablist" aria-label="Admin sections">
          {TABS.filter((t) => !t.superOnly || user.role === 'super').map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} /><span>{t.label}{t.more && <span className="hide-xs">{t.more}</span>}</span>
              {t.id === 'orders' && <span className="tab-badge" hidden={!fresh}>{fresh}</span>}
            </button>
          ))}
        </nav>
      </header>

      <div className="wrap admin-body">
        <MenuPanel hidden={tab !== 'menu'} searchRef={searchRef} />
        <OrdersPanel hidden={tab !== 'orders'} live={live} flash={flash} />
        <InsightsPanel hidden={tab !== 'insights'} />
        <PhotosPanel hidden={tab !== 'photos'} />
        <OutletsPanel hidden={tab !== 'outlets'} />
        <SettingsPanel hidden={tab !== 'settings'} />
        <QrPanel hidden={tab !== 'qr'} />
        {user.role === 'super' && <TeamPanel hidden={tab !== 'team'} me={user} />}
      </div>
    </section>
  );
}

// The server says how long is left, so a wrong clock on this device can't change the limit.
const endsAt = (s) => (s && s.expiresInMs ? Date.now() + s.expiresInMs : null);
const WARN_MS = 5 * 60 * 1000;

export function AdminApp() {
  const admin = useAdmin(), toast = useToast();
  const [state, setState] = useState({ phase: 'loading', user: null, error: '' });
  const authed = state.phase === 'dashboard';
  const authedRef = useRef(false);
  authedRef.current = authed;

  useEffect(() => {
    admin.session().then(
      (s) => setState({ phase: s.authed ? 'dashboard' : 'login', user: s.user || null, endsAt: endsAt(s), error: '' }),
      (err) => setState({ phase: 'login', user: null, error: err.message })
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Session expired, or signed out from elsewhere: ask to sign in again.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!authedRef.current) return;
      setState({ phase: 'login', user: null, error: '' });
      toast('Session expired. Sign in again.', 'info');
    });
    return () => setUnauthorizedHandler(null);
  }, [toast]);

  const unlocked = useCallback(() => {
    admin.session().then((s) => s, () => ({}))
      .then((s) => setState({ phase: s.authed ? 'dashboard' : 'login', user: s.user || null, endsAt: endsAt(s), error: '' }));
  }, [admin]);

  // One hour after signing in: warn 5 minutes before, then lock, hiding the screen straight away.
  const end = authed ? state.endsAt : null;
  useEffect(() => {
    if (!end) return undefined;
    let warned = false;
    const check = () => {
      const left = end - Date.now();
      if (left <= 0) {
        setState({ phase: 'login', user: null, error: 'Signed out after 1 hour. Sign in again to continue.' });
        admin.logout();
      } else if (left <= WARN_MS && !warned) {
        warned = true;
        toast('You will be signed out in ' + Math.ceil(left / 60000) + ' min. Save any changes.', 'info');
      }
    };
    check();
    const timer = setInterval(check, 5000);
    document.addEventListener('visibilitychange', check); // a sleeping phone or laptop wakes up late
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  }, [end]); // eslint-disable-line react-hooks/exhaustive-deps

  const lock = () => {
    setState({ phase: 'login', user: null, error: '' });
    admin.logout().then(() => toast('Signed out', 'info'));
  };

  if (state.phase === 'loading') return null;
  if (!authed) return <Login error={state.error} onUnlocked={unlocked} />;
  if (state.user.mustChange) return <ChoosePassword user={state.user} onDone={unlocked} onLock={lock} />;
  return <Dashboard endsAt={state.endsAt} user={state.user} onLock={lock} />;
}
