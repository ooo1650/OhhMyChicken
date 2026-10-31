-- Ohh My Chicken! schema. Safe to run repeatedly (everything is IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS menu_items (
  id          TEXT PRIMARY KEY,
  category    TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  diet        TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  prices      JSONB       NOT NULL,          -- [{ "label": "22\" XL", "price": 2080 }, ...]
  available   BOOLEAN     NOT NULL DEFAULT TRUE,
  popular     BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS menu_items_sort_idx ON menu_items (sort_order, created_at);

-- Single-row table holding store info + promo settings as JSON.
CREATE TABLE IF NOT EXISTS settings (
  id         SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data       JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_auth (
  id         SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pass_hash  TEXT        NOT NULL,
  is_default BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id         BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name       TEXT        NOT NULL,
  phone      TEXT        NOT NULL,
  address    TEXT        NOT NULL,
  items      JSONB       NOT NULL,           -- [{ id, name, label, qty, unit, total }]
  promo_code TEXT,
  subtotal   INTEGER     NOT NULL,
  discount   INTEGER     NOT NULL DEFAULT 0,
  delivery   INTEGER     NOT NULL DEFAULT 0,
  total      INTEGER     NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);

-- v1.1: order workflow status (added in place so existing databases upgrade).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';
DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('new', 'preparing', 'delivering', 'done', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- v1.2: photos. Files live on disk (UPLOAD_DIR, one WebP per width);
-- this table holds what the site needs to show them.
CREATE TABLE IF NOT EXISTS media (
  id            TEXT PRIMARY KEY,                 -- random, also the file name prefix
  original_name TEXT        NOT NULL DEFAULT '',
  alt           TEXT        NOT NULL DEFAULT '',  -- describes the photo (accessibility + image search)
  width         INTEGER     NOT NULL,             -- largest stored size
  height        INTEGER     NOT NULL,
  bytes         INTEGER     NOT NULL,             -- total size of all stored files
  sizes         JSONB       NOT NULL,             -- [{ "w": 640, "h": 480, "file": "<id>-640.webp" }, ...]
  placeholder   TEXT        NOT NULL DEFAULT '',  -- tiny blurred data: URI shown while loading
  in_gallery    BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_gallery_idx ON media (in_gallery, sort_order, created_at DESC);

-- Deleting a photo just unlinks it from dishes.
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_id TEXT REFERENCES media(id) ON DELETE SET NULL;

-- v1.4: which built-in drawing a dish shows when it has no photo ('' = picked from its name).
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS art TEXT NOT NULL DEFAULT '';

-- v1.5: which branch an order was sent to (its name at the time; '' before outlets existed).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS outlet TEXT NOT NULL DEFAULT '';

-- v1.3: privacy-friendly analytics. No IPs, cookies or user agents are stored:
-- `visitor` is a one-way hash of IP + browser with a salt that changes every
-- day (and is then deleted), so visits can be counted per day but not linked
-- to a person or across days.
CREATE TABLE IF NOT EXISTS events (
  id        BIGSERIAL PRIMARY KEY,
  at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  visitor   TEXT        NOT NULL,           -- daily-salted hash, 16 hex chars
  name      TEXT        NOT NULL,           -- page_view, add_to_cart, search, …
  path      TEXT,
  item_id   TEXT,
  category  TEXT,
  value     TEXT,                           -- search text, variant label, chatbot topic, …
  num       INTEGER,                        -- result count, quantity, total
  device    TEXT,                           -- mobile | tablet | desktop
  referrer  TEXT,                           -- referring site's host name only
  table_no  TEXT
);
CREATE INDEX IF NOT EXISTS events_at_idx ON events (at);
CREATE INDEX IF NOT EXISTS events_name_at_idx ON events (name, at);

-- Today's salt for the visitor hash. Older salts are deleted, so old hashes
-- can't be recomputed from an IP.
CREATE TABLE IF NOT EXISTS analytics_salt (
  day  DATE PRIMARY KEY,
  salt TEXT NOT NULL
);

-- v1.6: dashboard sign-ins (successful and failed), shown to staff so a break-in
-- gets noticed. Only a rough device name and a masked IP are kept, for 90 days.
CREATE TABLE IF NOT EXISTS admin_logins (
  id     BIGSERIAL PRIMARY KEY,
  at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ok     BOOLEAN     NOT NULL,
  device TEXT        NOT NULL DEFAULT '',
  ip     TEXT        NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS admin_logins_at_idx ON admin_logins (at DESC);

-- v1.7: how the order is served. Name and phone became optional (WhatsApp already
-- shows the outlet the customer's number); personal details are blanked after
-- ORDER_DETAILS_DAYS (default 90), keeping the items and totals for reports.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'delivery';

-- v1.8: customers who ticked "keep my details" at checkout (opt-in, never pre-ticked).
-- Kept for the site operator (PaperKite), read only from the server
-- (node src/db.js customers), not shown in the restaurant dashboard.
-- Not touched by the 90-day order clean-up; removed on request (forget-customer).
CREATE TABLE IF NOT EXISTS customers (
  phone_key  TEXT PRIMARY KEY,               -- last 10 digits of the phone
  phone      TEXT        NOT NULL,
  name       TEXT        NOT NULL DEFAULT '',
  orders     INTEGER     NOT NULL DEFAULT 1,
  outlet     TEXT        NOT NULL DEFAULT '',
  consent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_order TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- v1.9: the chatbot runs only in the browser and no longer reports what people ask;
-- remove the topics recorded before.
DELETE FROM events WHERE name = 'chat_question';

-- v2.0: the image files themselves, so photos survive hosts whose disk is wiped on
-- every deploy. The disk (UPLOAD_DIR) stays the fast path and is refilled from here.
CREATE TABLE IF NOT EXISTS media_files (
  file     TEXT PRIMARY KEY,
  media_id TEXT  NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  bytes    BYTEA NOT NULL
);
CREATE INDEX IF NOT EXISTS media_files_media_idx ON media_files (media_id);
