ALTER TABLE documents ADD COLUMN ceco_allocations TEXT NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE documents ADD COLUMN payment_account_id INTEGER;
--> statement-breakpoint
ALTER TABLE documents ADD COLUMN accounting_snapshot TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);
