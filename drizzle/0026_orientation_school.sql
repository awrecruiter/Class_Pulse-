ALTER TABLE "orientations" ADD COLUMN IF NOT EXISTS "school_name" text NOT NULL DEFAULT '';
ALTER TABLE "orientations" ADD COLUMN IF NOT EXISTS "school_options" jsonb NOT NULL DEFAULT '[]'::jsonb;
