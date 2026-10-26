/* ==========================================================================
   In-memory fixed-window rate limiting keyed by client IP. Old entries are
   swept every minute so the maps can't grow without bound.
   Fine for a single instance; use a shared store (Redis) if you scale out.
   ========================================================================== */
'use strict';

const buckets = new Set();

function createBucket(windowMs) {
  const hits = new Map();
  const bucket = { hits, windowMs };
  buckets.add(bucket);
  return {
    // Returns true when this hit is over the limit.
    hit(key, max) {
      const now = Date.now(), h = hits.get(key);
      if (!h || now - h.start > windowMs) { hits.set(key, { start: now, n: 1 }); return max < 1; }
      h.n += 1;
      return h.n > max;
    },
    count(key) {
      const h = hits.get(key);
      return h && Date.now() - h.start <= windowMs ? h.n : 0;
    },
    reset(key) { hits.delete(key); }
  };
}

setInterval(() => {
  const now = Date.now();
  for (const b of buckets) for (const [k, h] of b.hits) if (now - h.start > b.windowMs) b.hits.delete(k);
}, 60 * 1000).unref();

// Express middleware: at most `max` requests per `windowMs` per IP.
function limit(max, windowMs, message) {
  const bucket = createBucket(windowMs);
  return (req, res, next) => {
    if (bucket.hit(req.ip, max)) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: message || 'Too many requests. Please wait a moment.' });
    }
    next();
  };
}

module.exports = { createBucket, limit };
