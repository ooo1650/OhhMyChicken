/* Anonymous usage events → POST /api/t (stored without cookies or IPs; see
   backend/src/analytics.js). Batched, sent in the background, and switched
   off entirely when the browser asks not to be tracked. */
const OFF = typeof navigator === 'undefined' ||
  navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
const queue = [];
let timer = null;

function flush() {
  clearTimeout(timer);
  timer = null;
  while (queue.length) {
    // keepalive lets the request finish even while the tab is closing.
    fetch('/api/t', {
      method: 'POST', keepalive: true, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: queue.splice(0, 20) })
    }).catch(() => {});
  }
}

export function track(name, props) {
  if (OFF) return;
  queue.push({ name, ...props });
  if (queue.length >= 10) flush();
  else if (!timer) timer = setTimeout(flush, 4000);
}

if (!OFF) {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}
