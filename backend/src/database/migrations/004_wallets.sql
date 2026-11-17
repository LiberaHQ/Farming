-- Sign in with Ethereum: a user can be tied to one wallet address (stored lower-case).
-- Wallet-only accounts have no password; their password_hash is a placeholder that never verifies.
ALTER TABLE users ADD COLUMN wallet_address TEXT;
CREATE UNIQUE INDEX users_wallet_key ON users (wallet_address) WHERE wallet_address IS NOT NULL;
