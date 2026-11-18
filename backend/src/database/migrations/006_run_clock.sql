-- Mine Dash runs are timed by the server's own clock (milliseconds), not the database's.
ALTER TABLE tournament_runs ADD COLUMN started_ms BIGINT;
