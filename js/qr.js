/* ==========================================================================
   QR tool — generates a scannable QR code linking to the digital menu,
   with optional table number, printable sticker and PNG download.
   ========================================================================== */
(function (OMC) {
  'use strict';
  var ui = OMC.ui, $ = ui.$;
  var current = null; // { url, qr }

  function menuUrl(table) {
    var base = location.href.split('#')[0].split('?')[0];
    return base + '#/menu' + (table ? '?table=' + encodeURIComponent(table) : '');
  }

  function build(url) {
    if (typeof window.qrcode === 'undefined') return null;
    var qr = window.qrcode(0, 'Q'); // Q level leaves room for the centre logo
    qr.addData(url);
    qr.make();
    return qr;
  }

  // Draw modules onto a canvas context at (x, y) with given pixel size.
  function drawModules(ctx, qr, x, y, size, color) {
    var n = qr.getModuleCount(), cell = size / n;
    ctx.fillStyle = color || '#121212';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(Math.floor(x + c * cell), Math.floor(y + r * cell), Math.ceil(cell), Math.ceil(cell));
      }
    }
  }

  function svgFor(qr, px) {
    var n = qr.getModuleCount(), q = 4, total = n + q * 2, d = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) d += 'M' + (c + q) + ' ' + (r + q) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" width="' + px + '" height="' + px + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#121212"/></svg>';
  }

  function render() {
    var table = $('#qrTable').value.trim().replace(/[^\w-]/g, '');
    var url = menuUrl(table);
    var qr = build(url);
    var out = $('#qrOut');
    $('#qrUrl').textContent = url;
    if (!qr) {
      out.innerHTML = '<p class="tiny muted">QR library failed to load. Check your connection and refresh.</p>';
      current = null; return;
    }
    current = { url: url, qr: qr, table: table };
    out.innerHTML = svgFor(qr, 200) + '<span class="qr-logo" aria-hidden="true">🍗</span>';
    out.setAttribute('role', 'img');
    out.setAttribute('aria-label', 'QR code linking to ' + url);
    if (location.protocol === 'file:') {
      $('#qrUrl').innerHTML = ui.esc(url) + '<br><b class="warn">Tip: host the site online so phones can open this link.</b>';
    }
  }

  // Branded sticker as a canvas (used for PNG download).
  function stickerCanvas() {
    var W = 900, H = 1200, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#E50914'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#FFC72C';
    for (var i = 0; i < 40; i++) { ctx.globalAlpha = .12; ctx.beginPath(); ctx.arc((i * 137) % W, (i * 263) % H, 18, 0, 7); ctx.fill(); }
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
    ctx.fillText(current.table ? 'TABLE ' + current.table.toUpperCase() : 'Giant 22" pizzas · Crispy chicken · MoMo', W / 2, 1070);
    return cv;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function download() {
    if (!current) return ui.toast('QR not ready yet');
    var a = document.createElement('a');
    a.download = 'ohh-my-chicken-menu-qr' + (current.table ? '-table-' + current.table : '') + '.png';
    a.href = stickerCanvas().toDataURL('image/png');
    a.click();
  }

  function print() {
    if (!current) return ui.toast('QR not ready yet');
    var label = current.table ? 'TABLE ' + ui.esc(current.table.toUpperCase()) : 'Giant 22" pizzas · Crispy chicken · MoMo';
    var html = '<!doctype html><html><head><meta charset="utf-8"><title>Menu QR sticker</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Rubik:wght@600&display=swap" rel="stylesheet">' +
      '<style>@page{margin:12mm}body{margin:0;font-family:Rubik,Arial,sans-serif;display:flex;flex-wrap:wrap;gap:8mm;justify-content:center}' +
      '.s{width:80mm;padding:6mm;border-radius:6mm;background:#E50914;color:#fff;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact;border:1px dashed #999}' +
      '.t{font-family:"Lilita One",Impact,sans-serif;font-size:9mm;color:#FFC72C;transform:rotate(-3deg);text-shadow:.6mm .6mm 0 #121212;margin:0 0 3mm}' +
      '.q{background:#fff;border-radius:3mm;padding:2mm;display:inline-block}.q svg{width:58mm;height:58mm;display:block}' +
      '.c{font-family:"Lilita One",Impact,sans-serif;font-size:7mm;margin:3mm 0 1mm}.l{font-size:3.6mm;color:#FFC72C}</style></head><body>';
    var one = '<div class="s"><p class="t">OHH MY CHICKEN!</p><div class="q">' + svgFor(current.qr, 220) + '</div><p class="c">SCAN FOR MENU</p><p class="l">' + label + '</p></div>';
    html += one + one + one + one + '</body></html>';

    var frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(frame);
    var doc = frame.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    var go = function () {
      frame.contentWindow.focus(); frame.contentWindow.print();
      setTimeout(function () { frame.remove(); }, 1500);
    };
    // Give the web font a moment; print anyway if fonts API is missing.
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { setTimeout(go, 150); }); else setTimeout(go, 500);
  }

  OMC.qr = {
    init: function () {
      $('#qrTable').addEventListener('input', ui.debounce(render, 150));
      $('#qrPrint').addEventListener('click', print);
      $('#qrDownload').addEventListener('click', download);
      render();
    },
    render: render
  };
})(window.OMC = window.OMC || {});
