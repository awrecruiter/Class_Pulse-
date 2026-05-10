CREATE TABLE "blocked_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" text NOT NULL,
	"date" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"teacher_id" text NOT NULL,
	"date" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_resource_defaults" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_number" integer NOT NULL,
	"lesson_number" text NOT NULL,
	"resource_type" text NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" text NOT NULL,
	"topic_number" integer NOT NULL,
	"lesson_number" text NOT NULL,
	"resource_type" text NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"resource_data" jsonb,
	"import_date" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pacing_lesson_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" text NOT NULL,
	"topic_number" integer NOT NULL,
	"lesson_number" text NOT NULL,
	"date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pacing_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" text NOT NULL,
	"topic_number" integer NOT NULL,
	"start_date" text NOT NULL,
	"cascade_mode" text DEFAULT 'push_forward' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "current_topic_number" integer;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "currency_name" text DEFAULT 'RAM Bucks' NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "currency_emoji" text DEFAULT '🐏' NOT NULL;--> statement-breakpoint
ALTER TABLE "class_assignments" ADD CONSTRAINT "class_assignments_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_blocked_days_teacher_date" ON "blocked_days" USING btree ("teacher_id","date");--> statement-breakpoint
CREATE INDEX "idx_blocked_days_teacher_id" ON "blocked_days" USING btree ("teacher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_class_assignments_class_date" ON "class_assignments" USING btree ("class_id","date");--> statement-breakpoint
CREATE INDEX "idx_class_assignments_class_id" ON "class_assignments" USING btree ("class_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_lesson_resource_defaults_topic_lesson_type" ON "lesson_resource_defaults" USING btree ("topic_number","lesson_number","resource_type");--> statement-breakpoint
CREATE INDEX "idx_lesson_resource_defaults_topic" ON "lesson_resource_defaults" USING btree ("topic_number");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_lesson_resources_teacher_lesson_type" ON "lesson_resources" USING btree ("teacher_id","topic_number","lesson_number","resource_type");--> statement-breakpoint
CREATE INDEX "idx_lesson_resources_teacher_id" ON "lesson_resources" USING btree ("teacher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pacing_lesson_placements_teacher_lesson" ON "pacing_lesson_placements" USING btree ("teacher_id","topic_number","lesson_number");--> statement-breakpoint
CREATE INDEX "idx_pacing_lesson_placements_teacher_id" ON "pacing_lesson_placements" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "idx_pacing_lesson_placements_date" ON "pacing_lesson_placements" USING btree ("teacher_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pacing_overrides_teacher_topic" ON "pacing_overrides" USING btree ("teacher_id","topic_number");--> statement-breakpoint
CREATE INDEX "idx_pacing_overrides_teacher_id" ON "pacing_overrides" USING btree ("teacher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_one_active_session_per_class" ON "class_sessions" USING btree ("class_id") WHERE "class_sessions"."status" = 'active';