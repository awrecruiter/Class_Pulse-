CREATE TABLE IF NOT EXISTS "group_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"name" text NOT NULL,
	"coins_required" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.table_constraints
		WHERE constraint_name = 'group_milestones_class_id_classes_id_fk'
		  AND table_name = 'group_milestones'
	) THEN
		ALTER TABLE "group_milestones" ADD CONSTRAINT "group_milestones_class_id_classes_id_fk"
			FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_group_milestones_class_id" ON "group_milestones" USING btree ("class_id");
