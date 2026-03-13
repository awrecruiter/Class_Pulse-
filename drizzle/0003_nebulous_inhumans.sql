CREATE TABLE "confusion_marks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"roster_id" text NOT NULL,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "confusion_marks" ADD CONSTRAINT "confusion_marks_session_id_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_confusion_marks_session_id" ON "confusion_marks" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_confusion_marks_marked_at" ON "confusion_marks" USING btree ("marked_at");