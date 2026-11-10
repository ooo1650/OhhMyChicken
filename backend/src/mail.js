/* ==========================================================================
   Email for dashboard sign-in codes, over SMTP (Gmail with an app password,
   Brevo, Resend…). Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and
   MAIL_FROM in .env; see .env.example.
   ========================================================================== */
'use strict';
const nodemailer = require('nodemailer');

const HOST = process.env.SMTP_HOST || '';
const PORT = Number(process.env.SMTP_PORT) || 587;
const USER = process.env.SMTP_USER || '';
const FROM = process.env.MAIL_FROM || USER;

const configured = () => !!(HOST && FROM);

let transport = null;
function mailer() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: HOST, port: PORT, secure: PORT === 465, // 465 is TLS from the start; 587 upgrades to TLS
      auth: USER ? { user: USER, pass: process.env.SMTP_PASS || '' } : undefined,
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
    });
  }
  return transport;
}

async function send(to, subject, text) {
  if (!configured()) throw new Error('email is not set up on the server (SMTP_HOST and MAIL_FROM)');
  await mailer().sendMail({ from: FROM, to, subject, text });
}

module.exports = { configured, send, from: () => FROM };
