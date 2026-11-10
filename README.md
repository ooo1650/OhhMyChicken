# Ohh My Chicken! 🍕🍗

A website for **Ohh My Chicken!**: giant pizzas up to 22", crispy fried chicken and MoMo.

It runs as separate services, each with its own Dockerfile:

| Service | Folder | Tech | Exposed |
| --- | --- | --- | --- |
| **frontend** | [frontend/](frontend/) | React 19 + Vite, served by a small Node server that renders each page's SEO `<head>` and proxies `/api` to the backend | Yes (`APP_PORT`, default 3000) |
| **backend** | [backend/](backend/) | Node.js + Express JSON API | No, only through the frontend at `/api` |
| **db** | — | PostgreSQL 16 | No |

The browser only talks to the frontend's origin, so the admin session cookie (`SameSite=Strict`) and the API's same-origin check work without CORS.

The frontend builds two separate pages:

- **Customer site** at `/`: home, menu, cart, chatbot. It contains no admin code or links.
- **Staff dashboard** at `/admin/` (change it with `ADMIN_PATH`): menu manager, live orders, store settings and table QR stickers. It is its own bundle, so customers never download it.

## Run with Docker (recommended)

Requirements: Docker with Compose v2.

```bash
cp .env.example .env              # set POSTGRES_PASSWORD, SUPER_ADMIN_EMAIL and ADMIN_PASSCODE
docker compose up -d --build      # builds frontend + backend, starts them with Postgres
open http://localhost:3000
```

- The database lives in the `omc-data` volume and survives restarts and rebuilds. `docker compose down -v` deletes it.
- Postgres isn't published to the host. Uncomment `ports` under `db` in [docker-compose.yml](docker-compose.yml) to connect with `psql` or a GUI.
- Both containers run as non-root users with a read-only filesystem, no Linux capabilities and a `/healthz` healthcheck.
- Logs: `docker compose logs -f backend` (or `frontend`). Rebuild one service after changes: `docker compose up -d --build frontend`.

Each image also builds on its own: `docker build -t omc-backend ./backend`, `docker build -t omc-frontend ./frontend`. The frontend image takes `BACKEND_URL` (default `http://backend:4000`), `PUBLIC_URL` and `ADMIN_PATH` at runtime.

Backups are automatic: the `backup` service saves the database (menu, settings, outlets, orders; a few MB at most) into `./backups/` when it starts (so every deploy gets one) and every night at 3 AM Nepal time, keeping 14 days (`BACKUP_HOUR`, `BACKUP_KEEP_DAYS`). Photo files are not included, since they'd be copied in full every night; keep your originals, or set `BACKUP_PHOTOS=1`. Docker keeps at most 10 MB of logs per service. The files are readable only by their owner (`BACKUP_OWNER`, default `1000:1000`) and git-ignored: they hold customers' names and phones. Dashboard → Store → Security shows when the last one succeeded and warns after 2 days without one. Copy them off the server too (see deploy/README.md).

```bash
ls -lh backups/                                          # db-YYYY-MM-DD_HHMM.sql.gz
docker compose restart backup                            # take a backup right now
# Restore into an empty database (e.g. a new server), then start the app:
docker compose up -d db
gunzip -c backups/db-2026-10-28_0300.sql.gz | docker compose exec -T db psql -q -U omc ohh_my_chicken
docker compose up -d
```

## Run without Docker (development)

Requirements: Node.js 20.19+ and PostgreSQL 13+.

```bash
# Terminal 1: API on http://localhost:4000
cd backend
npm install
cp .env.example .env          # then set DATABASE_URL
npm run dev                   # applies the schema and seeds defaults on start

# Terminal 2: site on http://localhost:5173 (dashboard at /admin/)
cd frontend
npm install
npm run dev                   # Vite proxies /api to localhost:4000 (override with API_URL)

# Or the production way: build, then the SEO server on http://localhost:8080
npm run build && BACKEND_URL=http://localhost:4000 npm start
```

The Vite dev server skips the server-rendered `<head>` and inlined data (the app fetches them instead). Use `npm start` to check SEO output.

`npm run db:reset-menu` (in `backend/`) replaces only the menu with the one in `backend/src/defaults.js`, keeping orders, settings and photos. `npm run db:reset` wipes everything (menu, settings, orders, dashboard accounts) and re-seeds the defaults. Schema changes are applied automatically on start-up, so existing databases upgrade in place.

> Host it online before you print QR stickers. The QR code links to the page's own URL, so a `localhost` link won't open on customers' phones.

### Environment

Docker Compose reads the root `.env` ([.env.example](.env.example)). Running the backend directly reads `backend/.env` ([backend/.env.example](backend/.env.example)).

| Variable | Service | Purpose |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | compose | Database password (required) |
| `APP_PORT` | compose | Host port the site is published on (default `3000`) |
| `PUBLIC_URL` | frontend | The site's public address, e.g. `https://ohhmychicken.com`. Used for canonical links, the sitemap and social previews. **Set it before going live** |
| `ADMIN_PATH` | frontend | URL path of the staff dashboard (default `admin`). Use something hard to guess, e.g. `staff-7f3k` |
| `BACKEND_URL` | frontend | Where `/api` is forwarded (default `http://backend:4000`) |
| `FRONTEND_TRUST_PROXY` | compose → frontend | `1` when a proxy (Caddy, Nginx…) sits in front of the site |
| `DATABASE_URL` | backend | Postgres connection string (set by compose) |
| `PORT` | backend | API port (default `4000`) |
| `PGSSL` | backend | `true` for hosted Postgres that needs SSL (Neon, Supabase, Render…) |
| `SUPER_ADMIN_EMAIL` | backend | Email of the first dashboard account, the site administrator (default `paperkite.contact@gmail.com`). Used on first start only |
| `ADMIN_PASSCODE` | backend | That account's first password (10+ characters, not easy to guess). On a site that already had a dashboard passcode, the old passcode becomes the password instead |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | backend | Email for sign-in codes, only until the administrator saves a sender in *Team → Email* (default: Brevo, `smtp-relay.brevo.com:2525`, a port hosts like Render don't block; sender `paperkite.contact@gmail.com`; Gmail and other services work too). If sending fails, the code is written to the backend log |
| `NODE_ENV` | backend | `production` enables Secure cookies and HSTS |
| `COOKIE_SECURE` | backend | Override Secure cookies. Set `false` only for plain HTTP on a private LAN address |
| `TRUST_PROXY` | backend | Proxy hops in front of the API so rate limits see the real client IP. Compose sets `1` (the frontend server); use `2` if another proxy sits in front |
| `ALLOWED_ORIGINS` | backend | Extra origins allowed to send write requests, comma-separated (rarely needed) |
| `UPLOAD_DIR` | backend | Folder for uploaded photos (compose: `/app/uploads` on the `omc-media` volume; default `backend/uploads`) |

### Going live

Put the frontend behind a reverse proxy that terminates HTTPS. A tested Nginx config with edge rate limits is in [deploy/nginx/ohhmychicken.conf](deploy/nginx/ohhmychicken.conf), with setup in [deploy/README.md](deploy/README.md) step 5. Caddy or Cloudflare also work. Set `PUBLIC_URL` to your https address, `FRONTEND_TRUST_PROXY=1` and `TRUST_PROXY=2` (your proxy + the frontend server). With Caddy it's one line: `your-domain.com { reverse_proxy localhost:3000 }`. The proxy must pass the original `Host` header (Caddy does by default).

### Deployment checklist (no leaks)

1. Copy `.env.example` to `.env` on the server only, then `chmod 600 .env`. It's git-ignored, and both Dockerfiles' `.dockerignore` keep it out of images.
2. Strong secrets: `POSTGRES_PASSWORD=$(openssl rand -hex 24)`, and a long `ADMIN_PASSCODE` that is not reused anywhere. Then sign in and add the Brevo SMTP login and key in *Team → Email* so sign-in codes arrive by email.
3. Set `PUBLIC_URL=https://your-domain` and serve over HTTPS only (admin cookies are `Secure` in production).
4. Only the frontend port is published. Postgres and the API stay on internal Docker networks; keep it that way.
5. Pick an unguessable `ADMIN_PATH`. The dashboard sends `noindex` and isn't linked from the site.
6. Back up to `backups/` (git-ignored) or off the server. Dumps contain customer names, phones and addresses.
7. Before pushing: `git status` should never list `.env`, `backups/`, `backend/uploads/` or `*.sql` dumps.

## Tests and deployment (CI/CD)

GitHub Actions ([.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml)) runs on every push and pull request:

| Job | What it checks |
| --- | --- |
| **Tests** | No secrets or data files tracked · backend unit tests (validation, pricing) · API tests against a real Postgres (auth, admin protection, server-side totals, CSRF blocking, photo uploads, CSV escaping) · frontend build · SEO rules (title/description limits on every page, structured data, escaping) · end-to-end through the frontend server (SEO head, 404s, admin path, proxy, caching) · `npm audit` for critical issues |
| **Docker** | Builds both images and starts the full stack read-only, then does a smoke test, including a photo upload (sharp on Alpine) |
| **Deploy** | Only for pushes to `main`, after both pass, and once the `DEPLOY_MODE` variable is set. `runner`: a self-hosted runner on a private VM deploys locally. `ssh`: GitHub logs in with a key and pinned host key from secrets. Either way: `git pull` the tested commit, `docker compose up -d --build`, health check, automatic rollback if unhealthy |

Test-VM setup, load and security testing, and the production checklist: [deploy/README.md](deploy/README.md).

Run the tests locally:

```bash
cd backend  && DATABASE_URL=postgres://user:pass@localhost:5432/empty_test_db npm test
cd frontend && npm run build && BACKEND_URL=http://localhost:4000 npm test
```

Without `DATABASE_URL` / `BACKEND_URL` the database and server tests are skipped, and the rest still run. Use an empty, throwaway database: the API tests write orders and change settings.

## Features

| Area | What it does |
| --- | --- |
| **Hero** | Wavy title beside the giant drawn pizza with dashed size rings and a 22" sticker. The customer site has no animation or transitions at all. |
| **Offer pop-up** | Off by default (Dashboard → Store → *Show the offer pop-up on the site*); the promo code works either way. When on, it shows after 3 s, once per browser session. "Tap to copy" copies the code and applies it to the cart. You can edit it in Admin. |
| **Size guide** | Interactive 12" / 15" / 18" / 22" picker that scales the pizza and compares areas. |
| **Menu** | Full-width menu with a sticky category bar that jumps to each section and highlights the one you're reading, instant search (name, description, type or category), diet filters with veg / non-veg marks, a size / option picker, and an Add button that turns into a quantity stepper. A floating "View order" bar shows the item count and subtotal. Opening `/menu?table=7` (from a table QR sticker) shows a table banner and pre-fills the table at checkout. |
| **Cart** | Quantities, promo code (`OHH22` takes 15% off one 22" pizza, once per phone number: the server checks earlier orders, and the cart says so as soon as the phone is typed), delivery fee with a free-delivery threshold, and checkout through a pre-filled WhatsApp message. Outside opening hours it tells customers when their order will be handled. Each order is saved in the database; the server recalculates prices and the discount itself. |
| **Chatbot "Chicky"** | Built-in knowledge base covering greetings, opening hours with live open/closed status, size advice ("size for 12 people"), diet options, MoMo, prices for any dish (with add-to-cart buttons), delivery, ordering, deals and contact details. It reads the live menu, so Admin edits show up right away. |
| **Staff dashboard** (`/admin/`) | Separate page with its own sign-in (see *Dashboard accounts* below). **Menu Manager**: live search by text, price (`650`), comparison (`<500`, `>=1000`) or range (`500-800`); category filter; sortable columns; add, edit, duplicate and delete items; availability and featured toggles; JSON import/export; reset. **Store & Promo**: phone, WhatsApp, address, hours, delivery settings, offer pop-up settings and your password. **Orders**: live list (checks every 20 s, with a "new order" alert and a badge on the tab), status workflow *New → Preparing → Out for delivery → Done / Cancelled*, open/done/cancelled filters, tap-to-call phone numbers, KPIs, top sellers, and CSV export for Excel/Sheets. **QR codes**: a scannable code that opens the menu, with an optional table number; print a sheet of branded stickers or download a PNG. The offer pop-up can be previewed on the live site (`/?offer=1`). |
| **Photos** | Dashboard → **Photos**: drag-and-drop or pick several photos at once (JPG, PNG, WebP, AVIF, up to 10 MB; iPhones convert their HEIC photos to JPG when uploading from the browser). Each is checked as a real image, turned upright, stripped of EXIF/GPS data and saved as WebP in up to four widths (320–1600 px) with a blurred preview. Write a description per photo (used as alt text and in Google's data), tick **Gallery** to show it in the home-page gallery (with a lightbox) and reorder it there, and see which dishes use it. Add a photo to a dish from the **+ Photo** slot in its menu row (or Menu → Edit); it then shows on the menu, in the cart and in Google's data, and a dish without one shows its drawing. Deleting a photo unlinks it from its dishes. Each file is kept in Postgres as well as on disk: served from disk, and restored from the database on first request if the disk was wiped. |
| **Insights** (dashboard) | A paid extra for staff, switched on by the site administrator in *Team → Features* (`INSIGHTS_ENABLED` is only its starting value) and given per account; otherwise the tab shows an upgrade message and the API answers 402. The administrator always sees it. Visits keep being counted while locked. Anonymous usage analytics built in, with no third parties. **Covers:** visits and orders per day, the visit-to-order funnel (menu → cart → checkout → order), dishes added to the cart but rarely ordered, searches that found nothing, busy hours, where visitors come from, devices, first pages, table-QR scans and orders, offer pop-up performance, and chatbot topics (including questions it couldn't answer). 7/30/90-day ranges. **Privacy:** no cookies, IP addresses or user-agent strings are stored. A visitor is a hash of IP + browser with a salt that changes daily and is then deleted, so nobody can recognise a person or follow them across days. "Do Not Track" and Global Privacy Control turn tracking off, bots are ignored, digits typed into the chatbot are masked, and raw events are deleted after 180 days (`ANALYTICS_RETENTION_DAYS`). |

**Dashboard accounts:** everyone signs in with their own email and password, then a 6-digit code sent to that email (10 minutes, 5 tries; *Send a new code* once a minute). A code is emailed only to an active dashboard account, only after its right password, and at most 10 times an hour per account (`CODE_LIMIT`), so the site can't be used to send mail to strangers or flood an inbox. Two roles:

- **Administrator** (whoever runs the site, e.g. PaperKite): everything, plus the **Team** tab to add accounts, reset a forgotten password (a temporary one, shown once, that the person must replace when they sign in), switch an account off, sign people out, choose who sends the sign-in codes (*Email*: Brevo, Gmail or another service; sender, login and SMTP key, which never leaves the server), send a test email and see checks (email, database, backups, last order, wrong tries). Always sees Insights. The last administrator can't be removed.
- **Staff**: the parts of the dashboard ticked for their account in *Team → Accounts* (Menu, Orders, Photos, Outlets, Store settings, QR codes, Insights; all of them to start). The server refuses the rest, and an account with Outlets but not Store can change only the outlets. Everyone can always change their own password (the *Account* tab when Store isn't ticked).

**Features** (*Team → Features*): switches the administrator flips without a code change or redeploy: *Insights for staff*, *Chatbot on the website* and *Photo gallery on the home page*. A new feature is one entry in `backend/src/features.js` and shows up there by itself.

The first administrator is created on first start from `SUPER_ADMIN_EMAIL` (default `paperkite.contact@gmail.com`); its password is the site's old dashboard passcode if there was one, otherwise `ADMIN_PASSCODE`. Passwords need 10+ characters and can't be built from the restaurant's name, place names, common words or number runs (`backend/src/password.js`). Change yours under *Store → Security* (your other devices are signed out). Without email set up, sign-in codes are written to the backend log, which is how development works.

**Customer privacy:** checkout asks only what the order needs: an address for delivery, a table number at a table (pre-filled from table QR codes, no delivery fee), nothing for pickup (when *Takeaway* is on). Name and phone are optional; the promo code needs both (once per number). Names, phones and addresses are blanked on orders older than `ORDER_DETAILS_DAYS` (90); items and totals stay for reports.

**Opt-in customer list (for the site operator):** customers who tick *"Keep my name and number for offers"* (never pre-ticked; the box names PaperKite) are kept in the `customers` table. It is not shown in the restaurant dashboard; read it from the server:

```bash
docker compose exec -T backend node src/db.js customers > customers.csv     # name, phone, orders, last outlet, consent date
docker compose exec backend node src/db.js forget-customer 9841234567       # someone asks to be removed (also clears their old orders)
```

**Sessions:** a dashboard sign-in lasts one hour from login, whatever the staff do in that time. The dashboard warns 5 minutes before the end, then locks itself, and the server refuses the session from then on.

**Forgotten password:** anyone, staff or administrator, uses *Forgot your password?* on the sign-in page: a 6-digit code goes to their email (only if it is an active account; the page says the same either way), and the code plus a new password set it. Every device is then signed out, and the change shows in *Recent changes*. The administrator can also reset anyone's password in the Team tab. If the administrator is locked out and email isn't working, whoever runs the server sets a new one (the account is switched back on and signed out everywhere), or adds an account:

```bash
docker compose exec backend node src/db.js set-password owner@example.com         # asks twice, typing stays hidden
docker compose exec backend node src/db.js add-admin someone@example.com --super  # a new administrator
docker compose logs backend | grep "Sign-in code"                                 # codes, if email isn't working
```

**Security panel** (Store → Security): your devices signed in now, *Sign out my other devices*, wrong password or code tries in the last 24 hours, and the last 10 sign-ins with email, device and masked IP (kept 90 days; staff see their own, the administrator sees everyone's), and the last automatic backup. Sign-in locks for 15 minutes after 8 wrong tries from one IP or 10 against one account, and pauses for everyone after 60 wrong tries in 15 minutes from all IPs together (devices already signed in keep working).

## SEO

Target searches: *pizza restaurant in Kathmandu*, *pizza delivery*, *lunch*, *dinner*, *fried chicken*, *MoMo*, *veg pizza* and similar. The city comes from the dashboard, so the copy follows if you move or open elsewhere.

| What | How |
| --- | --- |
| **Real, indexable URLs** | `/`, `/menu` and one landing page per category: `/menu/chicken-pizza`, `/menu/veg-pizza`, `/menu/pork-buff-pizza`, `/menu/fried-chicken`, `/menu/momo`. Each has its own H1 and intro. Old `/#/menu?table=7` links (printed QR stickers) redirect in the browser. |
| **Server-rendered `<head>`** | Each page arrives with its own title (under 60 characters), meta description (under 160, whole sentences), canonical link, robots tag, Open Graph and Twitter card tags. They're built from the live menu and settings ([frontend/src/shared/seo.js](frontend/src/shared/seo.js)) and kept in sync during in-app navigation. |
| **Structured data (JSON-LD)** | `Restaurant` on every page: address, geo, opening hours, phone, cuisines, price range, menu link, order action, social profiles. Menu pages add a full `Menu` with every dish, variant price and availability, plus `BreadcrumbList`. Home adds `WebSite` and an `FAQPage` matching the visible FAQ. |
| **On-page content** | A visible keyword H1, a "Pizza restaurant in {city}" section on lunch, dinner and delivery (derived from opening hours and services), a 6-question FAQ, and a footer with category links plus name, address and phone. |
| **Crawling** | Dynamic `/sitemap.xml` (with `lastmod` from the last menu or settings change) and `/robots.txt`. Unknown URLs return a real `404` with `noindex`. `/Menu/` and `/index.html` 301-redirect to the single canonical URL. The dashboard sends `noindex` and isn't listed anywhere. |
| **Images** | Dish photos and gallery photos are listed in the `Menu` and `Restaurant` data, with their descriptions as alt text, responsive `srcset`, lazy loading and fixed dimensions (no layout shift). |
| **Speed** | The menu and settings are inlined in the HTML (no API round trip before first paint), with gzip compression and year-long caching for hashed bundles. |
| **Sharing & icons** | A 1200×630 social preview image, PNG app icons, an Apple touch icon and a web manifest. |

No meta keywords tag: Google and Bing ignore it.

**Things only you can do**, in this order:

1. Set `PUBLIC_URL` and fill in **Dashboard → Store → Google & local search**: street, postal code, map pin (latitude/longitude), Google Maps link, social profiles, takeaway on or off.
2. Create or claim your **Google Business Profile** (this drives "pizza near me" and the map pack). Use exactly the same name, address and phone as the site, the same categories (Pizza restaurant, Restaurant), and link the website and menu (`/menu`).
3. Add the site to **Google Search Console** and **Bing Webmaster Tools**, then submit `https://your-domain/sitemap.xml`.
4. Check a page with Google's **Rich Results Test** and the **Schema Markup Validator**.
5. Ask happy customers for Google reviews. The site doesn't show ratings, because Google ignores self-published review stars for restaurants.
6. Replace placeholder prices and the phone number before going live, since they're published in the structured data.

## Security

- **Admin auth is server-side, in two steps.** Passwords are stored as scrypt hashes; the emailed code is stored only as a hash and never sent back in a response. A wrong email and a wrong password get the same answer after the same delay, so accounts can't be discovered. Sessions are random 256-bit tokens in an `HttpOnly`, `SameSite=Strict` cookie (`__Host-` prefixed and `Secure` in production); only their SHA-256 is stored. 8 wrong tries lock that IP out for 15 minutes, 10 lock that account.
- **Sessions are server-side, not JWT, on purpose.** Each request checks the session in the database, so signing someone out, switching an account off, resetting a password or changing what an account can use applies on its very next request. A JWT stays valid until it expires unless every request checks a revocation list, which is the same database lookup with more to get wrong.
- **Every API input is checked on the server**, whatever the dashboard sends: bodies must be JSON objects (only replacing the whole menu takes a list), ids are digits or simple slugs, emails are plain lowercase addresses (no spaces, quotes, angle brackets or line breaks, so nothing can be slipped into an email header), switches must be real `true`/`false`, names lose invisible and direction-flipping characters, and only listed features and dashboard parts are accepted. Addresses containing a null byte are refused outright. A test sends ~950 malformed requests to every endpoint and expects no server error.
- **Change log** (*Team → Recent changes*): who added or changed an account, reset a password, signed people out, switched a feature, changed the email sender, reset the store settings or deleted all orders, and when. It never holds a password, key or code, and only the administrator can read it (kept a year).
- **The dashboard is a separate app** served only at `ADMIN_PATH`, with `X-Robots-Tag: noindex` and `Cache-Control: no-store`. The customer site ships none of its markup, code or styles.
- **Every write endpoint** requires a session, a JSON body and a same-origin `Origin` header, which blocks cross-site request forgery.
- **Inputs are validated on the server** (menu items, settings, orders). Order totals and discounts are recalculated server-side, so a tampered browser can't change prices.
- **Headers**: the frontend server sends HSTS (when `PUBLIC_URL` is https), a `Permissions-Policy` that turns off camera, microphone and location, and a strict Content-Security-Policy for the pages (scripts only from this origin; the QR library is bundled, no CDN), `X-Frame-Options`, `nosniff` and `Referrer-Policy`. The API adds Helmet's headers with `default-src 'none'`, and HSTS in production.
- **Rate limits**: 300 API requests/min per client, 20 orders per 10 min, 60 photo uploads per 10 min, 30 sign-in requests per 15 min, and a 15-minute lockout after 8 wrong passwords or codes. A client is one IPv4 address or one IPv6 /64, so rotating IPv6 addresses doesn't get around it. Faked `X-Forwarded-For` headers are ignored, since only the configured proxy hops are trusted.
- **Flood protection**: at most 2 password checks run at once (40 queued; more get a quick `503 busy`), so a many-IP guessing flood can't starve the server. Photos are processed one at a time. Public menu data is cached for 2 s, so page-load floods don't reach the database. Slow-sending clients (slowloris) are disconnected, and proxied requests time out. Containers have memory and process limits.
- **Size limits**: JSON bodies 1 MB, photos 10 MB and 50 megapixels (refusing image "bombs" that are tiny files but huge in memory), URLs and headers 16 KB. SVG and other non-photo formats are refused. Order fields are trimmed (name 80, address 200), up to 50 lines, quantity 1–99.
- **No open redirects**: the clean-URL redirect never sends visitors to `//other-site` or `/\other-site`.
- **Restaurant Wi-Fi note**: everyone on one Wi-Fi shares a public IP. 20 orders per 10 minutes per IP is plenty for table ordering; raise it in `backend/src/routes.js` if a busy dining room ever hits it.
- **CSV export** escapes cells starting with `=`, `+`, `-` or `@` so a customer's name can't inject a spreadsheet formula.
- **Docker**: non-root users, read-only filesystems, all capabilities dropped. Only the frontend is published; the API and database sit on internal networks.

Only the cart and the per-device "promo used" / "pop-up seen" flags stay in the customer's browser.

## Notes

- **The default menu is the restaurant's printed menu** (74 items, NPR), in `backend/src/defaults.js`. Edit it in Admin → Menu, and use *Export JSON* to keep a backup.
- **Rendered pages:** the Node server renders each page with live data (`frontend/src/site/entry-server.jsx`). `npm run build` also writes static pages for hosts without Node, such as Vercel, from `frontend/scripts/prerender-data.json`; after changing `backend/src/defaults.js`, run `node scripts/sync-prerender-data.cjs` in `frontend/` (a test reminds you).
- **Not for delivery:** the switch on a menu item (Admin → Menu → edit) keeps it on the menu, but only table orders and pickup can add it: on a delivery order it shows "Dine-in only" instead of Add, and the server refuses it too. Coffee, tea and frappes start with it on; bottled drinks don't.
- **Outlets (branches)** are managed in Admin → Outlets: address, landmark, phones, WhatsApp for orders, delivery note, own hours, map and social links, visible/hidden, main branch and order. Find us shows one card per outlet; with more than one visible, customers pick the outlet after *Place order via WhatsApp*, the order goes to that outlet's WhatsApp and is logged with its name. Table QR codes can name an outlet to skip the choice.
- **Every dish has its own drawing** (which pizza by its toppings, wings vs. bucket, which MoMo, which coffee or tea). The drawings live in `frontend/src/shared/food-art.js`; an item's `art` field picks one (Admin → Menu → edit → *Drawing*), shown until the dish has a photo, and items without one get a drawing guessed from their name.
- Update the phone, WhatsApp number and address in Admin (factory defaults are in `backend/src/defaults.js`).
- Rate limits are kept in memory, which suits a single app instance. Move them to Redis if you run several backend replicas.

## Structure

```
docker-compose.yml        db + backend + frontend
.github/workflows/        CI/CD: tests, Docker build, deploy over SSH
deploy/                   server setup guide + remote-deploy.sh (pull, rebuild, health check, rollback)
  nginx/ohhmychicken.conf Nginx reverse proxy: HTTPS (Certbot), edge rate limits, upload size, real client IP
.env.example              settings for docker compose

backend/                  Express JSON API (own Dockerfile, port 4000)
  src/index.js            app: security headers, same-origin check, /api, /healthz
  src/routes.js           JSON API (public: bootstrap, menu, settings, orders; admin: CMS, orders, CSV, accounts)
  src/models.js           Postgres queries for menu, settings, orders
  src/auth.js             dashboard sign-in (password + emailed code), sessions, lockout, password change
  src/accounts.js         accounts and checks for the site administrator (Team tab)
  src/mail.js             sends sign-in codes over SMTP
  src/features.js         features the administrator switches on or off (Team → Features)
  src/media.js            photo upload & processing (sharp → WebP sizes), library queries
  src/analytics.js        anonymous analytics: event intake (POST /api/t), daily-salted visitor hash, insights queries
  src/limit.js            in-memory rate limiting
  src/password.js         scrypt hashing and password rules
  src/validate.js         input validation for items & settings
  src/pricing.js          cart totals & promo maths (same rules as the browser)
  src/db.js               pool, migrations, seeding, db:init / db:reset CLI
  src/schema.sql          tables (idempotent; upgrades existing databases)
  src/defaults.js         default menu, categories, sizes, settings
  test/                   unit tests + API tests (node --test)

frontend/                 React app + SEO page server (own Dockerfile, port 8080)
  index.html, admin.html  the two pages (customer site, staff dashboard)
  vite.config.js          two entry points, dev proxy for /api
  server/index.js         serves the build, renders each page (head + content) with live data, sitemap, robots, 404s, /api proxy
  test/                   SEO unit tests + frontend-server end-to-end tests
  brand/logo.png          the restaurant logo (source for every logo file below)
  scripts/brand-assets.cjs  rebuilds favicon, app icons, search preview and header logo from it
  scripts/prerender.mjs   after the build: static pages for hosts without Node (Vercel)
  scripts/sync-prerender-data.cjs  refreshes prerender-data.json from backend/src/defaults.js
  public/assets/          icon sprite, social preview image, app icons (favicon.ico sits in public/)
  public/site.webmanifest web app manifest
  src/styles/             styles.css (brand, layout, components), admin.css (dashboard)
  src/shared/             API client, formatting, icons, food drawings (food-art.js), photo component, toast, accessible dialog hook
  src/shared/track.js     anonymous event tracker (batched; off under Do Not Track / GPC)
  src/shared/seo.js       routes, titles, descriptions, FAQ and schema.org data (used by server and app)
  src/site/               customer site
    main.jsx, App.jsx     bootstrap, routes, page head, header, offer pop-up, 404, footer
    entry-server.jsx      renders a page to HTML (Node server and prerender)
    router.jsx            path router on the History API
    store.jsx             menu & settings, cart (localStorage), totals, shared UI state
    Home.jsx              hero, size guide, picks, how ordering works, FAQ
    FindUs.jsx, ValleyMap.jsx  outlet list and the drawn valley map
    Menu.jsx              search, category scroll-spy, diet filters, dish cards & steppers
    Cart.jsx              cart drawer, floating order bar, WhatsApp checkout
    Chat.jsx, bot.js      Chicky's UI and intents
    Gallery.jsx           home-page photo gallery and lightbox
    art.jsx               the large drawn pizza (hero, size guide); menu drawings are in shared/food-art.js
  src/admin/              staff dashboard
    AdminApp.jsx          login gate, tabs, live orders polling
    store.jsx             CMS, auth and order calls
    PhotosPanel.jsx       photo library (upload, describe, gallery, delete) + picker for dishes
    InsightsPanel.jsx     analytics dashboard (KPIs, charts, funnel, tables)
    TeamPanel.jsx         accounts and access, features, email sender, checks (site administrator only)
    MenuPanel.jsx, ItemEditor.jsx, OrdersPanel.jsx, OutletsPanel.jsx, SettingsPanel.jsx, QrPanel.jsx, Kpi.jsx, confirm.jsx
```

Libraries: [React](https://react.dev), [qrcode-generator 1.4.4](https://github.com/kazuhikoarase/qrcode-generator), bundled by Vite. Animations respect `prefers-reduced-motion` and fall back to CSS. UI icons are an SVG sprite (`frontend/public/assets/icons.svg`) drawn in the style of [Lucide](https://lucide.dev). Emoji are not used in the interface.

Old hash URLs (`/#/menu?table=7`) from printed QR stickers redirect to the real URLs in the browser.
