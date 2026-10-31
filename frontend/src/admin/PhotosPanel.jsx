/* ==========================================================================
   Photo library — upload (button or drag & drop, several at once), write
   descriptions, choose and order gallery photos, see which dishes use a
   photo, delete. PhotoPicker reuses it to pick a dish photo.
   ========================================================================== */
import { useEffect, useRef, useState } from 'react';
import { useAdmin } from './store.jsx';
import { useConfirm } from './confirm.jsx';
import { Icon } from '../shared/Icon.jsx';
import { Photo } from '../shared/Photo.jsx';
import { useToast } from '../shared/toast.jsx';
import { useLayer } from '../shared/layer.js';

const MAX_MB = 10;
const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB');

/* ---------- Upload queue (shared by the library and the picker) ---------- */
function useUploader(onDone) {
  const admin = useAdmin();
  const [queue, setQueue] = useState([]); // { key, name, state: 'uploading'|'error', error }
  async function upload(files) {
    const list = [...files];
    for (const file of list) {
      const key = Math.random().toString(36).slice(2);
      const tooBig = file.size > MAX_MB * 1048576;
      const notImage = file.type && !/^image\//.test(file.type);
      if (tooBig || notImage) {
        setQueue((q) => q.concat({ key, name: file.name, state: 'error', error: tooBig ? 'Over ' + MAX_MB + ' MB' : 'Not a photo' }));
        continue;
      }
      setQueue((q) => q.concat({ key, name: file.name, state: 'uploading' }));
      try {
        const m = await admin.uploadMedia(file);
        setQueue((q) => q.filter((x) => x.key !== key));
        if (onDone) onDone(m);
      } catch (err) {
        setQueue((q) => q.map((x) => (x.key === key ? { ...x, state: 'error', error: err.message } : x)));
      }
    }
  }
  const dismiss = (key) => setQueue((q) => q.filter((x) => x.key !== key));
  return { queue, upload, dismiss };
}

function DropZone({ onFiles, compact }) {
  const [over, setOver] = useState(false);
  const input = useRef(null);
  return (
    <div className={'dropzone' + (over ? ' is-over' : '') + (compact ? ' is-compact' : '')}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files); }}>
      <Icon name="upload" />
      <p><b>Drop photos here</b> or</p>
      <button type="button" className="btn btn-red btn-sm" onClick={() => input.current.click()}>Choose photos</button>
      <p className="tiny muted">JPG, PNG, WebP or AVIF, up to {MAX_MB} MB each (iPhone photos are converted to JPG on upload). Landscape works best.</p>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

function UploadQueue({ queue, dismiss }) {
  if (!queue.length) return null;
  return (
    <ul className="upload-queue" aria-live="polite">
      {queue.map((q) => (
        <li key={q.key} className={'uq-' + q.state}>
          <span className="uq-name">{q.name}</span>
          {q.state === 'uploading' ? <span className="uq-status">Uploading…</span>
            : <><span className="uq-status">{q.error}</span>
                <button type="button" className="icon-btn" aria-label={'Dismiss ' + q.name} onClick={() => dismiss(q.key)}><Icon name="x" /></button></>}
        </li>
      ))}
    </ul>
  );
}

/* ---------- One photo in the library ---------- */
function PhotoCard({ m, galleryIndex, galleryCount, onMove }) {
  const admin = useAdmin(), toast = useToast(), confirm = useConfirm();
  const [alt, setAlt] = useState(m.alt);
  useEffect(() => setAlt(m.alt), [m.alt]);
  const dishes = admin.menu.filter((i) => i.imageId === m.id);

  const saveAlt = () => {
    if (alt.trim() === m.alt) return;
    admin.updateMedia(m.id, { alt }).then(() => toast('Description saved'), (err) => { toast(err.message, 'error'); setAlt(m.alt); });
  };
  const toggleGallery = () => admin.updateMedia(m.id, { gallery: !m.gallery })
    .then((x) => toast(x.gallery ? 'Added to the gallery' : 'Removed from the gallery', 'info'), (err) => toast(err.message, 'error'));
  async function del() {
    const used = dishes.length ? ' It is used by ' + dishes.map((d) => d.name).join(', ') + '; those dishes will go back to the drawing.' : '';
    if (!(await confirm('Delete this photo?' + used, 'Delete photo'))) return;
    admin.deleteMedia(m.id).then(() => toast('Photo deleted'), (err) => toast(err.message, 'error'));
  }

  return (
    <li className="photo-card">
      <div className="pc-img"><Photo media={m} alt="" sizes="240px" /></div>
      <label className="field">
        <span>Description <em>(for Google & screen readers)</em></span>
        <input value={alt} maxLength="160" placeholder="e.g. Chicken BBQ pizza, 22 inch" onChange={(e) => setAlt(e.target.value)}
          onBlur={saveAlt} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
      </label>
      {m.missing && <p className="form-error">This file was lost. Delete it and upload the photo again.</p>}
      <p className="pc-meta tiny muted">
        {m.width}×{m.height} · {kb(m.bytes)}
        {dishes.length ? <> · <b>Used by {dishes.map((d) => d.name).join(', ')}</b></> : ' · Not on a dish'}
      </p>
      <div className="pc-actions">
        <label className="switch switch-sm"><input type="checkbox" checked={m.gallery} onChange={toggleGallery} /><span /> Gallery</label>
        {m.gallery && galleryCount > 1 && (
          <span className="pc-order">
            <button type="button" className="icon-btn" disabled={galleryIndex === 0} aria-label="Show earlier in gallery" onClick={() => onMove(-1)}><Icon name="arrow-right" className="flip" /></button>
            <span className="tiny">{galleryIndex + 1}/{galleryCount}</span>
            <button type="button" className="icon-btn" disabled={galleryIndex === galleryCount - 1} aria-label="Show later in gallery" onClick={() => onMove(1)}><Icon name="arrow-right" /></button>
          </span>
        )}
        <button type="button" className="icon-btn danger" aria-label="Delete photo" title="Delete" onClick={del}><Icon name="trash" /></button>
      </div>
    </li>
  );
}

/* ---------- Library tab ---------- */
export function PhotosPanel({ hidden }) {
  const admin = useAdmin(), toast = useToast();
  const [filter, setFilter] = useState('all');
  const { queue, upload, dismiss } = useUploader((m) => toast('Uploaded ' + (m.alt || 'photo')));
  const list = admin.media;

  useEffect(() => {
    if (!hidden) admin.loadMedia().catch((err) => toast(err.message, 'error'));
  }, [hidden]); // eslint-disable-line react-hooks/exhaustive-deps

  const used = (m) => admin.menu.some((i) => i.imageId === m.id);
  const gallery = (list || []).filter((m) => m.gallery).sort((a, b) => a.order - b.order);
  const shown = (list || []).filter((m) => (filter === 'gallery' ? m.gallery : filter === 'unused' ? !used(m) && !m.gallery : true));
  const ordered = filter === 'gallery' ? gallery : shown;

  function move(m, d) {
    const ids = gallery.map((x) => x.id), i = ids.indexOf(m.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    admin.reorderGallery(ids).catch((err) => toast(err.message, 'error'));
  }

  return (
    <div className="admin-panel" hidden={hidden}>
      <div className="photos-head">
        <DropZone onFiles={upload} />
        <div className="panel-card photos-help">
          <h3>Tips for great food photos</h3>
          <ol>
            <li>Shoot in daylight near a window, no flash.</li>
            <li>Fill the frame with the food; a top-down shot works for pizza.</li>
            <li>Describe each photo in plain words, e.g. “Chicken BBQ pizza, 22 inch”. Google reads it.</li>
            <li>Tick <b>Gallery</b> to show a photo on the home page. Add a photo to a dish from <b>Menu → Edit</b>.</li>
          </ol>
        </div>
      </div>
      <UploadQueue queue={queue} dismiss={dismiss} />

      <div className="chips order-filter" role="tablist" aria-label="Filter photos">
        {[['all', 'All'], ['gallery', 'In gallery'], ['unused', 'Unused']].map(([id, label]) => (
          <button key={id} type="button" className="chip chip-sm" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>
      {list == null
        ? <p className="muted">Loading photos…</p>
        : ordered.length
          ? <ul className="photo-grid">
              {ordered.map((m) => (
                <PhotoCard key={m.id} m={m} galleryIndex={gallery.indexOf(m)} galleryCount={gallery.length} onMove={(d) => move(m, d)} />
              ))}
            </ul>
          : <p className="muted">{list.length ? 'No photos in this view.' : 'No photos yet. Upload your first one above.'}</p>}
    </div>
  );
}

/* ---------- Picker (used by the item editor) ---------- */
export function PhotoPicker({ open, selected, onPick, onClose }) {
  const admin = useAdmin(), toast = useToast();
  const ref = useRef(null);
  const { hidden, isOpen } = useLayer(open, ref, { onClose, focus: '.dropzone button' });
  const { queue, upload, dismiss } = useUploader((m) => onPick(m)); // a fresh upload is picked straight away
  useEffect(() => {
    if (open && admin.media == null) admin.loadMedia().catch((err) => toast(err.message, 'error'));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={'modal' + (isOpen ? ' is-open' : '')} ref={ref} role="dialog" aria-modal="true" aria-labelledby="pickerTitle" hidden={hidden}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-card picker-card">
        <button type="button" className="icon-btn close-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        <h2 id="pickerTitle">Choose a photo</h2>
        <DropZone onFiles={upload} compact />
        <UploadQueue queue={queue} dismiss={dismiss} />
        {admin.media == null ? <p className="muted">Loading photos…</p>
          : admin.media.length
            ? <ul className="picker-grid">
                {admin.media.map((m) => (
                  <li key={m.id}>
                    <button type="button" className={m.id === selected ? 'is-selected' : undefined} aria-pressed={m.id === selected}
                      aria-label={'Use photo: ' + (m.alt || 'untitled')} onClick={() => onPick(m)}>
                      <Photo media={m} alt="" sizes="140px" />
                    </button>
                  </li>
                ))}
              </ul>
            : <p className="muted tiny">No photos yet. Upload one above.</p>}
      </div>
    </div>
  );
}
