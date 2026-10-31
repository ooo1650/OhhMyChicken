import { createRoot } from 'react-dom/client';
// Fonts are bundled and served by this site (cached for a year), not fetched from Google.
import '@fontsource/lilita-one/400.css';
import '@fontsource-variable/rubik';
import '../styles/styles.css';
import { loadBootstrap } from '../shared/api.js';
import { ToastProvider } from '../shared/toast.jsx';
import { SiteProvider } from './store.jsx';
import { App } from './App.jsx';

// Old hash links (printed table QR codes: /#/menu?table=7) → real URLs.
if (location.hash.startsWith('#/')) {
  const h = location.hash.slice(2);
  history.replaceState(null, '', h.startsWith('offer') ? '/?offer=1' : '/' + h);
}

// The server inlines the menu & settings in the page; fetch them only when it couldn't.
function inlineBoot() {
  const el = document.getElementById('boot-data');
  try { return el ? JSON.parse(el.textContent) : null; } catch (e) { return null; }
}

const root = createRoot(document.getElementById('root'));
const boot = inlineBoot();

(boot ? Promise.resolve(boot) : loadBootstrap()).then((data) => {
  root.render(
    <ToastProvider>
      <SiteProvider boot={data}><App /></SiteProvider>
    </ToastProvider>
  );
}, () => {
  root.render(
    <main className="boot-error">
      <h1>Ohh no!</h1>
      <p>We couldn't load the menu. Check your connection and try again.</p>
      <button className="btn btn-red" onClick={() => location.reload()}>Try again</button>
    </main>
  );
});
