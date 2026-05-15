ALTER TABLE question_bank_items ADD COLUMN IF NOT EXISTS topic_day integer;
ALTER TABLE question_bank_items ADD COLUMN IF NOT EXISTS assigned_date text;
