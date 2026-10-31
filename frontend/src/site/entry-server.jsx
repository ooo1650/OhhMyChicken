/* Renders a page to HTML, so it arrives with its real content before any script
   runs. Used by the Node server (live data) and scripts/prerender.mjs (static files). */
import { renderToString } from 'react-dom/server';
import { ToastProvider } from '../shared/toast.jsx';
import { SiteProvider } from './store.jsx';
import { setServerPath } from './router.jsx';
import { App } from './App.jsx';

export function render(pathname, boot, at) {
  setServerPath(pathname);
  return renderToString(
    <ToastProvider>
      <SiteProvider boot={boot} at={at}><App /></SiteProvider>
    </ToastProvider>
  );
}
