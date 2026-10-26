/* Dialogs and drawers: open/close transitions (.is-open), focus trap, Esc,
   scroll lock and focus return. Several can be open; the top one gets keys. */
import { useEffect, useRef, useState } from 'react';

const stack = [];
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])';

function lockScroll() { document.documentElement.classList.toggle('no-scroll', stack.length > 0); }

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    const top = stack[stack.length - 1];
    if (!top || !top.ref.current) return;
    if (e.key === 'Escape') { e.preventDefault(); top.close(); return; }
    if (e.key === 'Tab') {
      const f = [...top.ref.current.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

/**
 * @param open     whether the layer should be open
 * @param ref      ref to the layer's root element
 * @param opts     { onClose, focus: selector, modal: true, onClosed }
 * @returns { hidden, isOpen } to put on the element (hidden attr, is-open class)
 */
export function useLayer(open, ref, opts = {}) {
  const [hidden, setHidden] = useState(!open);
  const [isOpen, setIsOpen] = useState(false);
  const optsRef = useRef(opts);
  const hideTimer = useRef(null);
  optsRef.current = opts;

  useEffect(() => {
    if (!open) return undefined;
    const o = optsRef.current, modal = o.modal !== false;
    const entry = { ref, close: () => optsRef.current.onClose && optsRef.current.onClose(), returnTo: document.activeElement };
    if (modal) { stack.push(entry); lockScroll(); }
    clearTimeout(hideTimer.current);
    setHidden(false);
    const raf = requestAnimationFrame(() => {
      setIsOpen(true);
      const el = ref.current;
      if (!el) return;
      const target = o.focus ? el.querySelector(o.focus)
        : (el.querySelector('.modal-card, .drawer-body, .chat-form') || el).querySelector(FOCUSABLE);
      if (target) target.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(raf);
      setIsOpen(false);
      hideTimer.current = setTimeout(() => setHidden(true), 220);
      if (modal) {
        const i = stack.indexOf(entry);
        if (i !== -1) stack.splice(i, 1);
        lockScroll();
        if (entry.returnTo && entry.returnTo.focus && document.contains(entry.returnTo)) entry.returnTo.focus({ preventScroll: true });
      }
      if (optsRef.current.onClosed) optsRef.current.onClosed();
    };
  }, [open, ref]);

  return { hidden, isOpen };
}
