/* Orders — KPIs, top sellers, live order list with status changes. */
import { useState } from 'react';
import { useAdmin } from './store.jsx';
import { useConfirm } from './confirm.jsx';
import { Kpi } from './Kpi.jsx';
import { Icon } from '../shared/Icon.jsx';
import { useToast } from '../shared/toast.jsx';

export const STATUSES = [
  { id: 'new', label: 'New' }, { id: 'preparing', label: 'Preparing' }, { id: 'delivering', label: 'Out for delivery' },
  { id: 'done', label: 'Done' }, { id: 'cancelled', label: 'Cancelled' }
];
const OPEN = ['new', 'preparing', 'delivering'];
const statusOf = (id) => STATUSES.find((x) => x.id === id) || STATUSES[0];

/** live: true / false (poll failed); flash: ids of orders that just arrived */
export function OrdersPanel({ hidden, live, flash }) {
  const admin = useAdmin(), toast = useToast(), confirm = useConfirm();
  const { orders } = admin;
  const [filter, setFilter] = useState('open');

  const valid = orders.filter((o) => o.status !== 'cancelled');
  const open = orders.filter((o) => OPEN.includes(o.status));
  const revenue = valid.reduce((n, o) => n + o.total, 0);

  const tally = {};
  valid.forEach((o) => o.items.forEach((i) => { tally[i.name] = (tally[i.name] || 0) + i.qty; }));
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = top.length ? top[0][1] : 1;

  const shown = orders.filter((o) => filter === 'all' || (filter === 'open' ? OPEN.includes(o.status) : o.status === filter)).slice(0, 60);

  function setStatus(o, status) {
    admin.setOrderStatus(o.id, status).then(() => toast('Order #' + o.id + ' → ' + statusOf(status).label), (err) => toast(err.message, 'error'));
  }
  async function clear() {
    if (await confirm('Clear the whole order log? This cannot be undone.', 'Clear')) admin.clearOrders();
  }

  return (
    <div className="admin-panel" hidden={hidden}>
      <div className="admin-kpis">
        <Kpi label="Orders" val={valid.length} />
        <Kpi label="Open now" val={open.length} cls={open.length ? 'warn' : ''} />
        <Kpi label="Revenue" val={admin.money(revenue)} />
        <Kpi label="Avg order" val={admin.money(valid.length ? Math.round(revenue / valid.length) : 0)} />
        <Kpi label="Promo used" val={valid.filter((o) => o.discount > 0).length} />
      </div>
      <div className="orders-grid">
        <div className="panel-card">
          <h3>Top sellers</h3>
          <ol className="bars">
            {top.length
              ? top.map(([name, n]) => <li key={name}><span>{name}</span><i style={{ '--w': Math.round(n / max * 100) + '%' }} /><b>{n}</b></li>)
              : <li className="muted">No orders yet. New orders appear here.</li>}
          </ol>
        </div>
        <div className="panel-card orders-card">
          <div className="panel-head">
            <h3>Orders</h3>
            <span className={'live-pill' + (live ? '' : ' off')} title="Checks for new orders every 20 seconds">{live ? 'Live' : 'Offline'}</span>
          </div>
          <div className="chips order-filter" role="tablist" aria-label="Filter orders">
            {[['open', 'Open'], ['done', 'Done'], ['cancelled', 'Cancelled'], ['all', 'All']].map(([id, label]) => (
              <button key={id} type="button" className="chip chip-sm" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>
          <ul className="order-list" aria-live="polite">
            {shown.map((o) => {
              const st = statusOf(o.status);
              return (
                <li key={o.id} className={'order st-' + st.id + (flash.has(o.id) ? ' is-new-flash' : '')}>
                  <div className="order-top"><span className="order-no">#{o.id}</span><b>{o.name}</b></div>
                  <select className="order-status" value={st.id} onChange={(e) => setStatus(o, e.target.value)} aria-label={'Status of order #' + o.id}>
                    {STATUSES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </select>
                  <b className="order-total">{admin.money(o.total)}</b>
                  <div className="order-meta">
                    <small className="order-items">
                      {o.items.map((i) => i.qty + '× ' + i.name + ' (' + i.label + ')').join(', ')}
                      {o.discount > 0 && <> · <b>promo −{admin.money(o.discount)}</b></>}
                    </small>
                    <small><Icon name="clock" />{new Date(o.at).toLocaleString()}</small>
                    {o.phone && <small><Icon name="phone" /><a href={'tel:' + o.phone.replace(/[^\d+]/g, '')}>{o.phone}</a></small>}
                    {o.address && <small><Icon name="pin" />{o.address}</small>}
                  </div>
                </li>
              );
            })}
            {!shown.length && <li className="muted">{orders.length ? 'No orders in this view.' : 'Nothing here yet.'}</li>}
          </ul>
          <div className="admin-bulk">
            <a className="btn btn-outline btn-sm" href="/api/orders.csv" download><Icon name="download" /> Export CSV</a>
            <button className="btn btn-link btn-sm danger" onClick={clear}><Icon name="trash" /> Clear order log</button>
          </div>
        </div>
      </div>
    </div>
  );
}
