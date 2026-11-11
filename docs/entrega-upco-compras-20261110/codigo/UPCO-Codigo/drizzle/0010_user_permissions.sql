ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'operator';
--> statement-breakpoint
ALTER TABLE users ADD COLUMN permissions TEXT NOT NULL DEFAULT '[]';
--> statement-breakpoint
UPDATE users SET role = 'master' WHERE id = (SELECT MIN(id) FROM users);
