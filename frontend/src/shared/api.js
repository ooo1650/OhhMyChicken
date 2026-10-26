/* JSON API client. Same origin: the frontend server (or the Vite dev proxy) forwards /api
   to the backend, so the admin session cookie just works. */
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

export async function api(method, path, body) {
  const opts = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  let r;
  try { r = await fetch('/api/' + path, opts); }
  catch (e) { throw new Error('Could not reach the server. Check your connection.'); }
  const data = await r.json().catch(() => ({}));
  if (r.ok) return data;
  const err = new Error(data.error || 'Could not reach the server.');
  err.status = r.status;
  if (r.status === 401 && onUnauthorized) onUnauthorized();
  throw err;
}

export const loadBootstrap = () => api('GET', 'bootstrap');
