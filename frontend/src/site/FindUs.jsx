/* Find us — a numbered list of branches, and (when opened) a hand-drawn map
   of the Kathmandu valley (ValleyMap.jsx). Picking a pin or a row opens that
   branch: how to find it, phones, WhatsApp and directions. */
import { lazy, Suspense, useRef, useState } from 'react';
import { useSite } from './store.jsx';
import { Icon } from '../shared/Icon.jsx';
import { fmt12 } from '../shared/format.js';
import { onMap, outletList, outletHours, outletOpen, outletWhatsApp, telHref, mapHref } from '../shared/outlets.js';

// The map's drawing code is only downloaded when someone opens it (remembered per browser).
const ValleyMap = lazy(() => import('./ValleyMap.jsx'));
const MAP_KEY = 'omc.findMap.v1';
const readOpen = () => { try { return localStorage.getItem(MAP_KEY) === '1'; } catch (e) { return false; } };

function Branch({ o, n, open: expanded, onPick }) {
  const site = useSite(), s = site.settings;
  const h = outletHours(o, s), isOpen = outletOpen(o, s, site.now), wa = outletWhatsApp(o, s);
  const id = 'branch-' + (o.id || 'main');
  // Skip an address that only repeats the name and area shown above it.
  const said = [o.area, o.name + ', ' + o.area, o.name].map((x) => String(x).toLowerCase());
  const address = o.address && !said.includes(o.address.toLowerCase()) ? o.address : '';
  return (
    <li className={'branch' + (expanded ? ' on' : '')}>
      <button type="button" className="branch-row" aria-expanded={expanded} aria-controls={id} onClick={() => onPick(o.id)}>
        <span className="branch-no">{String(n).padStart(2, '0')}</span>
        <span className="branch-name">{o.name}<small>{[o.area !== o.name && o.area, o.main && !o.single && 'main branch'].filter(Boolean).join(' · ')}</small></span>
        <span className={'branch-open' + (isOpen ? ' yes' : '')}>{isOpen ? 'Open' : 'Closed'}</span>
        <Icon name="chevron-down" className="branch-chev" />
      </button>
      {/* Stays in the page so it can slide; inert keeps a closed branch's links out of reach. */}
      <div className="branch-panel" id={id} inert={!expanded}><div className="branch-clip"><div className="branch-body">
        {address && <p className="branch-addr">{address}</p>}
        {o.landmark && <p className="branch-look"><b>Look for:</b> {o.landmark}</p>}
        <p className="branch-meta">{fmt12(h.hoursOpen)} – {fmt12(h.hoursClose)}{o.delivery && <> · {o.delivery}</>}</p>
        {o.phones.length > 0 && <p className="branch-phones">{o.phones.map((p) => <a key={p} href={telHref(p)}><Icon name="phone" />{p}</a>)}</p>}
        <div className="branch-actions">
          {wa && <a className="btn btn-red btn-sm" href={'https://wa.me/' + wa} target="_blank" rel="noopener"><Icon name="whatsapp" /> WhatsApp</a>}
          <a className="btn btn-outline btn-sm" href={mapHref(o, s)} target="_blank" rel="noopener"><Icon name="route" /> Directions</a>
          {o.instagram && <a className="branch-social" href={o.instagram} target="_blank" rel="noopener" aria-label={o.name + ' on Instagram'}><Icon name="instagram" /></a>}
          {o.facebook && <a className="branch-social" href={o.facebook} target="_blank" rel="noopener" aria-label={o.name + ' on Facebook'}><Icon name="external" /></a>}
        </div>
      </div></div></div>
    </li>
  );
}

export function FindUs() {
  const site = useSite(), s = site.settings;
  const outlets = outletList(s);
  const first = (outlets.find((o) => o.main) || outlets[0]).id;
  const [sel, setSel] = useState(first);
  const current = outlets.some((o) => o.id === sel) ? sel : first;
  const [expanded, setExpanded] = useState(true);
  const listRef = useRef(null);
  const show = (id) => { setSel(id); setExpanded(true); };
  // Tapping the open branch closes it. When another one opens, the page is held so the
  // tapped row stays under the finger while the one above closes. Scrolling lets go.
  const pick = (id) => {
    if (id === current && expanded) { setExpanded(false); return; }
    const row = listRef.current.querySelector('[aria-controls="branch-' + (id || 'main') + '"]');
    const from = row.getBoundingClientRect().top, started = performance.now();
    let held = true;
    const letGo = () => { held = false; };
    window.addEventListener('wheel', letGo, { once: true, passive: true });
    window.addEventListener('touchstart', letGo, { once: true, passive: true });
    const hold = () => {
      if (held) window.scrollBy({ top: row.getBoundingClientRect().top - from, behavior: 'instant' });
      if (held && performance.now() - started < 420) requestAnimationFrame(hold);
      else { window.removeEventListener('wheel', letGo); window.removeEventListener('touchstart', letGo); }
    };
    show(id);
    requestAnimationFrame(hold);
  };
  const mapped = outlets.some(onMap);
  const [showMap, setShowMap] = useState(readOpen);
  const toggleMap = () => setShowMap((v) => { try { localStorage.setItem(MAP_KEY, v ? '0' : '1'); } catch (e) { /* private mode */ } return !v; });
  const withMap = mapped && showMap;
  return (
    <section className="section section-light find" id="find" aria-labelledby="findTitle">
      <div className={'wrap find-layout' + (withMap ? '' : ' no-map')}>
        <div className="find-copy">
          <h2 className="tilt-title" id="findTitle"><span>Find</span> <span className="hl">us</span></h2>
          <p className="find-intro">
            {outlets.length > 1 ? outlets.length + ' kitchens' + (outlets.every(onMap) ? ' across the valley' : '') + ', ' : ''}open daily {fmt12(s.hoursOpen)} – {fmt12(s.hoursClose)}.
          </p>
          {mapped && (
            <button type="button" className="btn btn-outline btn-sm map-toggle" aria-expanded={showMap} aria-controls="findMap" onClick={toggleMap}>
              <Icon name={showMap ? 'x' : 'pin'} /> {showMap ? 'Hide map' : 'Show on map'}
            </button>
          )}
        </div>
        <ol className="branch-list" ref={listRef}>
          {outlets.map((o, i) => <Branch key={o.id || 'main'} o={o} n={i + 1} open={expanded && o.id === current} onPick={pick} />)}
        </ol>
        {withMap && (
          <div className="find-map" id="findMap">
            <Suspense fallback={<div className="valley valley-loading" aria-label="Loading map" />}>
              <ValleyMap outlets={outlets} sel={current} onPick={show} />
            </Suspense>
          </div>
        )}
      </div>
    </section>
  );
}
