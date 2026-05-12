ALTER TABLE "teacher_settings" ADD COLUMN IF NOT EXISTS "behavior_reset_schedule" text NOT NULL DEFAULT 'manual';
