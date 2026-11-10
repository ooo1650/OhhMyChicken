/* Team — for the site administrator only: dashboard accounts (add, choose
   what each can use, reset a forgotten password, switch off, sign out),
   features to switch on or off, who sends the sign-in codes, and checks for
   when something isn't working (email, database, backups).
   The server enforces all of it. */
import { useEffect, useState } from 'react';
import { useAdmin } from './store.jsx';
import { useConfirm } from './confirm.jsx';
import { Icon } from '../shared/Icon.jsx';
import { useToast } from '../shared/toast.jsx';

// The parts of the dashboard a staff account can be given (the server has the same list).
const PARTS = [['menu', 'Menu'], ['orders', 'Orders'], ['photos', 'Photos'], ['outlets', 'Outlets'], ['store', 'Store settings'], ['qr', 'QR codes'], ['insights', 'Insights']];

const when = (t) => (t ? new Date(t).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'never');

export function TeamPanel({ hidden, me }) {
  const admin = useAdmin(), toast = useToast(), confirm = useConfirm();
  const [users, setUsers] = useState(null);
  const [temp, setTemp] = useState(null); // { email, password }: shown once, after adding or resetting
  const load = () => admin.users().then(setUsers, (e) => toast(e.message, 'error'));
  useEffect(() => { if (!hidden) load(); }, [hidden]); // eslint-disable-line react-hooks/exhaustive-deps

  // Runs a change, reports it, and reloads the list.
  const act = (work, msg) => work().then((r) => { if (msg) toast(msg); load(); return r; }, (e) => toast(e.message, 'error'));

  async function resetPassword(u) {
    if (!(await confirm('Give ' + u.email + ' a new temporary password? Their current one stops working and they are signed out everywhere.', 'Reset password'))) return;
    const r = await act(() => admin.resetPassword(u.id));
    if (r) setTemp({ email: u.email, password: r.tempPassword });
  }
  async function toggleActive(u) {
    if (u.active && !(await confirm('Switch off ' + u.email + '? They are signed out and can\'t sign in until you switch the account back on.', 'Switch off'))) return;
    act(() => admin.updateUser(u.id, { active: !u.active }), u.email + (u.active ? ' switched off' : ' switched on'));
  }
  const setRole = (u, role) => act(() => admin.updateUser(u.id, { role }), u.email + ' is now ' + (role === 'super' ? 'a site admin' : 'a restaurant account'));
  const signOut = (u) => act(() => admin.signOutUser(u.id), u.email + ' signed out everywhere');

  return (
    <div className="admin-panel team" hidden={hidden}>
      <div className="panel-head">
        <div>
          <h2><Icon name="users" /> Team</h2>
          <p className="muted tiny">Only site admins (PaperKite) see this tab. Restaurant accounts sign in with their own email and password, then a code sent to that email.</p>
        </div>
      </div>

      {temp && (
        <div className="admin-alert temp-pass" role="status">
          <Icon name="lock" />
          <p>Temporary password for <b>{temp.email}</b>: <code>{temp.password}</code><br />
            <span className="tiny">Give it to them in person or by phone. It is shown only now; they choose their own when they sign in.</span></p>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => navigator.clipboard.writeText(temp.password).then(() => toast('Copied'), () => {})}><Icon name="copy" /> Copy</button>
          <button type="button" className="icon-btn" aria-label="Hide" onClick={() => setTemp(null)}><Icon name="x" /></button>
        </div>
      )}

      <div className="team-grid">
        <div className="panel-card">
          <h3>Accounts</h3>
          {!users ? <p className="muted">Loading…</p> : (
            <ul className="team-list">
              {users.map((u) => {
                const self = u.email === me.email;
                return (
                  <li key={u.id} className={u.active ? '' : 'off'}>
                    <div className="team-who">
                      <b>{u.name || u.email}</b>
                      <span className="tiny muted">{u.name ? u.email + ' · ' : ''}last sign-in {when(u.lastLogin)}</span>
                      <span className="team-tags">
                        <em className={'team-role ' + u.role}>{u.role === 'super' ? 'Site admin (PaperKite)' : 'Restaurant'}</em>
                        {!u.active && <em className="team-tag bad">Switched off</em>}
                        {u.mustChange && <em className="team-tag">Temporary password</em>}
                        {u.sessions > 0 && <em className="team-tag ok">Signed in on {u.sessions}</em>}
                        {self && <em className="team-tag">You</em>}
                      </span>
                    </div>
                    {u.role === 'staff' && (
                      <details className="team-access">
                        <summary>Can use: {u.permissions.length === PARTS.length ? 'everything' : u.permissions.length ? PARTS.filter(([id]) => u.permissions.includes(id)).map(([, l]) => l).join(', ') : 'only their own password'}</summary>
                        <div className="team-access-list">
                          {PARTS.map(([id, label]) => (
                            <label key={id} className="check">
                              <input type="checkbox" checked={u.permissions.includes(id)}
                                onChange={(e) => act(() => admin.updateUser(u.id, { permissions: e.target.checked ? [...u.permissions, id] : u.permissions.filter((p) => p !== id) }))} />
                              {label}
                            </label>
                          ))}
                        </div>
                      </details>
                    )}
                    {!self && (
                      <div className="team-actions">
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => resetPassword(u)}>Reset password</button>
                        {u.sessions > 0 && <button type="button" className="btn btn-outline btn-sm" onClick={() => signOut(u)}>Sign out</button>}
                        <button type="button" className="btn btn-link btn-sm" onClick={() => setRole(u, u.role === 'super' ? 'staff' : 'super')}>{u.role === 'super' ? 'Make restaurant account' : 'Make site admin'}</button>
                        <button type="button" className={'btn btn-link btn-sm' + (u.active ? ' danger' : '')} onClick={() => toggleActive(u)}>{u.active ? 'Switch off' : 'Switch on'}</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <AddAccount onAdded={(email, password) => { setTemp({ email, password }); load(); }} />
        </div>
        <div className="team-side">
          <Features />
          <RecentChanges key={users ? users.length : 0} />
          <EmailSender />
          <Troubleshoot accounts={users} />
        </div>
      </div>
    </div>
  );
}

function AddAccount({ onAdded }) {
  const admin = useAdmin(), toast = useToast();
  const [f, setF] = useState({ email: '', name: '', role: 'staff' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  function submit(e) {
    e.preventDefault();
    admin.addUser(f).then((r) => { onAdded(f.email.trim().toLowerCase(), r.tempPassword); setF({ email: '', name: '', role: 'staff' }); }, (err) => toast(err.message, 'error'));
  }
  return (
    <form className="team-add" onSubmit={submit}>
      <h4>Add an account</h4>
      <div className="field-row">
        <label className="field"><span>Email</span><input type="email" required maxLength="254" value={f.email} onChange={set('email')} placeholder="name@example.com" /></label>
        <label className="field"><span>Name</span><input maxLength="60" value={f.name} onChange={set('name')} placeholder="e.g. Jhamsikhel manager" /></label>
      </div>
      <div className="team-add-row">
        <label className="field"><span>Role</span>
          <select value={f.role} onChange={set('role')}>
            <option value="staff">Restaurant: the parts you tick (all, to start)</option>
            <option value="super">Site admin (PaperKite): everything, plus this Team tab</option>
          </select>
        </label>
        <button type="submit" className="btn btn-red btn-sm"><Icon name="plus" /> Add</button>
      </div>
    </form>
  );
}

// The change log: who changed accounts, access, features or the email sender, and when.
const ACTIONS = {
  'account.create': 'added an account', 'account.change': 'changed an account', 'account.reset-password': 'reset a password',
  'account.sign-out': 'signed someone out', 'sessions.sign-out-everyone': 'signed everyone out', feature: 'switched a feature',
  'email.sender': 'changed the email sender', 'password.forgot': 'set a new password (forgot password)', 'store.reset': 'reset the store settings', 'orders.clear': 'deleted all orders'
};
function RecentChanges() {
  const admin = useAdmin();
  const [list, setList] = useState(null);
  useEffect(() => { admin.audit().then(setList, () => setList([])); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <details className="panel-card recent-changes">
      <summary><h3>Recent changes</h3></summary>
      {!list ? <p className="muted">Loading…</p> : !list.length ? <p className="muted tiny">Nothing yet.</p> : (
        <ul className="signins-list">
          {list.map((r, i) => (
            <li key={i}><span>{when(r.at)}</span><span>{r.actor}</span><span><b>{ACTIONS[r.action] || r.action}</b>{r.detail && ': ' + r.detail}</span></li>
          ))}
        </ul>
      )}
    </details>
  );
}

// Switches for whole features. A new one appears here when it's added to backend/src/features.js.
function Features() {
  const admin = useAdmin(), toast = useToast();
  const [list, setList] = useState(null);
  useEffect(() => { admin.features().then(setList, (e) => toast(e.message, 'error')); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const flip = (f) => admin.setFeature(f.id, !f.enabled).then((l) => { setList(l); toast(f.label + (f.enabled ? ' switched off' : ' switched on')); }, (e) => toast(e.message, 'error'));
  return (
    <div className="panel-card">
      <h3>Features <small className="muted">changes apply at once</small></h3>
      {!list ? <p className="muted">Loading…</p> : (
        <ul className="feature-list">
          {list.map((f) => (
            <li key={f.id}>
              <label className="switch switch-sm"><input type="checkbox" checked={f.enabled} onChange={() => flip(f)} aria-label={f.label} /><span /></label>
              <div><b>{f.label}</b><span className="tiny muted">{f.help}{f.public && ' Visitors see the change on their next page load.'}</span></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Who sends the sign-in codes. The password is write-only: the server never sends it back.
const PROVIDERS = {
  brevo: { label: 'Brevo', host: 'smtp-relay.brevo.com', port: 587 },
  gmail: { label: 'Gmail', host: 'smtp.gmail.com', port: 465 },
  other: { label: 'Other', host: '', port: 587 }
};
const providerOf = (host) => (/brevo\.com$|sendinblue\.com$/.test(host) ? 'brevo' : /gmail\.com$/.test(host) ? 'gmail' : 'other');

function EmailSender() {
  const admin = useAdmin(), toast = useToast();
  const [m, setM] = useState(null);
  const [f, setF] = useState(null);
  const fill = (s) => { setM(s); setF({ from: s.from, password: '', host: s.host, port: s.port, user: s.user, provider: providerOf(s.host) }); };
  useEffect(() => { admin.mailSettings().then(fill, (e) => toast(e.message, 'error')); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const choose = (provider) => setF((x) => ({ ...x, provider, ...(provider === 'other' ? {} : { host: PROVIDERS[provider].host, port: PROVIDERS[provider].port }) }));
  function submit(e) {
    e.preventDefault();
    const { provider, ...body } = f; // eslint-disable-line no-unused-vars
    admin.saveMail(body).then((s) => { fill(s); toast(s.ready ? 'Sender saved. Send yourself a test email below.' : 'Sender saved. Add its password to start sending.'); }, (err) => toast(err.message, 'error'));
  }
  if (!f) return <div className="panel-card"><h3>Email</h3><p className="muted">Loading…</p></div>;
  const keep = m.hasPassword && <em>(saved: leave blank to keep it)</em>;
  return (
    <form className="panel-card team-mail" onSubmit={submit}>
      <h3>Email <small className={m.ready ? 'ok' : 'bad'}>{m.ready ? 'sending sign-in codes' : 'not sending yet: codes go to the server log'}</small></h3>
      <div className="seg-row" role="radiogroup" aria-label="Email service">
        {Object.entries(PROVIDERS).map(([id, p]) => (
          <button key={id} type="button" role="radio" aria-checked={f.provider === id} className={f.provider === id ? 'on' : ''} onClick={() => choose(id)}>{p.label}</button>
        ))}
      </div>
      <label className="field"><span>Sender email {f.provider === 'brevo' && <em>(a sender verified in Brevo)</em>}</span><input type="email" required maxLength="254" value={f.from} onChange={set('from')} /></label>
      {f.provider !== 'gmail' && (
        <label className="field"><span>{f.provider === 'brevo' ? 'SMTP login' : 'Login'} {f.provider === 'other' && <em>(if it isn't the sender email)</em>}</span>
          <input value={f.user} onChange={set('user')} required={f.provider === 'brevo'} maxLength="254" pattern="\S+" title="No spaces" placeholder={f.provider === 'brevo' ? 'e.g. 8a1b2c001@smtp-brevo.com' : ''} />
        </label>
      )}
      <label className="field"><span>{f.provider === 'brevo' ? 'SMTP key' : f.provider === 'gmail' ? 'Gmail app password' : 'Password'} {keep}</span>
        <input type="password" autoComplete="new-password" maxLength="200" value={f.password} onChange={set('password')} placeholder={m.hasPassword ? '••••••••••••••••' : f.provider === 'brevo' ? 'xsmtpsib-…' : ''} />
      </label>
      {f.provider === 'brevo' && <p className="tiny muted"><Icon name="info" /> In Brevo: <b>SMTP & API → SMTP</b> shows the login and lets you generate an <b>SMTP key</b> (not the API key). Add the sender address under <b>Senders, domains & dedicated IPs</b> and verify it, or Brevo won't send from it.</p>}
      {f.provider === 'gmail' && <p className="tiny muted"><Icon name="info" /> Not the Gmail password: an <b>app password</b>. Turn on 2-step verification for that Google account, then create one at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">myaccount.google.com/apppasswords</a>.</p>}
      {f.provider === 'other' && (
        <div className="field-row">
          <label className="field"><span>Server</span><input required maxLength="253" value={f.host} onChange={set('host')} placeholder="smtp.example.com" /></label>
          <label className="field"><span>Port</span><input type="number" required min="1" max="65535" value={f.port} onChange={set('port')} placeholder="587" /></label>
        </div>
      )}
      <button type="submit" className="btn btn-red btn-sm">Save sender</button>
    </form>
  );
}

// Answers "why isn't it working?" without logging in to the server.
function Troubleshoot({ accounts }) {
  const admin = useAdmin(), toast = useToast(), confirm = useConfirm();
  const [d, setD] = useState(null);
  const [mail, setMail] = useState(null);
  const load = () => admin.diagnostics().then(setD, (e) => toast(e.message, 'error'));
  useEffect(() => { load(); }, [accounts]); // eslint-disable-line react-hooks/exhaustive-deps -- again when accounts change

  const testEmail = () => { setMail({ sending: true }); admin.testEmail().then(setMail, (e) => setMail({ ok: false, error: e.message })); };
  async function signOutEveryone() {
    if (!(await confirm('Sign out every account on every device, except you here?', 'Sign out everyone'))) return;
    admin.signOutEveryone().then((r) => { toast('Signed out ' + r.signedOut + ' session' + (r.signedOut === 1 ? '' : 's')); load(); }, (e) => toast(e.message, 'error'));
  }
  if (!d) return <div className="panel-card"><h3>Checks</h3><p className="muted">Loading…</p></div>;
  const backupOld = typeof d.lastBackup === 'string' && d.lastBackup !== 'not set up' && Date.now() - Date.parse(d.lastBackup) > 2 * 86400000;
  const row = (label, value, bad) => <li className={bad ? 'bad' : ''}><span>{label}</span><b>{value}</b></li>;
  return (
    <div className="panel-card">
      <div className="panel-head"><h3>Checks</h3><button type="button" className="btn btn-link btn-sm" onClick={load}>Check again</button></div>
      <ul className="checks">
        {row('Sign-in email', d.email.ready ? 'from ' + d.email.from : 'no password for ' + d.email.from + ': codes go to the server log', !d.email.ready)}
        {row('Database', 'answering in ' + d.database.ms + ' ms (' + d.database.version + ')')}
        {row('Last backup', d.lastBackup === 'not set up' ? 'not set up on this server' : d.lastBackup ? when(d.lastBackup) + (backupOld ? ': over 2 days ago' : '') : 'none found', !d.lastBackup || backupOld)}
        {row('Last order', when(d.lastOrder))}
        {row('Signed in now', d.signedInNow + ' session' + (d.signedInNow === 1 ? '' : 's'))}
        {row('Wrong sign-in tries (24 h)', String(d.failedSignIns24h), d.failedSignIns24h >= 10)}
        {row('Accounts', d.accounts.active + ' active, ' + d.accounts.supers + ' administrator' + (d.accounts.supers === 1 ? '' : 's'))}
        {row('Features on', Object.keys(d.features).filter((id) => d.features[id]).join(', ') || 'none')}
        {row('Server', 'up ' + d.server.uptimeMin + ' min · ' + d.server.memoryMb + ' MB · Node ' + d.server.node)}
      </ul>
      <div className="checks-actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={testEmail} disabled={mail && mail.sending}><Icon name="send" /> Send me a test email</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={signOutEveryone}><Icon name="lock" /> Sign out everyone else</button>
      </div>
      {mail && !mail.sending && (
        <p className={'signins-warn ' + (mail.ok ? 'ok' : 'bad')}><Icon name={mail.ok ? 'check-circle' : 'alert'} />
          {mail.ok ? 'Sent to ' + mail.to + '. If it doesn\'t arrive in a minute, check the spam folder.' : 'Email failed: ' + mail.error}</p>
      )}
    </div>
  );
}
