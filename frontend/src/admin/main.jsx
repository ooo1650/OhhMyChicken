import { createRoot } from 'react-dom/client';
import '../styles/styles.css';
import '../styles/admin.css';
import { loadBootstrap } from '../shared/api.js';
import { ToastProvider } from '../shared/toast.jsx';
import { ConfirmProvider } from './confirm.jsx';
import { AdminProvider } from './store.jsx';
import { AdminApp } from './AdminApp.jsx';

const root = createRoot(document.getElementById('root'));

loadBootstrap().then((boot) => {
  root.render(
    <ToastProvider>
      <ConfirmProvider>
        <AdminProvider boot={boot}><AdminApp /></AdminProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}, () => {
  root.render(
    <main className="boot-error">
      <h1>Dashboard offline</h1>
      <p>Could not reach the server. Check that the backend is running, then try again.</p>
      <button className="btn btn-red" onClick={() => location.reload()}>Try again</button>
    </main>
  );
});
