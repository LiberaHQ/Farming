-- Accounts, sessions, profiles, saved worlds and their inventories.

CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_username_key ON users (lower(username));

-- Only a SHA-256 hash of the session token is stored, never the token itself.
CREATE TABLE sessions (
  token_hash TEXT        PRIMARY KEY,
  user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE profiles (
  user_id      BIGINT      PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  display_name TEXT        NOT NULL,
  appearance   JSONB       NOT NULL DEFAULT '{"skin":0,"hair":0,"shirt":0,"pants":0}',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per world (seed) per player. The full save is JSONB; key stats are
-- copied into columns for listing and queries.
CREATE TABLE worlds (
  id                BIGSERIAL   PRIMARY KEY,
  user_id           BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  seed              TEXT        NOT NULL,
  save              JSONB       NOT NULL,
  day               INTEGER     NOT NULL,
  gold              INTEGER     NOT NULL,
  lifetime_earnings INTEGER     NOT NULL,
  saved_at          TIMESTAMPTZ NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, seed)
);

-- Inventories, normalised: the backpack ('player') and each chest ('chest:x,y').
-- Rewritten from the save on every upload; queryable for trading in Phase 5.
CREATE TABLE inventory_items (
  world_id  BIGINT  NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  container TEXT    NOT NULL,
  slot      INTEGER NOT NULL,
  item_id   TEXT    NOT NULL,
  quantity  INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (world_id, container, slot)
);
CREATE INDEX inventory_items_item_idx ON inventory_items (item_id);
