/* ==========================================================================
   QR tool — a scannable QR code linking to the digital menu, with optional
   table number, printable stickers and PNG download.
   ========================================================================== */
import { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { Icon } from '../shared/Icon.jsx';
import { useToast } from '../shared/toast.jsx';
import { esc } from '../shared/format.js';
import { useAdmin } from './store.jsx';

// Always the public menu on this host (the tool itself lives in the dashboard).
// A table sticker can also name its outlet, so orders from it skip the outlet choice.
function menuUrl(table, outlet) {
  const q = [table && 'table=' + encodeURIComponent(table), outlet && 'outlet=' + encodeURIComponent(outlet)].filter(Boolean).join('&');
  return location.origin + '/menu' + (q ? '?' + q : '');
}
const stickerLabel = (c) => (c.table ? 'TABLE ' + c.table.toUpperCase() + (c.outletName ? ' · ' + c.outletName.toUpperCase() : '')
  : c.outletName ? c.outletName.toUpperCase() : 'Giant 22" pizzas · Crispy chicken · MoMo');
const isLocal = () => /^(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(location.hostname) || /^(10|192\.168)\./.test(location.hostname);

function build(url) {
  const qr = qrcode(0, 'Q'); // Q level leaves room for the centre logo
  qr.addData(url);
  qr.make();
  return qr;
}

// Draw modules onto a canvas context at (x, y) with given pixel size.
function drawModules(ctx, qr, x, y, size, color) {
  const n = qr.getModuleCount(), cell = size / n;
  ctx.fillStyle = color || '#121212';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(Math.floor(x + c * cell), Math.floor(y + r * cell), Math.ceil(cell), Math.ceil(cell));
    }
  }
}

function svgFor(qr, px) {
  const n = qr.getModuleCount(), q = 4, total = n + q * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += 'M' + (c + q) + ' ' + (r + q) + 'h1v1h-1z';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" width="' + px + '" height="' + px + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#121212"/></svg>';
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Branded sticker as a canvas (used for PNG download).
function stickerCanvas(current) {
  const W = 900, H = 1200, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#E50914'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#FFC72C';
  for (let i = 0; i < 40; i++) { ctx.globalAlpha = 0.12; ctx.beginPath(); ctx.arc((i * 137) % W, (i * 263) % H, 18, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.font = '96px "Lilita One", Impact, sans-serif';
  ctx.save(); ctx.translate(W / 2, 150); ctx.rotate(-0.05);
  ctx.fillStyle = '#121212'; ctx.fillText('OHH MY CHICKEN!', 6, 6);
  ctx.fillStyle = '#FFC72C'; ctx.fillText('OHH MY CHICKEN!', 0, 0); ctx.restore();
  ctx.fillStyle = '#fff';
  roundRect(ctx, 130, 230, 640, 640, 40); ctx.fill();
  drawModules(ctx, current.qr, 170, 270, 560);
  ctx.fillStyle = '#fff'; ctx.font = '72px "Lilita One", Impact, sans-serif';
  ctx.fillText('SCAN FOR MENU', W / 2, 990);
  ctx.font = '600 40px Rubik, Arial, sans-serif';
  ctx.fillStyle = '#FFC72C';
  ctx.fillText(stickerLabel(current), W / 2, 1070, W - 80);
  return cv;
}

function printStickers(current) {
  const label = esc(stickerLabel(current));
  let html = '<!doctype html><html><head><meta charset="utf-8"><title>Menu QR sticker</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Rubik:wght@600&display=swap" rel="stylesheet">' +
    '<style>@page{margin:12mm}body{margin:0;font-family:Rubik,Arial,sans-serif;display:flex;flex-wrap:wrap;gap:8mm;justify-content:center}' +
    '.s{width:80mm;padding:6mm;border-radius:6mm;background:#E50914;color:#fff;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact;border:1px dashed #999}' +
    '.t{font-family:"Lilita One",Impact,sans-serif;font-size:9mm;color:#FFC72C;transform:rotate(-3deg);text-shadow:.6mm .6mm 0 #121212;margin:0 0 3mm}' +
    '.q{background:#fff;border-radius:3mm;padding:2mm;display:inline-block}.q svg{width:58mm;height:58mm;display:block}' +
    '.c{font-family:"Lilita One",Impact,sans-serif;font-size:7mm;margin:3mm 0 1mm}.l{font-size:3.6mm;color:#FFC72C}</style></head><body>';
  const one = '<div class="s"><p class="t">OHH MY CHICKEN!</p><div class="q">' + svgFor(current.qr, 220) + '</div><p class="c">SCAN FOR MENU</p><p class="l">' + label + '</p></div>';
  html += one + one + one + one + '</body></html>';

  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  const go = () => {
    frame.contentWindow.focus(); frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1500);
  };
  // Give the web font a moment; print anyway if fonts API is missing.
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => setTimeout(go, 150)); else setTimeout(go, 500);
}

export function QrPanel({ hidden }) {
  const toast = useToast(), admin = useAdmin();
  const outlets = (admin.settings.outlets || []).filter((o) => o.active);
  const [outletId, setOutletId] = useState('');
  const outlet = outlets.find((o) => o.id === outletId);
  const [input, setInput] = useState('');
  const [table, setTable] = useState('');
  useEffect(() => { const t = setTimeout(() => setTable(input.trim().replace(/[^\w-]/g, '')), 150); return () => clearTimeout(t); }, [input]);

  const current = useMemo(() => {
    const url = menuUrl(table, outlet && outlet.id);
    const base = { url, table, outletName: outlet ? outlet.name : '' };
    try { return { ...base, qr: build(url) }; } catch (e) { return { ...base, qr: null }; }
  }, [table, outlet]);
  const svg = useMemo(() => (current.qr ? svgFor(current.qr, 200) : ''), [current]);

  function download() {
    if (!current.qr) { toast('QR not ready yet'); return; }
    const a = document.createElement('a');
    a.download = 'ohh-my-chicken-menu-qr' + (outlet ? '-' + outlet.id : '') + (current.table ? '-table-' + current.table : '') + '.png';
    a.href = stickerCanvas(current).toDataURL('image/png');
    a.click();
  }

  return (
    <div className="admin-panel" hidden={hidden}>
      <div className="qr-layout">
        <div className="qr-box" aria-labelledby="qrTitle">
          <h2 id="qrTitle"><Icon name="qr" /> Table QR menu</h2>
          <p>Print stickers that open the digital menu on customers' phones.</p>
          <div className="qr-canvas-wrap">
            {current.qr
              ? <div className="qr-out" role="img" aria-label={'QR code linking to ' + current.url}>
                  <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: svg }} />
                  <span className="qr-logo" aria-hidden="true">OMC</span>
                </div>
              : <div className="qr-out"><p className="tiny muted">Could not build the QR code for this address.</p></div>}
          </div>
          {outlets.length > 1 && (
            <label className="field">
              <span>Outlet <em>(where the sticker goes)</em></span>
              <select value={outletId} onChange={(e) => setOutletId(e.target.value)}>
                <option value="">Any outlet (customer chooses)</option>
                {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}{o.area ? ', ' + o.area : ''}</option>)}
              </select>
            </label>
          )}
          <label className="field">
            <span>Table number <em>(optional)</em></span>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} inputMode="numeric" maxLength="6" placeholder="e.g. 7" />
          </label>
          <p className="qr-url">
            {current.url}
            {isLocal() && <><br /><b className="warn">This is a local address. Open the dashboard on your public domain before printing, or phones won't be able to open it.</b></>}
          </p>
          <div className="qr-actions">
            <button className="btn btn-red btn-sm" onClick={() => (current.qr ? printStickers(current) : toast('QR not ready yet'))}><Icon name="printer" /> Print stickers</button>
            <button className="btn btn-outline btn-sm" onClick={download}><Icon name="download" /> Download PNG</button>
          </div>
        </div>
        <div className="panel-card qr-help">
          <h3>How it works</h3>
          <ol>
            <li>Leave the table number empty for a general sticker (counter, flyers, door).</li>
            <li>Add a table number to make a sticker per table. Orders from it are pre-filled with that table.</li>
            {outlets.length > 1 && <li>Pick the outlet for stickers placed in a branch: orders from them go straight to that outlet's WhatsApp.</li>}
            <li><b>Print stickers</b> gives four per A4 page. <b>Download PNG</b> is for printers or social media.</li>
          </ol>
          <p className="tiny muted"><Icon name="info" /> The code links to the site address you're using now. Print from your public domain, not from localhost.</p>
        </div>
      </div>
    </div>
  );
}
