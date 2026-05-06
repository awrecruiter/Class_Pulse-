-- Add resource_data JSONB column to lesson_resources for storing parsed CSV question data
-- (bell ringer / CFU problems + answers that don't map to the existing URL-centric columns)
ALTER TABLE "lesson_resources" ADD COLUMN IF NOT EXISTS "resource_data" jsonb;
-- Also track the import date explicitly (separate from the lesson date inference)
ALTER TABLE "lesson_resources" ADD COLUMN IF NOT EXISTS "import_date" text;
