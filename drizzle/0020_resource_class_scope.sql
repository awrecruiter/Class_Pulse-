-- Add class_id to lesson_resources so resources can be scoped to one class or all classes.
-- Empty string '' means "all classes"; a UUID means scoped to that class only.
ALTER TABLE lesson_resources ADD COLUMN class_id text NOT NULL DEFAULT '';

-- Drop the old unique index (did not include class_id).
DROP INDEX IF EXISTS "idx_lesson_resources_teacher_lesson_type";

-- Recreate with class_id so the same resource type can exist per-class on the same date.
CREATE UNIQUE INDEX "idx_lesson_resources_teacher_lesson_type"
ON lesson_resources (teacher_id, topic_number, lesson_number, resource_type, class_id);
