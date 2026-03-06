CREATE TABLE "di_group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"di_group_id" uuid NOT NULL,
	"di_session_id" uuid NOT NULL,
	"roster_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "di_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"di_session_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "di_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"teacher_id" text NOT NULL,
	"label" text DEFAULT 'DI Activity' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"reward_amount" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "di_reward_amount" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "di_group_members" ADD CONSTRAINT "di_group_members_di_group_id_di_groups_id_fk" FOREIGN KEY ("di_group_id") REFERENCES "public"."di_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "di_group_members" ADD CONSTRAINT "di_group_members_di_session_id_di_sessions_id_fk" FOREIGN KEY ("di_session_id") REFERENCES "public"."di_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "di_group_members" ADD CONSTRAINT "di_group_members_roster_id_roster_entries_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "di_groups" ADD CONSTRAINT "di_groups_di_session_id_di_sessions_id_fk" FOREIGN KEY ("di_session_id") REFERENCES "public"."di_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "di_sessions" ADD CONSTRAINT "di_sessions_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_di_group_members_session_id" ON "di_group_members" USING btree ("di_session_id");--> statement-breakpoint
CREATE INDEX "idx_di_group_members_group_id" ON "di_group_members" USING btree ("di_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_di_group_members_unique" ON "di_group_members" USING btree ("di_session_id","roster_id");--> statement-breakpoint
CREATE INDEX "idx_di_groups_session_id" ON "di_groups" USING btree ("di_session_id");--> statement-breakpoint
CREATE INDEX "idx_di_sessions_class_id" ON "di_sessions" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_di_sessions_teacher_id" ON "di_sessions" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "idx_di_sessions_status" ON "di_sessions" USING btree ("status");