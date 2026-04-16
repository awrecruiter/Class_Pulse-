-- Change voice_nav_mode column default from 'toast' to 'immediate'
-- and update any existing rows that still have the old default value.
ALTER TABLE "teacher_settings" ALTER COLUMN "voice_nav_mode" SET DEFAULT 'immediate';
--> statement-breakpoint
UPDATE "teacher_settings" SET "voice_nav_mode" = 'immediate' WHERE "voice_nav_mode" = 'toast';
