ALTER TABLE "teacher_settings" ADD COLUMN IF NOT EXISTS "voice_app_open_mode" text NOT NULL DEFAULT 'immediate';
