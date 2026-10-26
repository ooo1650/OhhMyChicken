/* Path router (/, /menu, /menu/chicken-pizza…) on the History API.
   `n` changes on every navigation, including a click on the link you are
   already on (e.g. scrolling to /find twice). */
import { useEffect, useState } from 'react';

const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());
const current = () => ({ pathname: location.pathname, params: Object.fromEntries(new URLSearchParams(location.search)) });

export function useRoute() {
  const [route, setRoute] = useState(() => ({ ...current(), n: 0 }));
  useEffect(() => {
    const go = () => setRoute((r) => ({ ...current(), n: r.n + 1 }));
    listeners.add(go);
    window.addEventListener('popstate', go);
    return () => { listeners.delete(go); window.removeEventListener('popstate', go); };
  }, []);
  return route;
}

export function navigate(to, opts = {}) {
  if (to !== location.pathname + location.search) history[opts.replace ? 'replaceState' : 'pushState'](null, '', to);
  notify();
}

// A real <a href> (crawlable, opens in a new tab with ctrl/cmd) that routes in-app on a plain click.
export function Link({ to, onClick, children, ...rest }) {
  return (
    <a href={to} {...rest} onClick={(e) => {
      if (onClick) onClick(e);
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigate(to);
    }}>
      {children}
    </a>
  );
}
