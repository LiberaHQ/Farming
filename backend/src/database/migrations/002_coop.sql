-- Co-op: each guest's own progress (backpack, gold, energy, friendships) in
-- someone else's world. The shared world itself lives in the host's `worlds` row.
CREATE TABLE coop_members (
  owner_id   BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  seed       TEXT        NOT NULL,
  user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  state      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, seed, user_id)
);
CREATE INDEX coop_members_user_idx ON coop_members (user_id);
