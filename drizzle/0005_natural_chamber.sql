CREATE TABLE "schedule_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" text NOT NULL,
	"title" text NOT NULL,
	"color" text DEFAULT 'blue' NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"day_of_week" integer,
	"specific_date" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_doc_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" uuid NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"link_type" text DEFAULT 'url' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN IF NOT EXISTS "schedule_doc_open_mode" text DEFAULT 'toast' NOT NULL;
--> statement-breakpoint
ALTER TABLE "schedule_doc_links" ADD CONSTRAINT "schedule_doc_links_block_id_schedule_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."schedule_blocks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_schedule_blocks_teacher_id" ON "schedule_blocks" USING btree ("teacher_id");
--> statement-breakpoint
CREATE INDEX "idx_schedule_blocks_day_of_week" ON "schedule_blocks" USING btree ("day_of_week");
--> statement-breakpoint
CREATE INDEX "idx_schedule_blocks_specific_date" ON "schedule_blocks" USING btree ("specific_date");
--> statement-breakpoint
CREATE INDEX "idx_schedule_doc_links_block_id" ON "schedule_doc_links" USING btree ("block_id");
