ALTER TABLE "teacher_settings" ADD COLUMN "voice_nav_mode" text DEFAULT 'toast' NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "voice_app_open_mode" text DEFAULT 'immediate' NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "require_wake_phrase" boolean DEFAULT false NOT NULL;