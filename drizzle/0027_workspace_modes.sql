ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "workspace_mode" text NOT NULL DEFAULT 'classroom';
CREATE INDEX IF NOT EXISTS "idx_classes_teacher_workspace" ON "classes" ("teacher_id", "workspace_mode");
