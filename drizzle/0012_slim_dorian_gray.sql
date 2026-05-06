CREATE TABLE IF NOT EXISTS "intervention_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"roster_id" uuid NOT NULL,
	"tier" text NOT NULL,
	"standard_code" text NOT NULL,
	"session_count" integer DEFAULT 2 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'teacher' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pacing_guide_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" text NOT NULL,
	"week_of" text NOT NULL,
	"standard_code" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "parent_report_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"flag_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"viewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parent_report_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"behavior_class_management_enabled" boolean DEFAULT true NOT NULL,
	"instructional_coach_enabled" boolean DEFAULT true NOT NULL,
	"planning_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "class_sessions" ADD COLUMN IF NOT EXISTS "standard_code" text;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN IF NOT EXISTS "voice_nav_mode" text DEFAULT 'immediate' NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN IF NOT EXISTS "voice_app_open_mode" text DEFAULT 'immediate' NOT NULL;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "intervention_flags" ADD CONSTRAINT "intervention_flags_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "intervention_flags" ADD CONSTRAINT "intervention_flags_roster_id_roster_entries_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster_entries"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "parent_report_tokens" ADD CONSTRAINT "parent_report_tokens_flag_id_intervention_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."intervention_flags"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_intervention_flags_class_id" ON "intervention_flags" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_intervention_flags_roster_id" ON "intervention_flags" USING btree ("roster_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_intervention_flags_status" ON "intervention_flags" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_intervention_flags_active" ON "intervention_flags" USING btree ("roster_id","standard_code","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organization_memberships_organization_id" ON "organization_memberships" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_organization_memberships_user_id" ON "organization_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_organization_memberships_org_user" ON "organization_memberships" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_organizations_slug" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pacing_guide_teacher_id" ON "pacing_guide_entries" USING btree ("teacher_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_pacing_guide_teacher_week" ON "pacing_guide_entries" USING btree ("teacher_id","week_of");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_parent_report_tokens_token" ON "parent_report_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_parent_report_tokens_flag_id" ON "parent_report_tokens" USING btree ("flag_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_subscriptions_organization_id" ON "subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_subscriptions_status" ON "subscriptions" USING btree ("status");