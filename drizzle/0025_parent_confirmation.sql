ALTER TABLE "parent_contacts" ADD COLUMN IF NOT EXISTS "confirmed_phone" text;
ALTER TABLE "parent_contacts" ADD COLUMN IF NOT EXISTS "phone_confirmed_at" timestamp with time zone;
ALTER TABLE "parent_contacts" ADD COLUMN IF NOT EXISTS "phone_confirmed_by" text;
