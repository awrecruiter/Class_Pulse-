CREATE TABLE IF NOT EXISTS "lesson_resource_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "teacher_id" text NOT NULL,
  "filename" text NOT NULL,
  "mime_type" text DEFAULT 'application/pdf' NOT NULL,
  "data" bytea NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
