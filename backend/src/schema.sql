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
