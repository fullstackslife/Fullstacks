-- Client portal auth: password login for inquiry contacts

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS client_sessions (
  sid TEXT PRIMARY KEY,
  inquiry_id INTEGER NOT NULL REFERENCES inquiries(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_client_sessions_expires_at ON client_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_inquiries_lower_email ON inquiries (lower(email));
