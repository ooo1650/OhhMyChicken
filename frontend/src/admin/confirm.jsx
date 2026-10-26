/* Promise-based confirm dialog: `await confirm('Delete it?', 'Delete')`. */
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useLayer } from '../shared/layer.js';

const ConfirmCtx = createContext(() => Promise.resolve(false));
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({ open: false, text: '', yes: '' });
  const resolver = useRef(null), result = useRef(false), ref = useRef(null);
  const done = (v) => { result.current = v; setState((s) => ({ ...s, open: false })); };
  const { hidden, isOpen } = useLayer(state.open, ref, {
    onClose: () => done(false),
    focus: '.btn-link',
    onClosed: () => { if (resolver.current) { resolver.current(result.current); resolver.current = null; } }
  });

  const confirm = useCallback((text, yesLabel) => new Promise((resolve) => {
    resolver.current = resolve;
    result.current = false;
    setState({ open: true, text, yes: yesLabel || 'Yes, do it' });
  }), []);

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <div className={'modal' + (isOpen ? ' is-open' : '')} ref={ref} role="alertdialog" aria-modal="true" aria-labelledby="confirmText" hidden={hidden}>
        <div className="modal-backdrop" />
        <div className="modal-card confirm-card">
          <p id="confirmText">{state.text}</p>
          <div className="modal-actions">
            <button className="btn btn-link" onClick={() => done(false)}>Cancel</button>
            <button className="btn btn-red" onClick={() => done(true)}>{state.yes}</button>
          </div>
        </div>
      </div>
    </ConfirmCtx.Provider>
  );
}
