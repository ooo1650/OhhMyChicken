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

// What a new passcode must be: long enough, varied, and not built from the
// restaurant's name, place names or the usual suspects.
const MIN_PASS = 10, MAX_PASS = 128;
const COMMON = ['password', 'passcode', 'admin', 'staff', 'manager', 'owner', 'pizza', 'chicken', 'ohhmychicken', 'ohh', 'omc', 'hub', 'momo',
  'qwerty', 'asdf', 'letmein', 'welcome', 'iloveyou', 'nepal', 'kathmandu', 'lalitpur', 'bhaktapur', 'jhamsikhel', 'maharajgunj', 'abc'];

/** '' when the passcode is acceptable, otherwise the reason it isn't. */
function weakness(pass) {
  if (typeof pass !== 'string' || pass.length < MIN_PASS) return 'Use at least ' + MIN_PASS + ' characters.';
  if (pass.length > MAX_PASS) return 'Use at most ' + MAX_PASS + ' characters.';
  if (new Set(pass.toLowerCase()).size < 5) return 'Use more different characters.';
  let rest = pass.toLowerCase().replace(/[^a-z0-9]/g, '');
  COMMON.forEach((w) => { rest = rest.split(w).join(''); });
  rest = rest.replace(/0123456789|123456789|12345678|1234567|123456|12345|1234|2026|2025|2027/g, '');
  if (rest.length < 4) return 'Too easy to guess. Avoid the restaurant name, place names, common words and simple number runs.';
  return '';
}

module.exports = { hashPasscode, verifyPasscode, weakness, MIN_PASS, MAX_PASS };
