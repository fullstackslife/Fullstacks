CREATE TABLE IF NOT EXISTS consultant_applications (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  current_hospitality_role TEXT NOT NULL,
  years_experience TEXT NOT NULL,
  travel_preference TEXT NOT NULL,
  availability TEXT NOT NULL,
  brands_worked_with TEXT,
  management_companies TEXT,
  linkedin_url TEXT,
  resume_url TEXT,
  compensation_expectations TEXT,
  specialty_areas TEXT[],
  notes TEXT NOT NULL,
  status TEXT DEFAULT 'New',
  source TEXT DEFAULT 'fullstacks.ink',
  user_agent TEXT,
  ip TEXT
);

CREATE INDEX IF NOT EXISTS consultant_applications_created_at_idx
  ON consultant_applications (created_at DESC);

CREATE INDEX IF NOT EXISTS consultant_applications_status_idx
  ON consultant_applications (status);

CREATE INDEX IF NOT EXISTS consultant_applications_email_idx
  ON consultant_applications (email);
