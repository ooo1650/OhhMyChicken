/* Cloudflare Worker for hosting the site on Cloudflare: the built pages come from
   dist/ (see wrangler.jsonc), and /api and /media go to the backend, so the browser
   sees one site and the dashboard's sign-in cookie just works.
   The backend needs, on its side: ALLOWED_ORIGINS=https://<this site> (writes from
   here are allowed) and TRUST_PROXY=2 (this Worker + the host's proxy), so it sees
   each visitor's address for its rate limits instead of Cloudflare's. */

// Connection headers describe one hop; passing them on invites request smuggling.
const HOP = ['connection', 'keep-alive', 'proxy-connection', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host'];

async function toBackend(request, env, url) {
  const target = new URL(url.pathname + url.search, env.BACKEND_URL);
  const headers = new Headers(request.headers);
  HOP.forEach((h) => headers.delete(h));
  // The visitor's address as Cloudflare saw it, replacing anything the visitor sent,
  // so a faked X-Forwarded-For can't dodge the backend's limits.
  headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || '');
  headers.set('X-Forwarded-Proto', 'https');
  headers.set('X-Forwarded-Host', url.host);
  // Read whole (JSON, or a photo of at most 10 MB): works the same in Workers and Node.
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
  try {
    const res = await fetch(target, { method: request.method, headers, body, redirect: 'manual' });
    return new Response(res.body, res); // status, headers (cookies included) and body as they are
  } catch (e) {
    return Response.json({ error: 'The kitchen server is not answering. Please try again.' }, { status: 502 });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) return toBackend(request, env, url);
    return env.ASSETS.fetch(request);
  }
};
