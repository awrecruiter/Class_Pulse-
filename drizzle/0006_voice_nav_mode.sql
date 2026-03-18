ALTER TABLE "teacher_settings" ADD COLUMN IF NOT EXISTS "voice_nav_mode" text NOT NULL DEFAULT 'toast';
