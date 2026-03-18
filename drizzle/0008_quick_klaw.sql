CREATE TABLE "portal_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" text NOT NULL,
	"portal_key" text NOT NULL,
	"username" text NOT NULL,
	"encrypted_password" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "voice_nav_mode" text DEFAULT 'toast' NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "voice_app_open_mode" text DEFAULT 'immediate' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_portal_credentials_teacher_key" ON "portal_credentials" USING btree ("teacher_id","portal_key");--> statement-breakpoint
CREATE INDEX "idx_portal_credentials_teacher_id" ON "portal_credentials" USING btree ("teacher_id");