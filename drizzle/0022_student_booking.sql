ALTER TABLE "teacher_settings" ADD COLUMN IF NOT EXISTS "student_booking_url" text DEFAULT '' NOT NULL;
