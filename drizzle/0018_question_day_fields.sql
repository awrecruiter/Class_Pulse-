-- Add topic_day and assigned_date to question_bank_items.
-- Wrapped in DO block so it's a no-op if the table doesn't exist yet
-- (0019_question_bank_tables will create it with these columns included).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_bank_items') THEN
    ALTER TABLE question_bank_items ADD COLUMN IF NOT EXISTS topic_day integer;
    ALTER TABLE question_bank_items ADD COLUMN IF NOT EXISTS assigned_date text;
  END IF;
END $$;
