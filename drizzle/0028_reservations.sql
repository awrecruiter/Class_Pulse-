CREATE TABLE IF NOT EXISTS calendly_connections (user_id text PRIMARY KEY, token_encrypted text NOT NULL, user_uri text NOT NULL, account_name text NOT NULL);
CREATE TABLE IF NOT EXISTS reservations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), teacher_id text NOT NULL, source_uri text, class_id uuid REFERENCES classes(id) ON DELETE SET NULL, source text NOT NULL DEFAULT 'manual', learner_name text NOT NULL, subject text NOT NULL DEFAULT '', topic text NOT NULL DEFAULT '', starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservation_source ON reservations (teacher_id,source_uri);
CREATE INDEX IF NOT EXISTS idx_reservation_teacher_start ON reservations (teacher_id,starts_at);
