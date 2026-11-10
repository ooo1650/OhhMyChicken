/* ==========================================================================
   The dashboard's emails: sign-in code, password reset code and the test
   email. Each has a subject, a plain-text version and an HTML version.
   The HTML follows email rules, not web rules: tables, inline styles, no
   images or web fonts (often blocked, and they push mail towards spam),
   and it reads fine when an email app turns on dark mode.
   ========================================================================== */
'use strict';

const BRAND = 'Ohh My Chicken Pizza Hub';
const C = { red: '#E50914', ink: '#121212', yellow: '#FFC72C', cream: '#FFF8E6', muted: '#6B6560', line: '#ECE6DA', green: '#0B7A3E' };
const FONT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// "10 Nov, 9:41 PM" in Nepal time, whatever the server's clock zone.
const nepalTime = (d) => d.toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

// Where the request came from: "Chrome on Android · 203.0.113.x · 10 Nov, 9:41 PM (Nepal time)".
function origin(where) {
  return [where && where.device, where && where.ip, nepalTime(new Date()) + ' (Nepal time)'].filter(Boolean).join(' · ');
}

// The 6 digits in separate boxes: easy to read, and still copied as one number.
function codeBoxes(code) {
  const cells = String(code).split('').map((d) =>
    `<td style="padding:0 3px"><div style="width:38px;height:50px;line-height:50px;border:2px solid ${C.ink};border-radius:10px;background:#ffffff;` +
    `font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:26px;font-weight:700;color:${C.ink};text-align:center">${d}</div></td>`).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto"><tr>${cells}</tr></table>`;
}

function layout({ preheader, title, intro, code, after, note, accent = C.red }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.cream}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cream}">
<tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:3px solid ${C.ink};border-radius:20px;overflow:hidden">
    <tr><td style="background:${accent};padding:18px 24px;border-bottom:3px solid ${C.ink}">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background:${C.yellow};border:2px solid ${C.ink};border-radius:8px;padding:4px 8px;font-family:${FONT};font-size:15px;font-weight:900;color:${C.ink};letter-spacing:.5px">OMC</td>
        <td style="padding-left:10px;font-family:${FONT};font-size:16px;font-weight:800;color:#ffffff">${BRAND}<br><span style="font-size:12px;font-weight:600;opacity:.9">Staff dashboard</span></td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:28px 24px 8px;font-family:${FONT};color:${C.ink}">
      <h1 style="margin:0 0 10px;font-size:22px;line-height:1.25;font-weight:800">${esc(title)}</h1>
      <p style="margin:0 0 ${code ? 22 : 4}px;font-size:15px;line-height:1.55;color:#333333">${intro}</p>
      ${code ? codeBoxes(code) : ''}
      ${after ? `<p style="margin:22px 0 0;font-size:14px;line-height:1.5;color:#333333;text-align:${code ? 'center' : 'left'}">${after}</p>` : ''}
    </td></tr>
    <tr><td style="padding:20px 24px 24px;font-family:${FONT}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cream};border-radius:12px">
        <tr><td style="padding:12px 14px;font-size:13px;line-height:1.5;color:#333333">${note}</td></tr>
      </table>
    </td></tr>
  </table>
  <p style="margin:16px 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};max-width:480px">
    Sent to you because you have an account on the ${BRAND} staff dashboard.<br>Website looked after by PaperKite.</p>
</td></tr></table>
</body></html>`;
}

function signInCode(code, where) {
  const from = origin(where);
  return {
    subject: code + ' is your dashboard sign-in code',
    text: `${BRAND}: staff dashboard\n\nYour sign-in code: ${code}\n\nIt works for 10 minutes, once.\nRequested from: ${from}\n\n` +
      `Not you? Someone knows your password. Don't share this code; change your password in the dashboard (Store, Security, or Account) or use "Forgot your password?".\n`,
    html: layout({
      preheader: 'Your code: ' + code + '. It works for 10 minutes.',
      title: 'Your sign-in code',
      intro: 'Type this code on the sign-in page to open the dashboard.',
      code,
      after: `Works for <b>10 minutes</b>, once.`,
      note: `<b>Requested from:</b> ${esc(from)}<br><br><b style="color:${C.red}">Not you?</b> Someone knows your password. Don't share this code with anyone, and change your password, or use <i>Forgot your password?</i> on the sign-in page.`
    })
  };
}

function resetCode(code, where) {
  const from = origin(where);
  return {
    subject: code + ' is your password reset code',
    text: `${BRAND}: staff dashboard\n\nSomeone asked to set a new password for your account.\nYour reset code: ${code}\n\nIt works for 10 minutes, once.\nRequested from: ${from}\n\n` +
      `Not you? Ignore this email. Your password stays as it is.\n`,
    html: layout({
      preheader: 'Your reset code: ' + code + '. Ignore this email if it wasn\'t you.',
      title: 'Set a new password',
      intro: 'Someone asked to set a new password for your dashboard account. If it was you, type this code on the reset page with your new password.',
      code,
      after: `Works for <b>10 minutes</b>, once.`,
      accent: C.ink,
      note: `<b>Requested from:</b> ${esc(from)}<br><br><b>Not you?</b> Ignore this email. Your password stays as it is, and nobody can change it without this code.`
    })
  };
}

function testEmail() {
  return {
    subject: 'Test email from your dashboard',
    text: `${BRAND}: staff dashboard\n\nThis is a test. Email is working: sign-in and password reset codes will arrive like this one.\nSent ${nepalTime(new Date())} (Nepal time).\n`,
    html: layout({
      preheader: 'Email is working.',
      title: 'Email is working',
      intro: `This is a test from <b>Team → Email</b>. Sign-in and password reset codes will arrive like this one.`,
      accent: C.green,
      note: `Sent ${esc(nepalTime(new Date()))} (Nepal time). If this landed in spam, mark it as <i>not spam</i> so the codes arrive in the inbox.`
    })
  };
}

module.exports = { signInCode, resetCode, testEmail };
