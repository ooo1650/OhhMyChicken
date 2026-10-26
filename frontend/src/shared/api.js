/* JSON API client. Same origin: the frontend server (or the Vite dev proxy) forwards /api
   to the backend, so the admin session cookie just works. */
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

async function send(path, opts) {
  let r;
  try { r = await fetch('/api/' + path, { credentials: 'same-origin', ...opts }); }
  catch (e) { throw new Error('Could not reach the server. Check your connection.'); }
  const data = await r.json().catch(() => ({}));
  if (r.ok) return data;
  const err = new Error(data.error || (r.status === 413 ? 'That file is too big.' : 'Could not reach the server.'));
  err.status = r.status;
  if (r.status === 401 && onUnauthorized) onUnauthorized();
  throw err;
}

export function api(method, path, body) {
  const opts = { method, headers: { Accept: 'application/json' } };
  if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  return send(path, opts);
}

// Upload a photo: the file itself is the request body.
export function uploadImage(path, file) {
  return send(path, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      // Some systems give photo files no type; the server checks the bytes anyway.
      'Content-Type': /^image\//.test(file.type) ? file.type : 'image/unknown',
      'X-File-Name': encodeURIComponent(file.name || '')
    },
    body: file
  });
}

export const loadBootstrap = () => api('GET', 'bootstrap');
