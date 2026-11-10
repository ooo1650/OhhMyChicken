/* Team — for the site administrator only: dashboard accounts (add, reset a
   forgotten password, switch off, sign out) and checks for when something
   isn't working (email, database, backups). The server enforces all of it. */
import { useEffect, useState } from 'react';
import { useAdmin } from './store.jsx';
import { useConfirm } from './confirm.jsx';
import { Icon } from '../shared/Icon.jsx';
import { useToast } from '../shared/toast.jsx';

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
  const setRole = (u, role) => act(() => admin.updateUser(u.id, { role }), u.email + ' is now ' + (role === 'super' ? 'an administrator' : 'staff'));
  const signOut = (u) => act(() => admin.signOutUser(u.id), u.email + ' signed out everywhere');

  return (
    <div className="admin-panel team" hidden={hidden}>
      <div className="panel-head">
        <div>
          <h2><Icon name="users" /> Team</h2>
          <p className="muted tiny">Only you see this tab. Staff sign in with their own email and password, then a code sent to that email.</p>
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
                        <em className={'team-role ' + u.role}>{u.role === 'super' ? 'Administrator' : 'Staff'}</em>
                        {!u.active && <em className="team-tag bad">Switched off</em>}
                        {u.mustChange && <em className="team-tag">Temporary password</em>}
                        {u.sessions > 0 && <em className="team-tag ok">Signed in on {u.sessions}</em>}
                        {self && <em className="team-tag">You</em>}
                      </span>
                    </div>
                    {!self && (
                      <div className="team-actions">
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => resetPassword(u)}>Reset password</button>
                        {u.sessions > 0 && <button type="button" className="btn btn-outline btn-sm" onClick={() => signOut(u)}>Sign out</button>}
                        <button type="button" className="btn btn-link btn-sm" onClick={() => setRole(u, u.role === 'super' ? 'staff' : 'super')}>{u.role === 'super' ? 'Make staff' : 'Make administrator'}</button>
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
        <Troubleshoot accounts={users} />
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
            <option value="staff">Staff: menu, orders, photos, outlets, store</option>
            <option value="super">Administrator: also accounts, Insights and checks</option>
          </select>
        </label>
        <button type="submit" className="btn btn-red btn-sm"><Icon name="plus" /> Add</button>
      </div>
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
        {row('Sign-in email', d.email.configured ? 'from ' + d.email.from : 'not set up: codes go to the server log', !d.email.configured)}
        {row('Database', 'answering in ' + d.database.ms + ' ms (' + d.database.version + ')')}
        {row('Last backup', d.lastBackup === 'not set up' ? 'not set up on this server' : d.lastBackup ? when(d.lastBackup) + (backupOld ? ': over 2 days ago' : '') : 'none found', !d.lastBackup || backupOld)}
        {row('Last order', when(d.lastOrder))}
        {row('Signed in now', d.signedInNow + ' session' + (d.signedInNow === 1 ? '' : 's'))}
        {row('Wrong sign-in tries (24 h)', String(d.failedSignIns24h), d.failedSignIns24h >= 10)}
        {row('Accounts', d.accounts.active + ' active, ' + d.accounts.supers + ' administrator' + (d.accounts.supers === 1 ? '' : 's'))}
        {row('Insights for staff', d.insightsForStaff ? 'on' : 'off (INSIGHTS_ENABLED)')}
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
