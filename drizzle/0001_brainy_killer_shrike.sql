CREATE TABLE "ambient_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"alert_type" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"is_acknowledged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "behavior_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"roster_id" uuid NOT NULL,
	"session_id" uuid,
	"step" integer NOT NULL,
	"label" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"ram_buck_deduction" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "behavior_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"roster_id" uuid NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"teacher_notes" text DEFAULT '' NOT NULL,
	"last_incident_at" timestamp with time zone,
	"last_reset_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cfu_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"session_id" uuid,
	"roster_id" uuid NOT NULL,
	"standard_code" text NOT NULL,
	"score" integer NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"teacher_id" text NOT NULL,
	"join_code" text NOT NULL,
	"date" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "class_sessions_join_code_unique" UNIQUE("join_code")
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" text NOT NULL,
	"label" text NOT NULL,
	"period_time" text DEFAULT '' NOT NULL,
	"grade_level" text DEFAULT '5' NOT NULL,
	"subject" text DEFAULT 'Math' NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comprehension_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"roster_id" uuid NOT NULL,
	"signal" text NOT NULL,
	"signalled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lost_since" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "correction_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"roster_id" uuid NOT NULL,
	"context" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drawing_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"roster_id" uuid NOT NULL,
	"standard_code" text NOT NULL,
	"analysis_type" text DEFAULT 'partial' NOT NULL,
	"analysis_text" text NOT NULL,
	"student_feedback" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"roster_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manipulative_pushes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"triggered_by" text DEFAULT 'teacher' NOT NULL,
	"spec" text NOT NULL,
	"standard_code" text,
	"pushed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mastery_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"roster_id" uuid NOT NULL,
	"standard_code" text NOT NULL,
	"consecutive_correct" integer DEFAULT 0 NOT NULL,
	"total_attempts" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'working' NOT NULL,
	"achieved_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"roster_id" uuid NOT NULL,
	"parent_name" text DEFAULT '' NOT NULL,
	"phone" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"roster_id" uuid NOT NULL,
	"incident_id" uuid,
	"phone" text NOT NULL,
	"body" text NOT NULL,
	"triggered_by" text NOT NULL,
	"status" text NOT NULL,
	"sms_sid" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"roster_id" uuid NOT NULL,
	"incident_id" uuid,
	"message" text NOT NULL,
	"step" integer NOT NULL,
	"is_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "privilege_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" text NOT NULL,
	"name" text NOT NULL,
	"cost" integer DEFAULT 20 NOT NULL,
	"duration_minutes" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "privilege_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"roster_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"cost" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ram_buck_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"roster_id" uuid NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"lifetime_earned" integer DEFAULT 0 NOT NULL,
	"last_reset_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ram_buck_fee_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" text NOT NULL,
	"step" integer NOT NULL,
	"label" text NOT NULL,
	"deduction_amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ram_buck_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"roster_id" uuid NOT NULL,
	"session_id" uuid,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roster_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"first_initial" text NOT NULL,
	"last_initial" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"performance_score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '🐾' NOT NULL,
	"color" text DEFAULT 'blue' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"mastery_threshold" integer DEFAULT 3 NOT NULL,
	"confusion_alert_percent" integer DEFAULT 40 NOT NULL,
	"use_alias_mode" boolean DEFAULT false NOT NULL,
	"store_reset_schedule" text DEFAULT 'weekly' NOT NULL,
	"store_is_open" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "ambient_alerts" ADD CONSTRAINT "ambient_alerts_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behavior_incidents" ADD CONSTRAINT "behavior_incidents_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behavior_incidents" ADD CONSTRAINT "behavior_incidents_roster_id_roster_entries_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behavior_incidents" ADD CONSTRAINT "behavior_incidents_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behavior_profiles" ADD CONSTRAINT "behavior_profiles_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behavior_profiles" ADD CONSTRAINT "behavior_profiles_roster_id_roster_entries_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cfu_entries" ADD CONSTRAINT "cfu_entries_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cfu_entries" ADD CONSTRAINT "cfu_entries_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cfu_entries" ADD CONSTRAINT "cfu_entries_roster_id_roster_entries_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comprehension_signals" ADD CONSTRAINT "comprehension_signals_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comprehension_signals" ADD CONSTRAINT "comprehension_signals_roster_id_roster_entries_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_roster_id_roster_entries_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_analyses" ADD CONSTRAINT "drawing_analyses_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_analyses" ADD CONSTRAINT "drawing_analyses_roster_id_roster_entries_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_accounts" ADD CONSTRAINT "group_accounts_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_accounts" ADD CONSTRAINT "group_accounts_group_id_student_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."student_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_group_id_student_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."student_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_roster_id_roster_entries_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manipulative_pushes" ADD CONSTRAINT "manipulative_pushes_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_records" ADD CONSTRAINT "mastery_records_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_records" ADD CONSTRAINT "mastery_records_roster_id_roster_entries_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_contacts" ADD CONSTRAINT "parent_contacts_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_contacts" ADD CONSTRAINT "parent_contacts_roster_id_roster_entries_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_messages" ADD CONSTRAINT "parent_messages_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_messages" ADD CONSTRAINT "parent_messages_roster_id_roster_entries_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_messages" ADD CONSTRAINT "parent_messages_incident_id_behavior_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."behavior_incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_notifications" ADD CONSTRAINT "parent_notifications_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_notifications" ADD CONSTRAINT "parent_notifications_roster_id_roster_entries_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_notifications" ADD CONSTRAINT "parent_notifications_incident_id_behavior_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."behavior_incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privilege_purchases" ADD CONSTRAINT "privilege_purchases_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privilege_purchases" ADD CONSTRAINT "privilege_purchases_roster_id_roster_entries_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privilege_purchases" ADD CONSTRAINT "privilege_purchases_item_id_privilege_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."privilege_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ram_buck_accounts" ADD CONSTRAINT "ram_buck_accounts_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ram_buck_accounts" ADD CONSTRAINT "ram_buck_accounts_roster_id_roster_entries_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ram_buck_transactions" ADD CONSTRAINT "ram_buck_transactions_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ram_buck_transactions" ADD CONSTRAINT "ram_buck_transactions_roster_id_roster_entries_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."roster_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ram_buck_transactions" ADD CONSTRAINT "ram_buck_transactions_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_groups" ADD CONSTRAINT "student_groups_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ambient_alerts_session_id" ON "ambient_alerts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_ambient_alerts_is_acknowledged" ON "ambient_alerts" USING btree ("is_acknowledged");--> statement-breakpoint
CREATE INDEX "idx_behavior_incidents_class_roster" ON "behavior_incidents" USING btree ("class_id","roster_id");--> statement-breakpoint
CREATE INDEX "idx_behavior_incidents_created_at" ON "behavior_incidents" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_behavior_profiles_class_roster" ON "behavior_profiles" USING btree ("class_id","roster_id");--> statement-breakpoint
CREATE INDEX "idx_behavior_profiles_class_id" ON "behavior_profiles" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_cfu_entries_class_id" ON "cfu_entries" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_cfu_entries_date" ON "cfu_entries" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cfu_entry_unique" ON "cfu_entries" USING btree ("class_id","roster_id","date","standard_code");--> statement-breakpoint
CREATE INDEX "idx_class_sessions_class_id" ON "class_sessions" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_class_sessions_teacher_id" ON "class_sessions" USING btree ("teacher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_class_sessions_join_code" ON "class_sessions" USING btree ("join_code");--> statement-breakpoint
CREATE INDEX "idx_class_sessions_status" ON "class_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_classes_teacher_id" ON "classes" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "idx_comprehension_session_id" ON "comprehension_signals" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_comprehension_session_roster" ON "comprehension_signals" USING btree ("session_id","roster_id");--> statement-breakpoint
CREATE INDEX "idx_correction_requests_session_id" ON "correction_requests" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_correction_requests_status" ON "correction_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_drawing_analyses_session_id" ON "drawing_analyses" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_drawing_analyses_roster_id" ON "drawing_analyses" USING btree ("roster_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_group_accounts_group" ON "group_accounts" USING btree ("class_id","group_id");--> statement-breakpoint
CREATE INDEX "idx_group_memberships_class_id" ON "group_memberships" USING btree ("class_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_group_membership_roster" ON "group_memberships" USING btree ("class_id","roster_id");--> statement-breakpoint
CREATE INDEX "idx_manipulative_pushes_session_id" ON "manipulative_pushes" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_mastery_session_roster_std" ON "mastery_records" USING btree ("session_id","roster_id","standard_code");--> statement-breakpoint
CREATE INDEX "idx_mastery_session_id" ON "mastery_records" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_parent_contacts_class_roster" ON "parent_contacts" USING btree ("class_id","roster_id");--> statement-breakpoint
CREATE INDEX "idx_parent_contacts_class_id" ON "parent_contacts" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_parent_messages_class_roster" ON "parent_messages" USING btree ("class_id","roster_id");--> statement-breakpoint
CREATE INDEX "idx_parent_messages_sent_at" ON "parent_messages" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_parent_notifications_class_roster" ON "parent_notifications" USING btree ("class_id","roster_id");--> statement-breakpoint
CREATE INDEX "idx_privilege_items_teacher_id" ON "privilege_items" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "idx_privilege_purchases_class_id" ON "privilege_purchases" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "idx_privilege_purchases_status" ON "privilege_purchases" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ram_buck_accounts_class_roster" ON "ram_buck_accounts" USING btree ("class_id","roster_id");--> statement-breakpoint
CREATE INDEX "idx_ram_buck_accounts_class_id" ON "ram_buck_accounts" USING btree ("class_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_fee_schedule_teacher_step" ON "ram_buck_fee_schedule" USING btree ("teacher_id","step");--> statement-breakpoint
CREATE INDEX "idx_fee_schedule_teacher_id" ON "ram_buck_fee_schedule" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "idx_ram_buck_transactions_class_roster" ON "ram_buck_transactions" USING btree ("class_id","roster_id");--> statement-breakpoint
CREATE INDEX "idx_ram_buck_transactions_created_at" ON "ram_buck_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_roster_entries_class_id" ON "roster_entries" USING btree ("class_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_roster_class_student" ON "roster_entries" USING btree ("class_id","student_id");--> statement-breakpoint
CREATE INDEX "idx_student_groups_class_id" ON "student_groups" USING btree ("class_id");