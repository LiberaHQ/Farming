-- Friends: a one-way "follow" list. Both directions show up as friends.
CREATE TABLE friends (
  user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  friend_id  BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);
CREATE INDEX friends_friend_idx ON friends (friend_id);
