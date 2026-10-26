/* Admin passcode hashing with scrypt (built into Node, no native deps). */
'use strict';
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

async function hashPasscode(pass) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(pass), salt, 64);
  return 'scrypt$' + salt.toString('hex') + '$' + key.toString('hex');
}

async function verifyPasscode(pass, stored) {
  const [scheme, saltHex, keyHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const key = await scrypt(String(pass), Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(key, expected);
}

module.exports = { hashPasscode, verifyPasscode };
