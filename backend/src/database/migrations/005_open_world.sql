-- The Open World: valleys (copies of the same map), each player's Open World character,
-- tournaments with gold entry fees, and a ledger of every gold movement they cause.
CREATE TABLE open_world_valleys (
  id         TEXT PRIMARY KEY,
  state      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE open_world_players (
  user_id    TEXT PRIMARY KEY,
  valley_id  TEXT        NOT NULL,
  name       TEXT        NOT NULL,
  state      JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX open_world_players_valley ON open_world_players (valley_id);

CREATE TABLE tournaments (
  id         TEXT PRIMARY KEY,
  tier       TEXT        NOT NULL,
  variant    TEXT        NOT NULL,
  seed       TEXT        NOT NULL,
  fee        INTEGER     NOT NULL,
  starts_at  TIMESTAMPTZ NOT NULL,
  ends_at    TIMESTAMPTZ NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'open',
  pool       INTEGER     NOT NULL DEFAULT 0,
  burned     INTEGER     NOT NULL DEFAULT 0
);
CREATE INDEX tournaments_status ON tournaments (status, ends_at);

CREATE TABLE tournament_entries (
  tournament_id TEXT    NOT NULL,
  user_id       TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  entries       INTEGER NOT NULL DEFAULT 0,
  runs_used     INTEGER NOT NULL DEFAULT 0,
  best_score    INTEGER,
  best_at       TIMESTAMPTZ,
  rank          INTEGER,
  prize         INTEGER NOT NULL DEFAULT 0,
  points        INTEGER NOT NULL DEFAULT 0,
  settled_at    TIMESTAMPTZ,
  PRIMARY KEY (tournament_id, user_id)
);

CREATE TABLE tournament_runs (
  id            TEXT PRIMARY KEY,
  tournament_id TEXT,
  user_id       TEXT        NOT NULL,
  kit           TEXT        NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  score         INTEGER,
  summary       JSONB
);

-- Every gold movement the server makes: entry fees, refunds, prizes, and the burned share.
CREATE TABLE gold_ledger (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT,
  tournament_id TEXT,
  kind          TEXT        NOT NULL,
  amount        INTEGER     NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
