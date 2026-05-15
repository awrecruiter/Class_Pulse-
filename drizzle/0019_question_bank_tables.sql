-- Creates question_bank_items and question_pushes tables that were added via db:push
-- in dev but never captured in a tracked migration. Safe to re-run (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "question_bank_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" text NOT NULL,
	"source_url" text NOT NULL,
	"source_filename" text NOT NULL,
	"resource_type" text NOT NULL,
	"standard_code" text,
	"stem" text NOT NULL,
	"choices" jsonb,
	"answer" text NOT NULL,
	"question_type" text DEFAULT 'free-response' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"topic_day" integer,
	"assigned_date" text,
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "question_pushes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"question_id" uuid,
	"question_json" text NOT NULL,
	"pushed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "question_pushes" ADD CONSTRAINT "question_pushes_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "question_pushes" ADD CONSTRAINT "question_pushes_question_id_question_bank_items_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question_bank_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_qbank_teacher_id" ON "question_bank_items" USING btree ("teacher_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_qbank_resource_type" ON "question_bank_items" USING btree ("resource_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_qpushes_session_id" ON "question_pushes" USING btree ("session_id");
