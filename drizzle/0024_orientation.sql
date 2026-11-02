CREATE TABLE IF NOT EXISTS "orientations" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "class_id" uuid NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
 "token" text NOT NULL UNIQUE,
 "roster_id" uuid REFERENCES "roster_entries"("id") ON DELETE CASCADE,
 "parent_email" text DEFAULT '' NOT NULL,
 "grade_level" text DEFAULT '' NOT NULL,
 "learning_content" text DEFAULT '' NOT NULL,
 "initial_signal" text,
 "check_in_session_id" uuid REFERENCES "class_sessions"("id") ON DELETE SET NULL,
 "content" text DEFAULT '' NOT NULL,
 "quiz_url" text DEFAULT '' NOT NULL,
 "meeting_url" text DEFAULT '' NOT NULL,
 "progress_note" text DEFAULT '' NOT NULL,
 "home_practice" text DEFAULT '' NOT NULL,
 "reviewed_at" timestamp with time zone,
 "enrolled_at" timestamp with time zone,
 "expires_at" timestamp with time zone NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_orientations_class" ON "orientations" ("class_id");
CREATE INDEX IF NOT EXISTS "idx_orientations_roster" ON "orientations" ("roster_id");
