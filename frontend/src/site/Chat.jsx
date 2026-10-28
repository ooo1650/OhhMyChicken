/* ==========================================================================
   Chicky — in-browser support chat panel. Replies come from bot.js.
   ========================================================================== */
import { useEffect, useRef, useState } from 'react';
import { useSite } from './store.jsx';
import { navigate } from './router.jsx';
import { makeBot } from './bot.js';
import { Icon } from '../shared/Icon.jsx';
import { esc, reducedMotion } from '../shared/format.js';
import { categoryPath } from '../shared/seo.js';
import { track } from '../shared/track.js';

const QUICK = ['Hours', 'Size for 8 people', 'Veg options', 'MoMo', 'Delivery', 'Deals'];

export function Chat() {
  const site = useSite(), open = site.chatOpen;
  const [log, setLog] = useState([]); // { id, who, html, actions }
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [hidden, setHidden] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [pinged, setPinged] = useState(false);
  const greeted = useRef(false), seq = useRef(0), logRef = useRef(null), inputRef = useRef(null), fabRef = useRef(null);
  const siteRef = useRef(site);
  siteRef.current = site;

  // Keep the last 60 messages, so a long session can't grow without end.
  const push = (who, html, actions) => setLog((l) => [...l, { id: ++seq.current, who, html, actions }].slice(-60));
  const botSay = (res) => {
    setTyping(true);
    setTimeout(() => { setTyping(false); push('bot', res.html, res.actions); }, reducedMotion ? 0 : 450 + Math.random() * 350);
  };

  // Open / close with the panel's CSS transition.
  useEffect(() => {
    if (open) {
      track('chat_open');
      setHidden(false);
      setPinged(true);
      requestAnimationFrame(() => setIsOpen(true));
      if (!greeted.current) { greeted.current = true; botSay(makeBot(siteRef.current).greet()); }
      const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
      return () => clearTimeout(t);
    }
    setIsOpen(false);
    const t = setTimeout(() => setHidden(true), 220);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log, typing]);

  const close = (refocus) => { site.setChatOpen(false); if (refocus) fabRef.current.focus(); };

  // Spam guard: more than 5 messages in 10 seconds pauses the chat for 8 seconds.
  // (The bot runs in the browser and nothing typed here is sent to the server.)
  const sent = useRef([]);
  const [pausedUntil, setPausedUntil] = useState(0);
  useEffect(() => {
    if (!pausedUntil) return undefined;
    const t = setTimeout(() => { setPausedUntil(0); requestAnimationFrame(() => inputRef.current && inputRef.current.focus()); }, pausedUntil - Date.now());
    return () => clearTimeout(t);
  }, [pausedUntil]);

  function send(msg) {
    msg = String(msg).trim().slice(0, 200);
    if (!msg || pausedUntil) return;
    const now = Date.now();
    sent.current = sent.current.filter((t) => now - t < 10000).concat(now);
    if (sent.current.length > 5) {
      sent.current = [];
      setPausedUntil(now + 8000);
      push('bot', 'Whoa, slow down! My little chicken brain needs a few seconds. 🐔');
      return;
    }
    push('user', esc(msg));
    botSay(makeBot(site).answer(msg.replace(/^[^\w\d]+\s*/, '')));
  }

  function act(a) {
    const p = a.split(':');
    switch (p[0]) {
      case 'go': navigate('/' + p[1]); break;
      case 'cat': { const c = site.categories.find((x) => x.id === p[1]); navigate(c ? categoryPath(c) : '/menu'); break; }
      case 'diet': navigate('/menu'); site.setMenuDiet(p[1]); break;
      case 'search': navigate('/menu'); site.setMenuDiet('all'); site.setMenuQuery(p.slice(1).join(':')); break;
      case 'cart': close(); site.setCartOpen(true); break;
      case 'promo': site.applyCode(site.settings.promo.code); close(); site.setCartOpen(true); break;
      case 'add': {
        const label = p.slice(2).join(':'), it = site.getItem(p[1]);
        site.addToCart(p[1], label, 1);
        track('add_to_cart', { item_id: p[1], value: label, num: 1 });
        push('bot', 'Added <b>' + esc(it ? it.name : 'item') + ' (' + esc(label) + ')</b> to your order.', [{ label: 'View order', act: 'cart' }]);
        break;
      }
      default:
    }
  }

  return (
    <>
      <button className={'chat-fab' + (open ? ' is-open' : '')} ref={fabRef} aria-label="Open chat assistant" aria-expanded={open} aria-controls="chatPanel"
        onClick={() => site.setChatOpen(!open)}>
        <span className="chat-fab-ico" aria-hidden="true"><Icon name="chat" /></span>
        <span className="chat-ping" aria-hidden="true" hidden={pinged} />
      </button>
      <section className={'chat-panel' + (isOpen ? ' is-open' : '')} id="chatPanel" role="dialog" aria-label="Chat with Chicky" hidden={hidden}
        onKeyDown={(e) => { if (e.key === 'Escape') close(true); }}>
        <header className="chat-head">
          <div className="chat-avatar" aria-hidden="true"><Icon name="cat-fried-chicken" /></div>
          <div>
            <b>Chicky</b>
            <span className="chat-status">{(site.isOpen ? 'Restaurant open' : 'Restaurant closed') + ' · bot replies instantly'}</span>
          </div>
          <button className="icon-btn close-btn" aria-label="Close chat" onClick={() => close(true)}><Icon name="x" /></button>
        </header>
        <div className="chat-log" ref={logRef} aria-live="polite">
          {log.map((m) => (
            <div key={m.id} className={'msg msg-' + m.who}>
              <div className="bubble">
                <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: m.html }} />
                {m.actions && m.actions.length > 0 && (
                  <div className="bot-actions">
                    {m.actions.map((a) => <button key={a.act} type="button" onClick={() => act(a.act)}>{a.label}</button>)}
                  </div>
                )}
              </div>
            </div>
          ))}
          {typing && <div className="msg msg-bot typing"><div className="bubble"><i /><i /><i /></div></div>}
        </div>
        <div className="chat-quick">
          {QUICK.map((q) => <button key={q} type="button" disabled={!!pausedUntil} onClick={() => send(q)}>{q}</button>)}
        </div>
        <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send(text); setText(''); }}>
          <input type="text" ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder={pausedUntil ? 'One moment…' : 'Ask about hours, sizes, veg…'} aria-label="Message" autoComplete="off" maxLength="200" disabled={!!pausedUntil} />
          <button type="submit" className="icon-btn send-btn" aria-label="Send" disabled={!!pausedUntil}><Icon name="send" /></button>
        </form>
      </section>
    </>
  );
}
