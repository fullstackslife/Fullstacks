ALTER TABLE consultant_applications
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'New';

UPDATE consultant_applications
  SET status = 'New'
  WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS consultant_applications_state_idx
  ON consultant_applications (state);

CREATE INDEX IF NOT EXISTS consultant_applications_travel_preference_idx
  ON consultant_applications (travel_preference);

CREATE INDEX IF NOT EXISTS consultant_applications_availability_idx
  ON consultant_applications (availability);
