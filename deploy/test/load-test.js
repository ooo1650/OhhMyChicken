/* ==========================================================================
   Load test (k6). Simulates visitors browsing: home → menu → a category,
   plus the files a browser loads (scripts, styles, icons).
   Run from the host (no install, uses Docker):
     docker run --rm -i --network host -e TARGET=http://SERVER-IP grafana/k6 run - < deploy/test/load-test.js
   Options (env):  TARGET  base URL          (required)
                   PEAK    max visitors      (default 50)
                   HOLD    time at the peak  (default 2m)
                   QUICK=1 20-second smoke run with 3 visitors (check the setup first)
   All traffic comes from ONE IP (your host), so Nginx/app rate limits will
   answer some requests with 429. They're counted separately as "limited":
   they mean the protection works, not that the site broke. To measure raw
   capacity instead, see "Load testing" in deploy/README.md.
   ========================================================================== */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate } from 'k6/metrics';

if (!__ENV.TARGET) throw new Error('Set TARGET, e.g. -e TARGET=http://SERVER-IP');
const TARGET = __ENV.TARGET.replace(/\/$/, '');
const PEAK = Number(__ENV.PEAK || 50);
const HOLD = __ENV.HOLD || '2m';
const CATEGORIES = ['chicken-pizza', 'veg-pizza', 'pork-buff-pizza', 'fried-chicken', 'momo'];

const limited = new Counter('limited');           // 429 answers (rate limiting working)
const failed = new Rate('failed');                // anything that isn't 2xx/3xx/429
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 429));

export const options = {
  scenarios: {
    browse: __ENV.QUICK
      ? { executor: 'constant-vus', vus: 3, duration: '20s' }
      : {
          executor: 'ramping-vus',
          stages: [
            { duration: '30s', target: Math.ceil(PEAK / 5) },
            { duration: '1m', target: PEAK },
            { duration: HOLD, target: PEAK },
            { duration: '30s', target: 0 }
          ]
        }
  },
  thresholds: {
    failed: ['rate<0.01'],                                   // under 1 % real errors
    'http_req_duration{type:page}': ['p(95)<800'],           // 95 % of pages under 0.8 s
    'http_req_duration{type:asset}': ['p(95)<400']
  }
};

let assets = null; // learnt from the first page, like a browser would

function record(res) {
  if (res.status === 429) limited.add(1);
  failed.add(!(res.status >= 200 && res.status < 400) && res.status !== 429);
}

function page(path) {
  const res = http.get(TARGET + path, { tags: { type: 'page', name: path.startsWith('/menu/') ? '/menu/:category' : path } });
  record(res);
  check(res, { 'page ok or rate-limited': (r) => r.status === 200 || r.status === 429 });
  if (!assets && res.status === 200) {
    assets = [...res.body.matchAll(/(?:src|href)="(\/(?:static|assets)\/[^"]+)"/g)].map((m) => m[1]);
  }
  return res;
}

export default function () {
  group('home', () => {
    page('/');
    // A first-time visitor's browser downloads these once.
    if (__ITER === 0 && assets) {
      for (const a of assets) record(http.get(TARGET + a, { tags: { type: 'asset', name: 'asset' } }));
    }
  });
  sleep(1 + Math.random() * 2);   // reading time
  group('menu', () => page('/menu'));
  sleep(1 + Math.random() * 3);
  group('category', () => page('/menu/' + CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]));
  sleep(2 + Math.random() * 3);
}
