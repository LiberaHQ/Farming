-- Sign in with Google: a user can be tied to one Google account (its stable "sub" id).
-- Google-only accounts have no password; their password_hash is a placeholder that never verifies.
ALTER TABLE users ADD COLUMN google_sub TEXT;
ALTER TABLE users ADD COLUMN email TEXT;
CREATE UNIQUE INDEX users_google_key ON users (google_sub) WHERE google_sub IS NOT NULL;
