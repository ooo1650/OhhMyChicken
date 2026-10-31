/* Photo gallery on the home page (photos marked "Show in gallery" in the
   dashboard) with a lightbox: arrows / ← → to browse, Esc to close. */
import { useRef, useState } from 'react';
import { useSite } from './store.jsx';
import { Link } from './router.jsx';
import { Photo } from '../shared/Photo.jsx';
import { Icon } from '../shared/Icon.jsx';
import { useLayer } from '../shared/layer.js';
import { track } from '../shared/track.js';

function Lightbox({ photos, index, onIndex, onClose }) {
  const ref = useRef(null);
  const open = index != null;
  const { hidden, isOpen } = useLayer(open, ref, { onClose, focus: '.close-btn' });
  const [last, setLast] = useState(null); // keep the photo on screen while the box fades out
  const p = open ? photos[index] : last;
  if (open && p !== last) setLast(p);
  const step = (d) => onIndex((index + d + photos.length) % photos.length);

  return (
    <div className={'modal lightbox' + (isOpen ? ' is-open' : '')} ref={ref} role="dialog" aria-modal="true" aria-label="Photo" hidden={hidden}
      onKeyDown={(e) => { if (photos.length > 1 && e.key === 'ArrowRight') step(1); if (photos.length > 1 && e.key === 'ArrowLeft') step(-1); }}>
      <div className="modal-backdrop" onClick={onClose} />
      {p && (
        <figure className="modal-card">
          <button className="icon-btn close-btn" onClick={onClose} aria-label="Close photo"><Icon name="x" /></button>
          {photos.length > 1 && <>
            <button className="icon-btn lightbox-nav lightbox-prev" onClick={() => step(-1)} aria-label="Previous photo"><Icon name="arrow-right" className="flip" /></button>
            <button className="icon-btn lightbox-nav lightbox-next" onClick={() => step(1)} aria-label="Next photo"><Icon name="arrow-right" /></button>
          </>}
          <Photo key={p.id} media={p} sizes="(max-width: 1100px) 92vw, 1100px" eager />
          {p.alt && <figcaption>{p.alt}</figcaption>}
        </figure>
      )}
    </div>
  );
}

export function Gallery() {
  const site = useSite(), { settings } = site;
  const [index, setIndex] = useState(null);
  // TODO(photos): the real kitchen photos go in Dashboard → Photos: upload them, describe
  // each one, and turn on "Gallery". 3–6 look right. One alone hides the section.
  const gallery = site.gallery.slice(0, 6);
  if (gallery.length < 2) return null;
  return (
    <section className="section gallery" aria-labelledby="galleryTitle">
      <div className="wrap">
        <div className="section-head">
          <p className="eyebrow">Fresh from our kitchen in {settings.city}</p>
          <h2 className="tilt-title" id="galleryTitle"><span>Hot</span> <span className="hl">off the oven</span></h2>
        </div>
        <ul className={'gallery-grid' + (gallery.length === 2 ? ' two' : '')}>
          {gallery.map((p, i) => (
            <li key={p.id}>
              <button type="button" onClick={() => { setIndex(i); track('gallery_open'); }} aria-label={'View photo: ' + (p.alt || 'photo ' + (i + 1))}>
                <Photo media={p} alt={p.alt || 'A dish from our kitchen'} sizes="(max-width: 480px) 100vw, (max-width: 900px) 50vw, 33vw" />
              </button>
            </li>
          ))}
        </ul>
        <div className="center mt"><Link to="/menu" className="btn btn-yellow">Order what you see</Link></div>
      </div>
      <Lightbox photos={gallery} index={index} onIndex={setIndex} onClose={() => setIndex(null)} />
    </section>
  );
}
